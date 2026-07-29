"""
data_generator.py
=================
Utility to generate synthetic chip layouts for testing and for training the
surrogate model.  Generates realistic layouts with randomly placed components
from the supported component type palette.
"""

import random
import uuid
from typing import List, Dict, Any

from app.physics.physics_laws import COMPONENT_DEFAULTS


# ---------------------------------------------------------------------------
# Synthetic component factory
# ---------------------------------------------------------------------------

def _random_component(
    comp_id:  str,
    comp_type: str,
    x:        int,
    y:        int,
    width:    int = 2,
    height:   int = 2,
) -> Dict[str, Any]:
    """Build a component dict with defaults + small random variation."""
    defaults = COMPONENT_DEFAULTS.get(comp_type, COMPONENT_DEFAULTS["cpu_core"])
    power  = defaults["power_mW"] * random.uniform(0.8, 1.2)
    volt   = defaults["voltage_V"]
    freq   = defaults["freq_GHz"] * random.uniform(0.9, 1.1)
    alpha  = defaults["switching_activity"] * random.uniform(0.7, 1.3)
    alpha  = max(0.05, min(1.0, alpha))
    return {
        "id":               comp_id,
        "type":             comp_type,
        "x":                x,
        "y":                y,
        "width":            width,
        "height":           height,
        "power_mW":         round(power, 1),
        "voltage_V":        volt,
        "freq_GHz":         round(freq, 2),
        "switching_activity": round(alpha, 2),
    }


def generate_random_layout(
    grid_size:    int   = 16,
    cell_size_mm: float = 1.0,
    n_components: int   = None,
    material:     str   = "silicon",
    seed:         int   = None,
) -> Dict[str, Any]:
    """
    Generate a random, non-overlapping chip layout for testing.

    Parameters
    ----------
    grid_size    : number of cells along each axis (square grid)
    cell_size_mm : physical size of each cell in mm
    n_components : number of components to place (default: random 3–8)
    material     : substrate material key
    seed         : random seed for reproducibility

    Returns
    -------
    layout dict matching the LayoutInput schema
    """
    if seed is not None:
        random.seed(seed)

    if n_components is None:
        n_components = random.randint(3, 8)

    comp_types = list(COMPONENT_DEFAULTS.keys())
    occupied   = set()
    components = []

    attempts = 0
    while len(components) < n_components and attempts < 200:
        attempts += 1
        ctype  = random.choice(comp_types)
        width  = random.choice([1, 2, 2, 3])
        height = random.choice([1, 2, 2, 3])
        x      = random.randint(0, grid_size - width)
        y      = random.randint(0, grid_size - height)

        # Check for overlap
        cells = {(ci, cj) for ci in range(y, y + height) for cj in range(x, x + width)}
        if cells & occupied:
            continue

        occupied |= cells
        comp_id   = f"comp-{uuid.uuid4().hex[:6]}"
        components.append(_random_component(comp_id, ctype, x, y, width, height))

    return {
        "grid_size":    grid_size,
        "cell_size_mm": cell_size_mm,
        "components":   components,
        "material":     material,
        "ambient_temp_C": 25.0,
        "fan_speed_rpm":  random.choice([0, 1000, 2000, 3000, 4000]),
        "heatsink_type":  random.choice(["none", "standard", "premium"]),
    }


def generate_training_batch(
    n_samples:    int   = 100,
    grid_size:    int   = 16,
    seed:         int   = 42,
) -> List[Dict[str, Any]]:
    """
    Generate a batch of random layouts for surrogate model training.

    Parameters
    ----------
    n_samples : number of layouts to generate
    grid_size : grid size for all layouts
    seed      : base random seed

    Returns
    -------
    List of layout dicts
    """
    return [
        generate_random_layout(grid_size=grid_size, seed=seed + i)
        for i in range(n_samples)
    ]
