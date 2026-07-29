# ChipPulse AI

## Key Features

- **Interactive Chip Canvas:** Drag and drop CPU cores, GPU clusters, memory controllers, and more onto a 16x16 mm silicon die.
- **Real-Time Physics Engine:** A custom Python backend runs Fourier's Law and Robin Boundary Conditions to calculate thermal conductivity, joule heating, Z-axis heat sinks, and electromigration risks.
- **Ignis AI Advisor:** Powered by the Google Gemini API, the AI advisor analyzes your layout's thermal metrics, identifies bottlenecks, and provides specific recommendations for component placement to lower temperatures and improve yields.
- **Thermal Heat Map:** Visualize exactly where your chip is overheating with a dynamic, glowing thermal gradient overlay.
- **Rich Analytics:** View comprehensive metrics including Total Power (W), Peak Junction Temperature (°C), Spatial Thermal Gradients, and an overall Physics Score.

## Tech Stack

- **Frontend:** React, Vite, Vanilla CSS (Glassmorphism & Dark Mode)
- **Backend:** Python, FastAPI, Uvicorn, NumPy (for FDM Physics matrices)
- **AI Integration:** Google GenAI SDK (`google-genai`)

## Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- Python (3.9 or higher)
- A Google Gemini API Key

### 1. Clone the repository
```bash
git clone https://github.com/harshal0508/ChipPulse-AI.git
cd ChipPulse-AI
```

### 2. Backend Setup
Navigate to the backend directory, set up your Python environment, and install dependencies:

```bash
cd backend
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
```

**Configure Environment Variables:**
Create a `.env` file in the `backend/` directory and add your Gemini API key:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
```

**Start the API Server:**
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
Open a new terminal window, navigate to the frontend directory, and install dependencies:

```bash
cd frontend
npm install
```

**Start the Development Server:**
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Usage

1. **Place Components:** Open the workspace and drag components from the library onto the silicon grid.
2. **Tune Power:** Select a component to tweak its power (mW) and clock frequency.
3. **Run Simulation:** Click the **Run Physics** button to trigger the FDM solver on the backend.
4. **View Thermal Map:** Once the simulation completes, toggle the **Thermal Map** overlay to see the heat distribution.
5. **Ask AI:** Click **AI Layout Analysis** to have Gemini review your floorplan and suggest thermal optimizations.

# License

This project is licensed under the MIT License - see the LICENSE file for details.
