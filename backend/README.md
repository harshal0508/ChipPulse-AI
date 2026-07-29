# ChipPulse AI — Backend

**Physics-Informed Thermal Layout Optimizer for semiconductor chip design.**

A FastAPI backend that simulates thermal behaviour, IR drop, and electromigration risk in a 2-D chip layout using a Gauss-Seidel finite-difference method (FDM) that simultaneously enforces 7 fundamental semiconductor physics laws.

---

## Quick Start

```bash
# 1. Clone / navigate to the backend directory
cd chippulse-ai/backend

# 2. Create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy and configure environment
copy .env.example .env   # Windows
cp .env.example .env     # macOS / Linux
# Edit .env if needed (SQLite works out of the box)

# 5. Run the development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive API docs.

---

## Project Structure

```
backend/
├── app/
│   ├── main.py            # FastAPI app factory + lifespan
│   ├── config.py          # Pydantic-settings configuration
│   ├── database.py        # Async SQLAlchemy engine + session DI
│   ├── api/
│   │   ├── simulate.py    # POST /api/v1/simulate
│   │   ├── projects.py    # CRUD  /api/v1/projects
│   │   └── health.py      # GET   /api/v1/health
│   ├── physics/
│   │   ├── physics_laws.py    # All 7 physics laws as pure functions
│   │   ├── fdm_solver.py      # Gauss-Seidel FDM solver
│   │   ├── surrogate_model.py # U-Net PINN surrogate (optional)
│   │   └── data_generator.py  # Synthetic layout generator
│   └── models/
│       ├── schemas.py     # Pydantic v2 request / response models
│       └── db_models.py   # SQLAlchemy ORM models
├── requirements.txt
├── .env.example
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/simulate` | Run full physics simulation |
| `GET`  | `/api/v1/projects` | List projects for a session |
| `POST` | `/api/v1/projects` | Create a new project |
| `GET`  | `/api/v1/projects/{id}` | Retrieve a project |
| `DELETE` | `/api/v1/projects/{id}` | Delete a project |
| `GET`  | `/api/v1/health` | Service health check |

---

## Physics Engine

All 7 laws are applied **simultaneously** in each Gauss-Seidel iteration:

| # | Law | Implementation |
|---|-----|----------------|
| 1 | **Joule Heating** | `Q = J² · ρ(T)` with temperature-dependent resistivity |
| 2 | **Non-Linear Fourier Conduction** | `div(k(T)∇T) + Q = 0`, `k(T) = k₀/(1 + β·ΔT)` |
| 3 | **Robin BC (Convection)** | Ghost-node formulation at all 4 chip edges |
| 4 | **Z-Axis Conduction** | Junction-to-case sink `Q_z = ΔT / R_th_jc` |
| 5 | **Dynamic + Static Power** | `P = αCVf + I_leak·V` |
| 6 | **IR Drop** | `ΔV = I·R_wire·dist`, modulates cell source term |
| 7 | **Electromigration** | Black's Equation post-process risk score |

### Materials

| Material | k₀ (W/m·K) | β (K⁻¹) |
|----------|-----------|---------|
| silicon  | 149       | 0.003   |
| gaas     | 46        | 0.002   |
| diamond  | 2200      | 0.001   |
| sic      | 490       | 0.0025  |

---

## Simulation Example (curl)

```bash
curl -X POST http://localhost:8000/api/v1/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "my-session-123",
    "layout": {
      "grid_size": 16,
      "cell_size_mm": 1.0,
      "components": [
        {
          "id": "cpu-1",
          "type": "cpu_core",
          "x": 4, "y": 4,
          "width": 2, "height": 2,
          "power_mW": 250,
          "voltage_V": 1.2,
          "freq_GHz": 3.2,
          "switching_activity": 0.3
        }
      ],
      "material": "silicon",
      "ambient_temp_C": 25.0,
      "fan_speed_rpm": 2000,
      "heatsink_type": "standard"
    },
    "solver_config": {
      "max_iterations": 500,
      "convergence_delta": 0.01,
      "use_surrogate": false
    }
  }'
```

---

## Optional: U-Net Surrogate Model

If PyTorch is installed and `unet_thermal.pth` exists in the backend root, the
surrogate model can be used for much faster predictions (set `use_surrogate: true`).
The surrogate automatically falls back to the FDM solver if weights are missing.

Install PyTorch (CPU):
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

---

## Database

Default: **SQLite** (`chippulse.db`) – created automatically on first run.

For PostgreSQL, set in `.env`:
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/chippulse
```
and install `asyncpg`:
```bash
pip install asyncpg
```

Tables are created automatically at startup via `Base.metadata.create_all`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./chippulse.db` | Database connection string |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed CORS origins |
| `THERMAL_THROTTLE_TEMP_C` | `90.0` | Thermal violation threshold (°C) |
| `EM_RISK_THRESHOLD` | `0.7` | Electromigration risk threshold |
| `MAX_ITERATIONS` | `500` | Default FDM max iterations |
| `CONVERGENCE_DELTA` | `0.01` | Default convergence criterion |
| `DEBUG` | `false` | Enable SQLAlchemy query logging |
