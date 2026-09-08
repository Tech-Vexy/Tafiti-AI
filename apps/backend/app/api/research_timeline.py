"""
Tafiti AI — Research Timeline API
Chronological visualization of how a research field evolved over time.
Inspired by ResearchRabbit's timeline views and Undermind's field evolution maps.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("research_timeline_api")
router = APIRouter()


class TimelineRequest(BaseModel):
    topic: str = Field(..., description="Research topic or field to map timeline for.")
    start_year: Optional[int] = Field(None, description="Start year for timeline (default: auto-detect).")
    end_year: Optional[int] = Field(None, description="End year for timeline (default: current year).")
    max_milestones: int = Field(15, description="Maximum number of milestones to generate.", ge=5, le=30)


class TimelineMilestone(BaseModel):
    year: int
    title: str
    description: str
    category: str  # discovery, methodology, breakthrough, review, controversy
    key_papers: List[Dict[str, str]] = []  # title, authors, journal
    impact_score: float  # 0-1
    citations_count: Optional[int] = None


class TimelineResponse(BaseModel):
    topic: str
    start_year: int
    end_year: int
    milestones: List[TimelineMilestone]
    summary: str
    key_themes: List[str]
    current_directions: List[str]
    suggested_reading: List[Dict[str, str]]


def _build_model(provider: str = "nvidia", model_id: Optional[str] = None):
    """Constructs LLM model client based on environment configuration, defaulting backend timeline analysis to Nvidia NIM."""
    prov = provider or getattr(settings, "DEFAULT_LLM_PROVIDER", "nvidia")
    if prov == "nvidia":
        from agno.models.openai import OpenAIChat
        return OpenAIChat(
            id=model_id or settings.NVIDIA_DEFAULT_MODEL,
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.nvidia_api_key,
        )
    elif prov == "gemini":
        from agno.models.google import Gemini
        return Gemini(id=model_id or settings.GEMINI_DEFAULT_MODEL)
    elif prov == "openrouter":
        from agno.models.openai import OpenAIChat
        mid = model_id or settings.OPENROUTER_DEFAULT_MODEL
        if ":" in mid:
            mid = mid.split(":", 1)[1]
        return OpenAIChat(
            id=mid,
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY,
        )
    else:
        from agno.models.openai import OpenAIChat
        return OpenAIChat(
            id=model_id or settings.NVIDIA_DEFAULT_MODEL,
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.nvidia_api_key,
        )


@router.post("/timeline", response_model=TimelineResponse)
async def generate_research_timeline(
    payload: TimelineRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generates a chronological research timeline showing how a field evolved,
    with key milestones, breakthroughs, and current research directions.
    """
    from agno.agent import Agent
    import json
    import datetime

    system_prompt = (
        "You are an expert research historian and bibliometric analyst.\n"
        "Generate a detailed chronological research timeline for the given topic.\n"
        "Guidelines:\n"
        "1. Identify 8-15 key milestones spanning the history of this field.\n"
        "2. Each milestone should have: year, title, description, category "
        "(discovery/methodology/breakthrough/review/controversy), impact_score (0-1).\n"
        "3. Include 1-3 representative papers per milestone with title, authors, and journal.\n"
        "4. Provide a narrative summary of how the field evolved.\n"
        "5. List key recurring themes and current research directions.\n"
        "6. Suggest 3-5 essential reading papers for understanding the field.\n"
        "7. Respond STRICTLY in valid JSON matching the schema:\n"
        "   {\"milestones\": [{\"year\": int, \"title\": str, \"description\": str, \"category\": str, "
        "\"key_papers\": [{\"title\": str, \"authors\": str, \"journal\": str}], \"impact_score\": float}], "
        "\"summary\": str, \"key_themes\": [str], \"current_directions\": [str], "
        "\"suggested_reading\": [{\"title\": str, \"authors\": str, \"journal\": str, \"year\": int}]}\n"
        "Do NOT include markdown fences."
    )

    now = datetime.datetime.now()
    end = payload.end_year or now.year
    start = payload.start_year or max(1950, end - 50)

    user_query = (
        f"Topic: {payload.topic}\n"
        f"Timeline range: {start} to {end}\n"
        f"Maximum milestones: {payload.max_milestones}\n"
        f"Focus on African and Global South perspectives where relevant."
    )

    try:
        model = _build_model()
        agent = Agent(model=model, system_message=system_prompt, markdown=False)
        res_content = getattr(response, "content", None)
        content = str(res_content) if res_content is not None else str(response or "")

        content_clean = content.strip()
        if content_clean.startswith("```json"):
            content_clean = content_clean[7:]
        if content_clean.startswith("```"):
            content_clean = content_clean[3:]
        if content_clean.endswith("```"):
            content_clean = content_clean[:-3]
        content_clean = content_clean.strip()

        data = json.loads(content_clean)

        milestones = []
        for m in data.get("milestones", []):
            milestones.append(TimelineMilestone(
                year=m.get("year", start),
                title=m.get("title", ""),
                description=m.get("description", ""),
                category=m.get("category", "discovery"),
                key_papers=m.get("key_papers", []),
                impact_score=min(1.0, max(0.0, m.get("impact_score", 0.5))),
                citations_count=m.get("citations_count"),
            ))

        milestones.sort(key=lambda x: x.year)

        return TimelineResponse(
            topic=payload.topic,
            start_year=start,
            end_year=end,
            milestones=milestones,
            summary=data.get("summary", ""),
            key_themes=data.get("key_themes", []),
            current_directions=data.get("current_directions", []),
            suggested_reading=data.get("suggested_reading", []),
        )

    except Exception as e:
        logger.error(f"Failed to generate timeline: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate research timeline: {str(e)}",
        )


@router.get("/timeline/categories")
async def list_timeline_categories(
    current_user: dict = Depends(get_current_user),
):
    """Returns available milestone categories for filtering."""
    return {
        "categories": [
            {"id": "discovery", "label": "Discovery", "color": "#10b981", "icon": "Lightbulb"},
            {"id": "methodology", "label": "Methodology", "color": "#6366f1", "icon": "FlaskConical"},
            {"id": "breakthrough", "label": "Breakthrough", "color": "#f59e0b", "icon": "Zap"},
            {"id": "review", "label": "Systematic Review", "color": "#818cf8", "icon": "BookOpen"},
            {"id": "controversy", "label": "Controversy/Debate", "color": "#f43f5e", "icon": "AlertTriangle"},
        ]
    }
