"""
AI-Powered Thesis Outline Generator — generates structured outlines
from a research topic with sections, subsections, and suggested content.

Endpoints:
  POST /outline/generate   — generate a thesis outline from a topic
  POST /outline/refine     — refine/expand an existing outline
  POST /outline/to-sfdt    — convert outline to Syncfusion SFDT format for insertion
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from agno.agent import Agent

from app.core.config import settings
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("outline_generator")
router = APIRouter()


# ---------------------------------------------------------------------------
# Model builder
# ---------------------------------------------------------------------------

def _build_model(provider: str = "nvidia", model_id: Optional[str] = None):
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


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class OutlineSection(BaseModel):
    title: str
    content_suggestion: str = ""
    subsections: list["OutlineSubSection"] = []


class OutlineSubSection(BaseModel):
    title: str
    content_suggestion: str = ""


# Resolve forward reference
OutlineSection.model_rebuild()


class OutlineGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=5, max_length=500, description="Research topic or thesis title")
    discipline: Optional[str] = Field(None, max_length=200, description="Academic discipline (e.g., Computer Science, Biology)")
    num_sections: Optional[int] = Field(default=5, ge=3, le=12, description="Number of main sections")
    style: Optional[str] = Field(default="argumentative", description="Thesis style: argumentative, expository, analytical, narrative")
    language: Optional[str] = Field("English", description="Output language")
    include_page_estimate: Optional[bool] = Field(default=True, description="Include estimated page counts per section")


class OutlineRefineRequest(BaseModel):
    topic: str = Field(..., min_length=5, max_length=500)
    current_outline: list[OutlineSection] = Field(..., description="Current outline to refine")
    instruction: str = Field(..., min_length=5, max_length=2000, description="How to refine the outline")
    language: Optional[str] = Field("English")


class OutlineGenerateResponse(BaseModel):
    topic: str
    title_suggestion: str
    abstract_suggestion: str
    sections: list[OutlineSection]
    key_questions: list[str]
    methodology_hint: str
    estimated_total_pages: int


class OutlineRefineResponse(BaseModel):
    topic: str
    title_suggestion: str
    abstract_suggestion: str
    sections: list[OutlineSection]
    key_questions: list[str]
    methodology_hint: str
    estimated_total_pages: int
    changes_summary: str


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

def _outline_system_prompt(
    num_sections: Optional[int] = 5,
    style: Optional[str] = "argumentative",
    language: Optional[str] = "English",
    include_pages: Optional[bool] = True,
) -> str:
    n_sec = num_sections if num_sections is not None else 5
    st = style if style is not None else "argumentative"
    lang_str = language if language is not None else "English"
    inc_p = True if include_pages is None else include_pages
    lang = "" if lang_str.lower() in ("english", "en") else f"Write all content in {lang_str}."
    page_hint = (
        "Include an 'estimated_pages' integer for each section (realistic for a 60-100 page thesis). "
        "Include an 'estimated_total_pages' integer for the whole thesis."
        if inc_p else
        "Do NOT include page estimates."
    )

    return f"""You are an expert academic research advisor and thesis writing coach. 
Your task is to generate a comprehensive, well-structured thesis outline for a given research topic.

The thesis style is: {st}
{lang}

REQUIREMENTS:
- Generate exactly {n_sec} main sections (plus optional Introduction and Conclusion if the style warrants it)
- Each section must have 2-4 subsections
- Each section and subsection must have a detailed 'content_suggestion' (3-5 sentences describing what to cover)
- Content suggestions should be specific, actionable, and academically rigorous
- Include specific theories, frameworks, methodologies, or case studies where appropriate
- The outline should follow a logical progression from background → methodology → analysis → findings → conclusion

OUTPUT FORMAT: Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{{
  "title_suggestion": "A compelling thesis title",
  "abstract_suggestion": "A 3-4 sentence abstract draft",
  "sections": [
    {{
      "title": "Section Title",
      "content_suggestion": "Detailed description of what this section covers...",
      "subsections": [
        {{
          "title": "Subsection Title", 
          "content_suggestion": "What this subsection covers..."
        }}
      ],
      "estimated_pages": 8
    }}
  ],
  "key_questions": ["Research question 1", "Research question 2"],
  "methodology_hint": "Suggested methodology approach",
  "estimated_total_pages": 75
}}

{page_hint}

Be thorough, specific, and academically rigorous. Think like a thesis committee chair reviewing a proposal."""


def _refine_system_prompt(language: str) -> str:
    lang = "" if language.lower() in ("english", "en") else f"Write all content in {language}."
    return f"""You are an expert academic thesis advisor. The user has an existing thesis outline and wants to refine it.
{lang}

Analyze the current outline and apply the user's refinement instruction.
Preserve the overall structure but modify as requested.

OUTPUT FORMAT: Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{{
  "title_suggestion": "Updated thesis title",
  "abstract_suggestion": "Updated abstract",
  "sections": [
    {{
      "title": "Section Title",
      "content_suggestion": "Detailed description...",
      "subsections": [
        {{
          "title": "Subsection Title",
          "content_suggestion": "What this covers..."
        }}
      ],
      "estimated_pages": 8
    }}
  ],
  "key_questions": ["Research question 1", "Research question 2"],
  "methodology_hint": "Suggested methodology",
  "estimated_total_pages": 75,
  "changes_summary": "Brief description of what was changed and why"
}}

Be specific and maintain academic rigor."""


# ---------------------------------------------------------------------------
# Helper: parse JSON from LLM response
# ---------------------------------------------------------------------------

def _parse_outline_json(raw: Optional[str]) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks."""
    if not raw:
        raise ValueError("Empty response received from LLM")
    text = raw.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (fences)
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        elif lines[0].strip().startswith("```"):
            lines = lines[1:]
        text = "\n".join(lines)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError("Could not parse outline JSON from LLM response")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=OutlineGenerateResponse)
async def generate_outline(
    req: OutlineGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate a thesis outline from a research topic."""
    agent = Agent(
        model=_build_model(),
        system_message=_outline_system_prompt(
            num_sections=req.num_sections,
            style=req.style,
            language=req.language or "English",
            include_pages=req.include_page_estimate,
        ),
        markdown=False,
    )

    user_prompt = (
        f"Generate a thesis outline for the following research topic:\n\n"
        f"Topic: {req.topic}\n"
    )
    if req.discipline:
        user_prompt += f"Discipline: {req.discipline}\n"

    try:
        response = await agent.arun(user_prompt)
        res_content = getattr(response, "content", None)
        raw_output = str(res_content) if res_content is not None else str(response or "")
        data = _parse_outline_json(raw_output)
    except ValueError as e:
        logger.warning(f"outline_parse_error: {e}")
        raise HTTPException(status_code=422, detail="The AI returned an invalid outline format. Please try again.")
    except Exception as e:
        logger.error(f"outline_generation_error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate outline. Please try again.")

    # Validate and build response
    try:
        sections = []
        for s in data.get("sections", []):
            subsections = [
                OutlineSubSection(
                    title=ss.get("title", ""),
                    content_suggestion=ss.get("content_suggestion", ""),
                )
                for ss in s.get("subsections", [])
            ]
            sections.append(OutlineSection(
                title=s.get("title", ""),
                content_suggestion=s.get("content_suggestion", ""),
                subsections=subsections,
            ))

        total_pages = data.get("estimated_total_pages", 0)
        if req.include_page_estimate and total_pages == 0:
            total_pages = sum(s.get("estimated_pages", 10) for s in data.get("sections", []))

        return OutlineGenerateResponse(
            topic=req.topic,
            title_suggestion=data.get("title_suggestion", req.topic),
            abstract_suggestion=data.get("abstract_suggestion", ""),
            sections=sections,
            key_questions=data.get("key_questions", []),
            methodology_hint=data.get("methodology_hint", ""),
            estimated_total_pages=total_pages,
        )
    except Exception as e:
        logger.error(f"outline_response_build_error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process outline. Please try again.")


@router.post("/refine", response_model=OutlineRefineResponse)
async def refine_outline(
    req: OutlineRefineRequest,
    current_user: dict = Depends(get_current_user),
):
    """Refine or expand an existing thesis outline based on user instructions."""
    agent = Agent(
        model=_build_model(),
        system_message=_refine_system_prompt(language=req.language or "English"),
        markdown=False,
    )

    current_json = json.dumps(
        [{"title": s.title, "content_suggestion": s.content_suggestion,
          "subsections": [{"title": ss.title, "content_suggestion": ss.content_suggestion}
                          for ss in s.subsections]}
         for s in req.current_outline],
        indent=2,
    )

    user_prompt = (
        f"Topic: {req.topic}\n\n"
        f"Current Outline:\n{current_json}\n\n"
        f"Refinement instruction: {req.instruction}\n\n"
        "Return the refined outline in the specified JSON format."
    )

    try:
        response = await agent.arun(user_prompt)
        res_content = getattr(response, "content", None)
        raw_output = str(res_content) if res_content is not None else str(response or "")
        data = _parse_outline_json(raw_output)
    except ValueError as e:
        logger.warning(f"refine_parse_error: {e}")
        raise HTTPException(status_code=422, detail="The AI returned an invalid outline format. Please try again.")
    except Exception as e:
        logger.error(f"refine_generation_error: {e}")
        raise HTTPException(status_code=500, detail="Failed to refine outline. Please try again.")

    try:
        sections = []
        for s in data.get("sections", []):
            subsections = [
                OutlineSubSection(
                    title=ss.get("title", ""),
                    content_suggestion=ss.get("content_suggestion", ""),
                )
                for ss in s.get("subsections", [])
            ]
            sections.append(OutlineSection(
                title=s.get("title", ""),
                content_suggestion=s.get("content_suggestion", ""),
                subsections=subsections,
            ))

        return OutlineRefineResponse(
            topic=req.topic,
            title_suggestion=data.get("title_suggestion", req.topic),
            abstract_suggestion=data.get("abstract_suggestion", ""),
            sections=sections,
            key_questions=data.get("key_questions", []),
            methodology_hint=data.get("methodology_hint", ""),
            estimated_total_pages=data.get("estimated_total_pages", 0),
            changes_summary=data.get("changes_summary", "Outline refined based on your instructions."),
        )
    except Exception as e:
        logger.error(f"refine_response_build_error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process refined outline.")


@router.post("/to-sfdt")
async def outline_to_sfst(
    outline: OutlineGenerateResponse,
    current_user: dict = Depends(get_current_user),
):
    """
    Convert a generated outline into Syncfusion Document Editor SFDT format
    so it can be inserted directly into the thesis editor as formatted content.
    """
    paragraphs = []

    # Title
    paragraphs.append({
        "paragraphFormat": {"styleName": "Title", "alignment": "Center"},
        "characterFormat": {"bold": True, "fontSize": 28, "fontFamily": "Georgia"},
        "text": outline.title_suggestion,
    })
    paragraphs.append({"text": ""})  # blank line

    # Abstract
    if outline.abstract_suggestion:
        paragraphs.append({
            "paragraphFormat": {"styleName": "Heading 2"},
            "characterFormat": {"bold": True, "fontSize": 16, "fontFamily": "Georgia"},
            "text": "Abstract",
        })
        paragraphs.append({
            "characterFormat": {"italic": True, "fontSize": 11, "fontFamily": "Georgia"},
            "text": outline.abstract_suggestion,
        })
        paragraphs.append({"text": ""})

    # Sections
    for i, section in enumerate(outline.sections, 1):
        # Section heading
        paragraphs.append({
            "paragraphFormat": {"styleName": "Heading 1"},
            "characterFormat": {"bold": True, "fontSize": 18, "fontFamily": "Georgia"},
            "text": f"{i}. {section.title}",
        })

        # Content suggestion as placeholder
        paragraphs.append({
            "characterFormat": {"fontSize": 11, "fontFamily": "Georgia", "fontColor": "#888888"},
            "text": f"[{section.content_suggestion}]",
        })
        paragraphs.append({"text": ""})

        # Subsections
        for j, sub in enumerate(section.subsections, 1):
            paragraphs.append({
                "paragraphFormat": {"styleName": "Heading 2"},
                "characterFormat": {"bold": True, "fontSize": 14, "fontFamily": "Georgia"},
                "text": f"{i}.{j} {sub.title}",
            })
            paragraphs.append({
                "characterFormat": {"fontSize": 11, "fontFamily": "Georgia", "fontColor": "#888888"},
                "text": f"[{sub.content_suggestion}]",
            })
            paragraphs.append({"text": ""})

    # Key Questions
    if outline.key_questions:
        paragraphs.append({
            "paragraphFormat": {"styleName": "Heading 1"},
            "characterFormat": {"bold": True, "fontSize": 18, "fontFamily": "Georgia"},
            "text": "Research Questions",
        })
        for q in outline.key_questions:
            paragraphs.append({
                "characterFormat": {"fontSize": 11, "fontFamily": "Georgia"},
                "text": f"• {q}",
            })
        paragraphs.append({"text": ""})

    # Methodology hint
    if outline.methodology_hint:
        paragraphs.append({
            "paragraphFormat": {"styleName": "Heading 1"},
            "characterFormat": {"bold": True, "fontSize": 18, "fontFamily": "Georgia"},
            "text": "Suggested Methodology",
        })
        paragraphs.append({
            "characterFormat": {"fontSize": 11, "fontFamily": "Georgia", "fontColor": "#888888"},
            "text": f"[{outline.methodology_hint}]",
        })

    # Build SFDT structure
    sfdt = {
        "sections": [{
            "blocks": [
                {"paragraphs": [p]} for p in paragraphs
            ],
            "sectionFormat": {
                "pageWidth": 12240,
                "pageHeight": 15840,
                "leftMargin": 1440,
                "rightMargin": 1440,
                "topMargin": 1440,
                "bottomMargin": 1440,
            }
        }]
    }

    return {"sfdt": json.dumps(sfdt), "paragraph_count": len(paragraphs)}
