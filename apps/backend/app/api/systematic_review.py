"""
Tafiti AI — Systematic Review Tools API
PRISMA-compliant screening, PICO extraction, inclusion/exclusion criteria,
and systematic review workflow management.
Inspired by Rayyan.ai and SWIFT-Review.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from enum import Enum

from app.core.config import settings
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("systematic_review_api")
router = APIRouter()


class ScreeningDecision(str, Enum):
    INCLUDE = "include"
    EXCLUDE = "exclude"
    UNCERTAIN = "uncertain"


class PICOExtractionRequest(BaseModel):
    research_question: str = Field(..., description="The research question to frame in PICO format.")
    context: Optional[str] = Field(None, description="Additional context about the domain.")


class ScreeningRequest(BaseModel):
    research_question: str = Field(..., description="The research question for screening criteria.")
    inclusion_criteria: List[str] = Field(default_factory=list, description="Existing inclusion criteria.")
    exclusion_criteria: List[str] = Field(default_factory=list, description="Existing exclusion criteria.")
    context: Optional[str] = Field(None, description="Domain-specific context.")


class ScreenPaperRequest(BaseModel):
    paper_title: str = Field(..., description="Title of the paper to screen.")
    paper_abstract: str = Field(..., description="Abstract of the paper to screen.")
    inclusion_criteria: List[str] = Field(..., description="Inclusion criteria to evaluate against.")
    exclusion_criteria: List[str] = Field(..., description="Exclusion criteria to evaluate against.")


class PRISMAFlowRequest(BaseModel):
    total_identified: int = Field(..., description="Total records identified from databases.", ge=0)
    duplicates_removed: int = Field(0, description="Records removed as duplicates.", ge=0)
    title_screened: int = Field(0, description="Records screened by title/abstract.", ge=0)
    full_text_assessed: int = Field(0, description="Full-text articles assessed.", ge=0)
    excluded_with_reasons: Optional[Dict[str, int]] = Field(None, description="Exclusion reasons and counts.")
    studies_included: int = Field(0, description="Studies included in final review.", ge=0)


class PICOElement(BaseModel):
    element: str  # P, I, C, O
    description: str
    search_terms: List[str] = []


class PICOExtractionResponse(BaseModel):
    population: PICOElement
    intervention: PICOElement
    comparison: Optional[PICOElement] = None
    outcome: PICOElement
    research_question_formatted: str
    suggested_databases: List[str]
    suggested_filters: List[str]


class ScreeningCriteriaResponse(BaseModel):
    inclusion_criteria: List[Dict[str, str]]
    exclusion_criteria: List[Dict[str, str]]
    prisma_flow_suggestions: List[str]
    quality_checklist: List[Dict[str, str]]


class ScreenedPaperResponse(BaseModel):
    title: str
    decision: str
    confidence: float  # 0-1
    rationale: str
    matched_inclusion: List[str]
    matched_exclusion: List[str]
    notes: str


def _build_model(provider: str = "nvidia", model_id: Optional[str] = None):
    """Constructs LLM model client based on environment configuration, defaulting backend extraction to Nvidia NIM."""
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


@router.post("/pico-extract", response_model=PICOExtractionResponse)
async def extract_pico(
    payload: PICOExtractionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Extracts PICO (Population, Intervention, Comparison, Outcome) elements
    from a research question, with suggested search terms and databases.
    """
    from agno.agent import Agent
    import json

    system_prompt = (
        "You are an expert systematic review methodologist.\n"
        "Extract PICO elements from the research question.\n"
        "For each element provide:\n"
        "- element: the PICO letter (P/I/C/O)\n"
        "- description: detailed description\n"
        "- search_terms: 5-8 academic database search terms and keywords\n\n"
        "Also suggest appropriate databases and search filters.\n"
        "Respond STRICTLY in valid JSON:\n"
        "{\"population\": {\"element\": \"P\", \"description\": str, \"search_terms\": [str]},\n"
        " \"intervention\": {\"element\": \"I\", \"description\": str, \"search_terms\": [str]},\n"
        " \"comparison\": {\"element\": \"C\", \"description\": str, \"search_terms\": [str]} | null,\n"
        " \"outcome\": {\"element\": \"O\", \"description\": str, \"search_terms\": [str]},\n"
        " \"research_question_formatted\": str,\n"
        " \"suggested_databases\": [str],\n"
        " \"suggested_filters\": [str]}\n"
        "Do NOT include markdown fences."
    )

    user_query = (
        f"Research Question: {payload.research_question}\n"
        f"Context: {payload.context or 'Academic research, systematic review'}"
    )

    try:
        model = _build_model()
        agent = Agent(model=model, system_message=system_prompt, markdown=False)
        response = agent.run(user_query)
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

        return PICOExtractionResponse(
            population=PICOElement(**data["population"]),
            intervention=PICOElement(**data["intervention"]),
            comparison=PICOElement(**data.get("comparison", {"element": "C", "description": "N/A", "search_terms": []})) if data.get("comparison") else None,
            outcome=PICOElement(**data["outcome"]),
            research_question_formatted=data.get("research_question_formatted", payload.research_question),
            suggested_databases=data.get("suggested_databases", ["CORE", "OpenAlex", "Scopus", "Web of Science"]),
            suggested_filters=data.get("suggested_filters", []),
        )

    except Exception as e:
        logger.error(f"PICO extraction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract PICO elements: {str(e)}",
        )


@router.post("/screening-criteria", response_model=ScreeningCriteriaResponse)
async def generate_screening_criteria(
    payload: ScreeningRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generates PRISMA-compliant inclusion/exclusion criteria and a quality
    assessment checklist for a systematic review.
    """
    from agno.agent import Agent
    import json

    system_prompt = (
        "You are an expert systematic review methodologist following PRISMA 2020 guidelines.\n"
        "Generate inclusion and exclusion criteria, PRISMA flow suggestions, and a quality checklist.\n"
        "For each criterion, provide: 'text' (the criterion) and 'rationale' (why it's important).\n"
        "Respond STRICTLY in valid JSON:\n"
        "{\"inclusion_criteria\": [{\"text\": str, \"rationale\": str}],\n"
        " \"exclusion_criteria\": [{\"text\": str, \"rationale\": str}],\n"
        " \"prisma_flow_suggestions\": [str],\n"
        " \"quality_checklist\": [{\"text\": str, \"rationale\": str}]}\n"
        "Do NOT include markdown fences."
    )

    user_query = (
        f"Research Question: {payload.research_question}\n"
        f"Existing Inclusion Criteria: {payload.inclusion_criteria or 'None provided'}\n"
        f"Existing Exclusion Criteria: {payload.exclusion_criteria or 'None provided'}\n"
        f"Context: {payload.context or 'Systematic review'}"
    )

    try:
        model = _build_model()
        agent = Agent(model=model, system_message=system_prompt, markdown=False)
        response = agent.run(user_query)
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

        return ScreeningCriteriaResponse(
            inclusion_criteria=data.get("inclusion_criteria", []),
            exclusion_criteria=data.get("exclusion_criteria", []),
            prisma_flow_suggestions=data.get("prisma_flow_suggestions", []),
            quality_checklist=data.get("quality_checklist", []),
        )

    except Exception as e:
        logger.error(f"Screening criteria generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate screening criteria: {str(e)}",
        )


@router.post("/screen-paper", response_model=ScreenedPaperResponse)
async def screen_single_paper(
    payload: ScreenPaperRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Screens a single paper against inclusion/exclusion criteria,
    returning a decision with rationale (AI-assisted title/abstract screening).
    """
    from agno.agent import Agent
    import json

    system_prompt = (
        "You are an expert systematic reviewer screening papers for inclusion.\n"
        "Evaluate the paper against the provided criteria and make a screening decision.\n"
        "Respond STRICTLY in valid JSON:\n"
        "{\"decision\": \"include\" | \"exclude\" | \"uncertain\",\n"
        " \"confidence\": float (0-1),\n"
        " \"rationale\": str,\n"
        " \"matched_inclusion\": [str],\n"
        " \"matched_exclusion\": [str],\n"
        " \"notes\": str}\n"
        "Do NOT include markdown fences."
    )

    user_query = (
        f"Paper Title: {payload.paper_title}\n"
        f"Abstract: {payload.paper_abstract}\n\n"
        f"Inclusion Criteria:\n" + "\n".join(f"- {c}" for c in payload.inclusion_criteria) + "\n\n"
        f"Exclusion Criteria:\n" + "\n".join(f"- {c}" for c in payload.exclusion_criteria)
    )

    try:
        model = _build_model()
        agent = Agent(model=model, system_message=system_prompt, markdown=False)
        response = agent.run(user_query)
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

        return ScreenedPaperResponse(
            title=payload.paper_title,
            decision=data.get("decision", "uncertain"),
            confidence=min(1.0, max(0.0, data.get("confidence", 0.5))),
            rationale=data.get("rationale", ""),
            matched_inclusion=data.get("matched_inclusion", []),
            matched_exclusion=data.get("matched_exclusion", []),
            notes=data.get("notes", ""),
        )

    except Exception as e:
        logger.error(f"Paper screening failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to screen paper: {str(e)}",
        )


@router.post("/prisma-flow")
async def generate_prisma_flow(
    payload: PRISMAFlowRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generates a PRISMA 2020 flow diagram data structure from provided counts.
    """
    after_dupes = payload.total_identified - payload.duplicates_removed
    after_title_screen = after_dupes - payload.title_screened
    reasons = payload.excluded_with_reasons or {}
    total_excluded = sum(reasons.values())
    after_full_text = payload.full_text_assessed - total_excluded

    flow = {
        "identification": {
            "total_identified": payload.total_identified,
            "databases": payload.total_identified,
        },
        "screening": {
            "after_duplicate_removal": max(0, after_dupes),
            "records_screened": payload.title_screened,
            "records_excluded": max(0, after_dupes - payload.full_text_assessed),
        },
        "eligibility": {
            "full_text_assessed": payload.full_text_assessed,
            "full_text_excluded": total_excluded,
            "exclusion_reasons": reasons,
        },
        "included": {
            "studies_included": payload.studies_included,
            "quantitative_synthesis": payload.studies_included,
        },
        "summary": {
            "yield_rate": f"{(payload.studies_included / max(1, payload.total_identified) * 100):.1f}%",
            "total_screened": payload.total_identified,
            "total_included": payload.studies_included,
        }
    }

    return flow


@router.get("/prisma-template")
async def get_prisma_template(
    current_user: dict = Depends(get_current_user),
):
    """Returns a blank PRISMA 2020 flow template with field descriptions."""
    return {
        "template": {
            "identification": {
                "total_identified": {"label": "Total records identified from databases", "type": "number", "required": True},
            },
            "screening": {
                "duplicates_removed": {"label": "Records removed as duplicates", "type": "number"},
                "title_screened": {"label": "Records screened by title/abstract", "type": "number"},
                "title_excluded": {"label": "Records excluded at title/abstract stage", "type": "number"},
            },
            "eligibility": {
                "full_text_assessed": {"label": "Full-text articles assessed for eligibility", "type": "number"},
                "excluded_reasons": {"label": "Excluded with reasons", "type": "dict", "keys": [
                    "Wrong population", "Wrong intervention", "Wrong outcome",
                    "Wrong study design", "Wrong publication type", "Other"
                ]},
            },
            "included": {
                "final_studies": {"label": "Studies included in final synthesis", "type": "number"},
                "meta_analysis": {"label": "Studies in quantitative synthesis (meta-analysis)", "type": "number"},
            }
        },
        "notes": [
            "PRISMA 2020 allows灵活 reporting of automated vs manual screening.",
            "Report inter-rater reliability (Cohen's κ) if applicable.",
            "Consider using Tafiti AI's screen-paper endpoint for AI-assisted screening.",
        ]
    }
