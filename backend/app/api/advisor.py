from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Any
import os
import json
from google import genai
from ..config import settings

router = APIRouter()

# Setup GenAI client globally
client = None
if settings.GEMINI_API_KEY:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

class ComponentData(BaseModel):
    id: str
    type: str
    x: int
    y: int
    w: int
    h: int

class ComponentRequest(BaseModel):
    component: ComponentData
    temperature: float

class BoardRequest(BaseModel):
    components: List[ComponentData]
    max_temp: float
    score: int

def get_client():
    if not client:
        raise HTTPException(status_code=503, detail="Gemini API Key is not configured in backend .env")
    return client

@router.post("/component")
async def analyze_component(req: ComponentRequest, ai_client: genai.Client = Depends(get_client)):
    try:
        prompt = f"""
You are an expert semiconductor layout AI ('Ignis AI Advisor').
Analyze this single semiconductor block:
Type: {req.component.type}
Location: ({req.component.x}, {req.component.y})
Operating Temperature: {req.temperature:.1f} °C

Provide a crisp, actionable 1-sentence recommendation to optimize thermal dissipation, prevent failure, or acknowledge safe operation. 
Be highly technical but concise. Do not use Markdown formatting in the response.
        """
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return {"advice": response.text.strip()}
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get advice from Gemini API")

@router.post("/board")
async def analyze_board(req: BoardRequest, ai_client: genai.Client = Depends(get_client)):
    try:
        # Convert list of pydantic models to list of dicts for JSON serialization
        comps = [c.model_dump() for c in req.components]
        comps_json = json.dumps(comps)
        
        prompt = f"""
You are 'Ignis AI Advisor', an expert semiconductor layout thermal simulator.
Analyze this entire chip floorplan.
Total Physics Score: {req.score}/1000
Max Die Temperature: {req.max_temp:.1f} °C
Components placed:
{comps_json}

Provide a 2-sentence actionable insight on how the user can improve their floorplan to reduce overlapping heat islands and improve their Physics Score. Focus on spatial arrangement (e.g. moving memory between CPUs, shifting GPUs to edges).
Be highly technical but concise. Do not use Markdown formatting in the response.
        """
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return {"advice": response.text.strip()}
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get advice from Gemini API")
