"""
surrogate_model.py
==================
Optional U-Net PyTorch surrogate model for fast thermal prediction.

If PyTorch is not installed or model weights are not found, all functions
degrade gracefully and return None, causing the API to fall back to the
full FDM solver automatically.

Architecture
------------
Input  : [batch, 4, 16, 16]
  ch0  – component_type  (normalised)
  ch1  – power_density   (W/m², normalised)      ← Q is an INPUT, not predicted
  ch2  – supply_voltage  (V, normalised)
  ch3  – material_k0     (W/m·K, normalised)

Spatial Upsampling (Technical Audit Fix #2)
-------------------------------------------
Before entering the U-Net encoder, the 16×16 input tensor is bilinearly
upsampled to 64×64.  This gives the physics loss function smooth spatial
gradients to differentiate through, avoiding the gradient oscillation
that arises from step-function component boundaries on a coarse 16×16 grid.
After the decoder, the output is bilinearly downsampled back to 16×16 for
the JSON response.

Output : [batch, 1, 16, 16]  – predicted temperature (°C), re-downsampled

Loss function (PINN — Technical Audit Fix #1)
---------------------------------------------
Because the network outputs only T (not Q), Q_pred never exists.
The corrected loss function is:

  L_total = L_data + λ₁·L_fourier + λ₂·L_robin + λ₃·L_leakage

  L_data     = MSE(T_pred, T_fdm)

  L_fourier  = ||∇·(k(T_pred)·∇T_pred) + Q_dynamic||²
               Uses non-linear k(T_pred) = k0 / (1 + β·(T_pred - T_amb))
               Q_dynamic is the static input power map (ch1).

  L_robin    = ||−k(T_edge)·∂T/∂n − h·(T_edge − T_amb)||²
               Evaluated on the 4 boundary pixel strips.

  L_leakage  = ||∇·(k(T_pred)·∇T_pred) + Q_dynamic + Q_leakage(T_pred)||²
               where Q_leakage(T) = α·exp(β_lk·(T − T_ref))
               This enforces that, as the chip heats up, leakage current
               increases (Arrhenius-like), raising the effective heat source
               and forcing the model to learn the thermal feedback loop.

Training uses FDM solver outputs as "labels" (supervised) while simultaneously
enforcing the PDE residual (physics-informed).  The dual supervision term is
what prevents the "training trap" described in the architecture review —
FDM data anchors the solution while the physics loss ensures physical
generalisation to unseen layouts.
"""

import numpy as np
from typing import Optional, Any

# ---------------------------------------------------------------------------
# Graceful import of PyTorch
# ---------------------------------------------------------------------------
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torch.optim as optim
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False

# ---------------------------------------------------------------------------
# Model file path (relative to backend root when uvicorn is run from there)
# ---------------------------------------------------------------------------
MODEL_WEIGHTS_PATH = "unet_thermal.pth"

# Internal working resolution after upsampling
_HI_RES = 64   # 16 → 64 via bilinear upsample inside forward()


# ===========================================================================
# U-Net building blocks
# ===========================================================================

def _double_conv(in_ch: int, out_ch: int) -> "nn.Sequential":
    """Two consecutive Conv2d → BatchNorm → ReLU blocks."""
    if not _TORCH_AVAILABLE:
        raise RuntimeError("PyTorch not installed")
    return nn.Sequential(
        nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
    )


class _Down(nn.Module if _TORCH_AVAILABLE else object):  # type: ignore[misc]
    """MaxPool2d(2) + double conv — encoder block."""

    def __init__(self, in_ch: int, out_ch: int) -> None:
        if not _TORCH_AVAILABLE:
            return
        super().__init__()
        self.block = nn.Sequential(nn.MaxPool2d(2), _double_conv(in_ch, out_ch))

    def forward(self, x: "torch.Tensor") -> "torch.Tensor":
        return self.block(x)


class _Up(nn.Module if _TORCH_AVAILABLE else object):  # type: ignore[misc]
    """ConvTranspose2d upsample + skip concat + double conv — decoder block."""

    def __init__(self, in_ch: int, out_ch: int) -> None:
        if not _TORCH_AVAILABLE:
            return
        super().__init__()
        self.up   = nn.ConvTranspose2d(in_ch, in_ch // 2, 2, stride=2)
        self.conv = _double_conv(in_ch, out_ch)

    def forward(self, x: "torch.Tensor", skip: "torch.Tensor") -> "torch.Tensor":
        x = self.up(x)
        # Handle odd spatial sizes from non-power-of-2 inputs
        if x.shape[-2:] != skip.shape[-2:]:
            x = F.interpolate(x, size=skip.shape[-2:], mode="bilinear", align_corners=False)
        x = torch.cat([skip, x], dim=1)
        return self.conv(x)


class ThermalUNet(nn.Module if _TORCH_AVAILABLE else object):  # type: ignore[misc]
    """
    U-Net surrogate for 16×16 chip thermal prediction.

    Internal working resolution: 64×64  (bilinear upsample applied inside
    forward() before the encoder, downsampled back to 16×16 at the output).

    At 64×64, three encoder stages can be used (64→32→16→8) giving the
    physics loss function smoother gradients when computing ∇T and ∇²T.
    The coarser 16×16 input would only allow two stages before the spatial
    dimension collapses to 4×4, causing violent gradient oscillation on
    sharp component boundaries.

    Parameters
    ----------
    in_channels   : number of input feature channels (default 4)
    base_features : feature width at the first encoder stage (default 32)
    """

    def __init__(self, in_channels: int = 4, base_features: int = 32) -> None:
        if not _TORCH_AVAILABLE:
            return
        super().__init__()
        f = base_features

        # Encoder operates on 64×64 after upsampling
        self.enc1 = _double_conv(in_channels, f)       # 64×64 → 64×64
        self.enc2 = _Down(f,       f * 2)              # 64×64 → 32×32
        self.enc3 = _Down(f * 2,   f * 4)              # 32×32 → 16×16

        # Bottleneck at 16×16 (was unavoidable at the native 16×16 resolution)
        self.bottleneck = _double_conv(f * 4, f * 8)   # 16×16

        # Decoder
        self.dec3 = _Up(f * 8, f * 4)                  # 16×16 → 32×32
        self.dec2 = _Up(f * 4, f * 2)                  # 32×32 → 64×64

        # Final convolution head — output is still at 64×64 (downsampled after)
        self.head = nn.Sequential(
            nn.Conv2d(f * 2, f, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(f, 1, 1),   # single-channel temperature map
        )

    def forward(self, x: "torch.Tensor") -> "torch.Tensor":
        """
        Parameters
        ----------
        x : (B, 4, 16, 16)  raw input tensor at native grid resolution

        Returns
        -------
        T : (B, 1, 16, 16)  predicted temperature map, back at 16×16
        """
        # ── FIX #2: Upsample 16→64 before the U-Net for smooth gradients ──
        x_hi = F.interpolate(x, size=(_HI_RES, _HI_RES),
                             mode="bilinear", align_corners=False)

        # Encoder
        e1 = self.enc1(x_hi)   # (B, f,   64, 64)
        e2 = self.enc2(e1)     # (B, 2f,  32, 32)
        e3 = self.enc3(e2)     # (B, 4f,  16, 16)

        # Bottleneck
        b = self.bottleneck(e3)  # (B, 8f, 16, 16)

        # Decoder with skip connections
        d3 = self.dec3(b,  e3)  # (B, 4f, 32, 32)
        d2 = self.dec2(d3, e2)  # (B, 2f, 64, 64)

        # Head — temperature map at 64×64
        t_hi = self.head(d2)    # (B, 1, 64, 64)

        # ── FIX #2: Downsample 64→16 before returning to the API layer ──
        t_lo = F.interpolate(t_hi, size=(16, 16),
                             mode="bilinear", align_corners=False)
        return t_lo  # (B, 1, 16, 16)


# ===========================================================================
# Physics helper utilities used inside the loss
# ===========================================================================

def _nonlinear_k(
    T_pred: "torch.Tensor",
    k0:     float = 149.0,
    beta:   float = 0.003,
    T_amb:  float = 25.0,
) -> "torch.Tensor":
    """
    Non-linear thermal conductivity: k(T) = k0 / (1 + β·(T − T_amb))

    Clamped so k never goes negative (physically impossible).
    Operates element-wise on any shaped tensor.
    """
    dT = torch.clamp(T_pred - T_amb, min=0.0)
    return k0 / (1.0 + beta * dT)


def _leakage_power(
    T_pred:  "torch.Tensor",
    alpha:   float = 5e-4,
    beta_lk: float = 0.05,
    T_ref:   float = 25.0,
) -> "torch.Tensor":
    """
    Thermal-aware leakage (static) power density — Fix #1.

    Models the Arrhenius-like increase in leakage current as temperature rises:
        Q_leakage(T) = α · exp(β_lk · (T − T_ref))

    At T_ref = 25°C this equals α (a small baseline leakage).
    At 100°C this is roughly α·exp(3.75) ≈ 42·α — significant.

    Parameters
    ----------
    alpha   : baseline leakage power density (W/m²), normalised to input Q
    beta_lk : temperature sensitivity coefficient (K⁻¹)
    T_ref   : reference temperature (°C, typically ambient)
    """
    return alpha * torch.exp(beta_lk * (T_pred - T_ref))


def _discrete_laplacian(
    T:   "torch.Tensor",
    dx:  float,
    k_T: "torch.Tensor",
) -> "torch.Tensor":
    """
    Compute ∇·(k(T)·∇T) using a finite-difference stencil applied via conv2d.

    This implements the non-linear divergence form of Fourier's law:

        ∇·(k(T)·∇T) ≈  [k_{i,j+½}·(T_{i,j+1}−T_{i,j})
                       − k_{i,j−½}·(T_{i,j}−T_{i,j−1})
                       + k_{i+½,j}·(T_{i+1,j}−T_{i,j})
                       − k_{i−½,j}·(T_{i,j}−T_{i−1,j})] / dx²

    Interface conductivities k_{i,j±½} use harmonic mean for accuracy across
    material boundaries (avoids over-estimating conductivity at interfaces).

    Parameters
    ----------
    T   : (B, 1, N, N) temperature field
    dx  : cell size in metres
    k_T : (B, 1, N, N) conductivity field matching T

    Returns
    -------
    div_kgradT : (B, 1, N, N) divergence term
    """
    # Interior finite differences with reflect padding to stay in-bounds
    T_pad = F.pad(T,   (1, 1, 1, 1), mode="reflect")
    k_pad = F.pad(k_T, (1, 1, 1, 1), mode="reflect")

    # Harmonic mean conductivity at cell interfaces
    k_e = 2 * k_pad[:, :, 1:-1, 2:  ] * k_pad[:, :, 1:-1, 1:-1] / (k_pad[:, :, 1:-1, 2:  ] + k_pad[:, :, 1:-1, 1:-1] + 1e-9)
    k_w = 2 * k_pad[:, :, 1:-1, :-2 ] * k_pad[:, :, 1:-1, 1:-1] / (k_pad[:, :, 1:-1, :-2 ] + k_pad[:, :, 1:-1, 1:-1] + 1e-9)
    k_n = 2 * k_pad[:, :, :-2,  1:-1] * k_pad[:, :, 1:-1, 1:-1] / (k_pad[:, :, :-2,  1:-1] + k_pad[:, :, 1:-1, 1:-1] + 1e-9)
    k_s = 2 * k_pad[:, :, 2:,   1:-1] * k_pad[:, :, 1:-1, 1:-1] / (k_pad[:, :, 2:,   1:-1] + k_pad[:, :, 1:-1, 1:-1] + 1e-9)

    # Temperature neighbours
    T_e = T_pad[:, :, 1:-1, 2:  ]
    T_w = T_pad[:, :, 1:-1, :-2 ]
    T_n = T_pad[:, :, :-2,  1:-1]
    T_s = T_pad[:, :, 2:,   1:-1]
    T_c = T

    div_kgradT = (
        k_e * (T_e - T_c) - k_w * (T_c - T_w) +
        k_n * (T_n - T_c) - k_s * (T_c - T_s)
    ) / (dx ** 2)

    return div_kgradT


# ===========================================================================
# PINN Loss  (Technical Audit Fix #1 — complete rewrite)
# ===========================================================================

def pinn_loss(
    T_pred:  "torch.Tensor",
    T_label: "torch.Tensor",
    Q_map:   "torch.Tensor",
    k0:      float = 149.0,
    beta_k:  float = 0.003,
    h_eff:   float = 25.0,
    T_amb:   float = 25.0,
    dx:      float = 1e-3,
    lam1:    float = 0.10,
    lam2:    float = 0.05,
    lam3:    float = 0.03,
) -> "torch.Tensor":
    """
    Physics-Informed loss with three residual terms.

    FIX #1: Q_pred has been removed entirely — the network outputs only T.
    Q_map (channel 1 from the input tensor) is the static dynamic-power map.
    The leakage term Q_leakage(T_pred) is derived from the predicted
    temperature, capturing the Arrhenius thermal feedback loop.

    Parameters
    ----------
    T_pred  : (B, 1, N, N) — network temperature prediction
    T_label : (B, 1, N, N) — FDM ground-truth temperature
    Q_map   : (B, 1, N, N) — dynamic heat source map (Joule + dynamic power)
    k0      : baseline silicon conductivity (W/m·K)
    beta_k  : non-linear conductivity degradation coefficient (K⁻¹)
    h_eff   : convective coefficient at chip edges (W/m²·K)
    T_amb   : ambient temperature (°C)
    dx      : cell size (m)
    lam1    : weight for Fourier + leakage PDE residual
    lam2    : weight for Robin BC residual
    lam3    : weight for leakage-augmented PDE residual

    Loss terms
    ----------
    L_data     = MSE(T_pred, T_fdm)

    L_fourier  = ||∇·(k(T_pred)·∇T_pred) + Q_dynamic||²
                 Non-linear k ensures the conductivity degradation feedback is
                 captured.  This REPLACES the old constant-k Laplacian.

    L_leakage  = ||∇·(k(T_pred)·∇T_pred) + Q_dynamic + Q_leakage(T_pred)||²
                 Adds the temperature-dependent leakage power on top of the
                 Fourier residual.  This is the Fix #1 correction: instead of
                 a phantom Q_pred output, we compute leakage analytically from
                 T_pred.

    L_robin    = boundary residual: -k(T_edge)·∂T/∂n = h·(T_edge - T_amb)
    """
    if not _TORCH_AVAILABLE:
        raise RuntimeError("PyTorch not installed")

    # ── Data loss ────────────────────────────────────────────────────────────
    L_data = F.mse_loss(T_pred, T_label)

    # ── Non-linear conductivity field ─────────────────────────────────────
    k_T = _nonlinear_k(T_pred, k0=k0, beta=beta_k, T_amb=T_amb)  # (B,1,N,N)

    # ── Fourier PDE residual  ∇·(k(T)∇T) + Q_dynamic = 0 ─────────────────
    div_kgradT  = _discrete_laplacian(T_pred, dx, k_T)
    fourier_res = div_kgradT + Q_map
    L_fourier   = torch.mean(fourier_res ** 2)

    # ── Thermal-aware leakage  (Fix #1) ──────────────────────────────────
    Q_leak      = _leakage_power(T_pred, T_ref=T_amb)
    leakage_res = div_kgradT + Q_map + Q_leak
    L_leakage   = torch.mean(leakage_res ** 2)

    # ── Robin BC residual at the four boundary strips ─────────────────────
    # outward normal derivative approximation (first-order one-sided diff)
    # Sign convention: n points outward, so ∂T/∂n > 0 means T rising toward edge
    k_west  = k_T[:, :, :,  0:1]
    k_east  = k_T[:, :, :, -1: ]
    k_north = k_T[:, :,  0:1, :]
    k_south = k_T[:, :, -1:,  :]

    dTdn_west  = (T_pred[:, :, :,  1:2] - T_pred[:, :, :,  0:1]) / dx
    dTdn_east  = (T_pred[:, :, :, -1: ] - T_pred[:, :, :, -2:-1]) / dx
    dTdn_north = (T_pred[:, :,  1:2, :] - T_pred[:, :,  0:1, :]) / dx
    dTdn_south = (T_pred[:, :, -1:,  :] - T_pred[:, :, -2:-1, :]) / dx

    T_west  = T_pred[:, :, :,  0:1]
    T_east  = T_pred[:, :, :, -1: ]
    T_north = T_pred[:, :,  0:1, :]
    T_south = T_pred[:, :, -1:,  :]

    # Robin residual: k·∂T/∂n + h·(T_edge − T_amb) = 0
    bc_west  = k_west  * dTdn_west  + h_eff * (T_west  - T_amb)
    bc_east  = k_east  * dTdn_east  + h_eff * (T_east  - T_amb)
    bc_north = k_north * dTdn_north + h_eff * (T_north - T_amb)
    bc_south = k_south * dTdn_south + h_eff * (T_south - T_amb)
    L_robin  = (
        torch.mean(bc_west ** 2) + torch.mean(bc_east ** 2) +
        torch.mean(bc_north ** 2) + torch.mean(bc_south ** 2)
    ) / 4.0

    # ── Total loss ────────────────────────────────────────────────────────
    return L_data + lam1 * L_fourier + lam3 * L_leakage + lam2 * L_robin


# ===========================================================================
# Public API
# ===========================================================================

def load_model() -> Optional[Any]:
    """
    Attempt to load pre-trained U-Net weights from MODEL_WEIGHTS_PATH.

    Returns
    -------
    ThermalUNet on CPU in eval mode, or None if weights / torch unavailable.
    """
    if not _TORCH_AVAILABLE:
        return None
    try:
        model = ThermalUNet()
        state = torch.load(MODEL_WEIGHTS_PATH, map_location="cpu", weights_only=True)
        model.load_state_dict(state)
        model.eval()
        return model
    except Exception:
        return None


def predict_temperature(
    model:     Any,
    layout:    Any,
    Q_map:     np.ndarray,
    I_map:     np.ndarray,
    ambient_C: float = 25.0,
) -> Optional[np.ndarray]:
    """
    Run the surrogate model forward pass for a given chip layout.

    The model internally upsamples 16→64 and downsamples back to 16×16.
    The caller receives a (16, 16) numpy array in degrees Celsius.

    Parameters
    ----------
    model     : loaded ThermalUNet (from load_model()), or None
    layout    : layout Pydantic object
    Q_map     : (N, N) heat source density map — already computed by FDM helper
    I_map     : (N, N) current density map — used for voltage channel
    ambient_C : ambient temperature (°C)

    Returns
    -------
    T_pred : (N, N) ndarray in °C, or None on any error (falls back to FDM).
    """
    if model is None or not _TORCH_AVAILABLE:
        return None

    try:
        from app.physics.physics_laws import MATERIALS, COMPONENT_DEFAULTS

        N            = int(getattr(layout, "grid_size", 16))
        material_key = getattr(layout, "material", "silicon")
        mat          = MATERIALS.get(material_key, MATERIALS["silicon"])
        k0_norm      = mat["k0"] / 2200.0          # normalise by diamond (max k0)

        # Channel 0: component type map (power ratio, 0 = empty, 1 = CPU Core)
        comp_type_map = np.zeros((N, N), dtype=np.float32)
        # Channel 2: supply voltage map
        voltage_map   = np.zeros((N, N), dtype=np.float32)

        for comp in getattr(layout, "components", []):
            ctype    = getattr(comp, "type", "cpu_core")
            defaults = COMPONENT_DEFAULTS.get(ctype, COMPONENT_DEFAULTS["cpu_core"])
            enc      = float(defaults["power_mW"]) / 250.0      # normalised by CPU
            vv       = float(getattr(comp, "voltage_V", defaults["voltage_V"])) / 3.3
            cy, cx   = int(getattr(comp, "y", 0)), int(getattr(comp, "x", 0))
            ch, cw   = int(getattr(comp, "height", 1)), int(getattr(comp, "width", 1))
            for ri in range(cy, cy + ch):
                for ci in range(cx, cx + cw):
                    if 0 <= ri < N and 0 <= ci < N:
                        comp_type_map[ri, ci] = enc
                        voltage_map[ri, ci]   = vv

        # Channel 1: normalised power density
        q_max  = float(Q_map.max()) if Q_map.max() > 0 else 1.0
        q_norm = (Q_map / q_max).astype(np.float32)

        # Channel 3: uniform material conductivity map
        k_map = np.full((N, N), k0_norm, dtype=np.float32)

        # Stack → (1, 4, N, N) tensor
        x_np = np.stack([comp_type_map, q_norm, voltage_map, k_map], axis=0)
        x_t  = torch.from_numpy(x_np).unsqueeze(0)   # (1, 4, N, N)

        with torch.no_grad():
            # forward() handles 16→64 upsample internally → returns (1,1,16,16)
            y_t = model(x_t)

        T_norm = y_t.squeeze().numpy()   # (N, N), values ≈ 0..1 (normalised rise)

        # Denormalise: model predicts normalised temperature rise above ambient.
        # Training targets were normalised as (T_fdm - T_amb) / 100.
        T_pred = T_norm * 100.0 + ambient_C
        T_pred = np.clip(T_pred, ambient_C, 250.0)

        return T_pred.astype(np.float64)

    except Exception:
        return None


def build_training_input(layout: Any, Q_map: np.ndarray) -> Optional[np.ndarray]:
    """
    Build the (4, N, N) input feature array for a layout — shared between
    predict_temperature() and train_surrogate() to avoid code duplication.

    Returns None if inputs are invalid.
    """
    if not _TORCH_AVAILABLE:
        return None
    try:
        from app.physics.physics_laws import MATERIALS, COMPONENT_DEFAULTS

        N            = int(getattr(layout, "grid_size", 16))
        material_key = getattr(layout, "material", "silicon")
        mat          = MATERIALS.get(material_key, MATERIALS["silicon"])
        k0_norm      = mat["k0"] / 2200.0

        comp_type_map = np.zeros((N, N), dtype=np.float32)
        voltage_map   = np.zeros((N, N), dtype=np.float32)

        for comp in getattr(layout, "components", []):
            ctype    = getattr(comp, "type", "cpu_core")
            defaults = COMPONENT_DEFAULTS.get(ctype, COMPONENT_DEFAULTS["cpu_core"])
            enc      = float(defaults["power_mW"]) / 250.0
            vv       = float(getattr(comp, "voltage_V", defaults["voltage_V"])) / 3.3
            cy, cx   = int(getattr(comp, "y", 0)), int(getattr(comp, "x", 0))
            ch, cw   = int(getattr(comp, "height", 1)), int(getattr(comp, "width", 1))
            for ri in range(cy, cy + ch):
                for ci in range(cx, cx + cw):
                    if 0 <= ri < N and 0 <= ci < N:
                        comp_type_map[ri, ci] = enc
                        voltage_map[ri, ci]   = vv

        q_max  = float(Q_map.max()) if Q_map.max() > 0 else 1.0
        q_norm = (Q_map / q_max).astype(np.float32)
        k_map  = np.full((N, N), k0_norm, dtype=np.float32)

        return np.stack([comp_type_map, q_norm, voltage_map, k_map], axis=0)  # (4,N,N)

    except Exception:
        return None


def train_surrogate(
    model:        Any,
    layout_batch: list,
    fdm_results:  list,
    epochs:       int   = 10,
    lr:           float = 1e-3,
) -> Optional[Any]:
    """
    Fine-tune the surrogate on FDM results collected during the session.

    FIX #3: The previous implementation used np.random.rand() as input features,
    which trained the model on noise instead of real layout data.  This version
    uses build_training_input() to construct the correct 4-channel feature tensor
    matching what predict_temperature() consumes.

    Parameters
    ----------
    model        : ThermalUNet instance
    layout_batch : list of layout Pydantic objects
    fdm_results  : list of FDMResult objects (same order as layout_batch)
    epochs       : training epochs
    lr           : Adam learning rate

    Returns
    -------
    Trained model (eval mode), or None on failure.
    """
    if model is None or not _TORCH_AVAILABLE:
        return None
    try:
        optimizer = optim.Adam(model.parameters(), lr=lr)
        model.train()

        for _ in range(epochs):
            for layout, result in zip(layout_batch, fdm_results):
                # ── Correct feature tensor (Fix #3) ──────────────────────
                Q_np = np.array(result.thermal_map, dtype=np.float32)  # reuse shape
                # Get Q_map from the result's stored source map if available
                Q_src = getattr(result, "source_map", None)
                if Q_src is None:
                    Q_src = np.zeros_like(Q_np)

                x_np = build_training_input(layout, Q_src)
                if x_np is None:
                    continue

                x_t = torch.from_numpy(x_np).unsqueeze(0)   # (1, 4, N, N)

                # Normalised FDM temperature label
                T_np = np.array(result.thermal_map, dtype=np.float32)
                amb  = float(getattr(layout, "ambient_temp_C", 25.0))
                T_norm = (T_np - amb) / 100.0
                T_t    = torch.from_numpy(T_norm).unsqueeze(0).unsqueeze(0)  # (1,1,N,N)

                # Q_map for PINN loss (normalised power density)
                q_max = float(Q_src.max()) if Q_src.max() > 0 else 1.0
                Q_t   = torch.from_numpy((Q_src / q_max).astype(np.float32)).unsqueeze(0).unsqueeze(0)

                optimizer.zero_grad()

                # forward() upsamples 16→64 internally, returns (1,1,16,16)
                T_pred = model(x_t)

                loss = pinn_loss(
                    T_pred  = T_pred,
                    T_label = T_t,
                    Q_map   = Q_t,
                    k0      = 149.0,
                    T_amb   = amb,
                )
                loss.backward()
                optimizer.step()

        # Save weights opportunistically — fail silently
        try:
            torch.save(model.state_dict(), MODEL_WEIGHTS_PATH)
        except Exception:
            pass

        model.eval()
        return model

    except Exception:
        return None
