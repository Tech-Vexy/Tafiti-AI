"""
AI-Powered Writing Assistance API — Summarize, improve clarity, suggest transitions.
Uses the same LLM provider setup as the research agents (Agno 2.x).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from agno.agent import Agent

from app.core.config import settings
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("writing_assist")
router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class WritingRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000, description="Text to process")
    context: Optional[str] = Field(None, max_length=5000, description="Surrounding context or thesis title")
    language: Optional[str] = Field("English", description="Output language")


class WritingResponse(BaseModel):
    result: str
    operation: str
    word_count_before: int
    word_count_after: int


class TransitionRequest(BaseModel):
    paragraphs: list[str] = Field(..., min_length=2, description="List of paragraph texts")
    context: Optional[str] = Field(None, max_length=5000, description="Thesis title or topic")
    language: Optional[str] = Field("English", description="Output language")


class TransitionResponse(BaseModel):
    transitions: list[str]
    full_text: str
    suggestions: list[str]


class BatchRequest(BaseModel):
    operations: list[str] = Field(..., description="Operations to run: summarize, clarity, transitions, expand, style")
    text: str = Field(..., min_length=10, max_length=50000)
    context: Optional[str] = Field(None, max_length=5000)
    language: Optional[str] = Field("English")


class BatchResponse(BaseModel):
    results: dict[str, str]
    word_count_before: int


# ---------------------------------------------------------------------------
# Model builder (same logic as research_agent)
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
# Prompts
# ---------------------------------------------------------------------------

def _summarize_prompt(language: str) -> str:
    lang = "" if language.lower() in ("english", "en") else f"Write the summary in {language}."
    return (
        "You are an expert academic writing assistant. "
        "Provide a clear, concise summary of the following text. "
        "Focus on the main arguments, key findings, and conclusions. "
        "Use academic tone. "
        f"{lang}\n\n"
        "Return ONLY the summary — no preamble, no meta-commentary."
    )


def _clarity_prompt(language: str) -> str:
    lang = "" if language.lower() in ("english", "en") else f"Write the improved version in {language}."
    return (
        "You are an expert academic writing editor. "
        "Rewrite the following text to improve clarity, readability, and flow while "
        "preserving the original meaning and academic tone. Fix awkward phrasing, "
        "reduce jargon where possible, and improve sentence structure. "
        f"{lang}\n\n"
        "Return ONLY the improved text — no explanation of changes, no preamble."
    )


def _transition_prompt(language: str) -> str:
    lang = "" if language.lower() in ("english", "en") else f"Write the transitions in {language}."
    return (
        "You are an expert academic writing assistant. "
        "You will receive a block of text. Your task is to: "
        "1) Identify natural paragraph breaks (if the text is a single block). "
        "2) Write smooth, logical transition sentences between each paragraph. "
        "3) Ensure the flow from one idea to the next is coherent. "
        f"{lang}\n\n"
        "Return ONLY the full text with transitions inserted — no explanation."
    )


def _expand_prompt(language: str) -> str:
    lang = "" if language.lower() in ("english", "en") else f"Write the expanded version in {language}."
    return (
        "You are an expert academic writer. "
        "Expand the following text with more detail, examples, and analysis. "
        "Maintain the original structure and academic tone. "
        "Add depth without padding or filler. "
        f"{lang}\n\n"
        "Return ONLY the expanded text — no preamble."
    )


def _style_prompt(language: str) -> str:
    lang = "" if language.lower() in ("english", "en") else f"Write the suggestions in {language}."
    return (
        "You are an expert academic writing reviewer. "
        "Analyze the following text and provide: "
        "1) A brief assessment of writing quality (2-3 sentences). "
        "2) 3-5 specific, actionable suggestions for improvement. "
        "3) Highlight any grammar or style issues found. "
        f"{lang}\n\n"
        "Format your response as:\n"
        "## Assessment\n[your assessment]\n\n"
        "## Suggestions\n[numbered list]\n\n"
        "## Issues Found\n[bullet list or 'No significant issues found']"
    )


def _transitions_between_prompt(language: str) -> str:
    lang = "" if language.lower() in ("english", "en") else f"Write the transitions in {language}."
    return (
        "You are an expert academic writing assistant. "
        "You will receive numbered paragraphs. For each consecutive pair, "
        "write a smooth transition sentence that connects the ideas. "
        "Transitions should be 1-2 sentences, academically rigorous, and "
        "logically bridge the topic shift. "
        f"{lang}\n\n"
        "Return ONLY a JSON array of transition strings, one per pair. "
        'Example: ["Transition 1...", "Transition 2...", "Transition 3..."]'
    )


# ---------------------------------------------------------------------------
# Helper to count words
# ---------------------------------------------------------------------------

def _wc(text: Optional[str]) -> int:
    if not text:
        return 0
    return len(text.strip().split())


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/summarize", response_model=WritingResponse)
async def summarize_text(req: WritingRequest, user=Depends(get_current_user)):
    """Summarize a text section into concise academic prose."""
    try:
        agent = Agent(model=_build_model(), instructions=[_summarize_prompt(req.language or "English")])
        response = await agent.arun(req.text)
        res_content = getattr(response, "content", None)
        result = str(res_content) if res_content is not None else str(response or "")
        return WritingResponse(
            result=result,
            operation="summarize",
            word_count_before=_wc(req.text),
            word_count_after=_wc(result),
        )
    except Exception as e:
        logger.error(f"summarize_failed: {e}")
        raise HTTPException(status_code=500, detail="AI summarization failed. Please try again.")


@router.post("/clarity", response_model=WritingResponse)
async def improve_clarity(req: WritingRequest, user=Depends(get_current_user)):
    """Rewrite text for improved clarity and readability."""
    try:
        agent = Agent(model=_build_model(), instructions=[_clarity_prompt(req.language or "English")])
        response = await agent.arun(req.text)
        res_content = getattr(response, "content", None)
        result = str(res_content) if res_content is not None else str(response or "")
        return WritingResponse(
            result=result,
            operation="clarity",
            word_count_before=_wc(req.text),
            word_count_after=_wc(result),
        )
    except Exception as e:
        logger.error(f"clarity_failed: {e}")
        raise HTTPException(status_code=500, detail="AI clarity improvement failed. Please try again.")


@router.post("/transitions", response_model=WritingResponse)
async def suggest_transitions(req: WritingRequest, user=Depends(get_current_user)):
    """Suggest and insert transition sentences into text."""
    try:
        agent = Agent(model=_build_model(), instructions=[_transition_prompt(req.language or "English")])
        response = await agent.arun(req.text)
        res_content = getattr(response, "content", None)
        result = str(res_content) if res_content is not None else str(response or "")
        return WritingResponse(
            result=result,
            operation="transitions",
            word_count_before=_wc(req.text),
            word_count_after=_wc(result),
        )
    except Exception as e:
        logger.error(f"transitions_failed: {e}")
        raise HTTPException(status_code=500, detail="AI transition suggestion failed. Please try again.")


@router.post("/expand", response_model=WritingResponse)
async def expand_text(req: WritingRequest, user=Depends(get_current_user)):
    """Expand text with more detail, examples, and analysis."""
    try:
        agent = Agent(model=_build_model(), instructions=[_expand_prompt(req.language or "English")])
        response = await agent.arun(req.text)
        res_content = getattr(response, "content", None)
        result = str(res_content) if res_content is not None else str(response or "")
        return WritingResponse(
            result=result,
            operation="expand",
            word_count_before=_wc(req.text),
            word_count_after=_wc(result),
        )
    except Exception as e:
        logger.error(f"expand_failed: {e}")
        raise HTTPException(status_code=500, detail="AI text expansion failed. Please try again.")


@router.post("/style-check", response_model=WritingResponse)
async def style_check(req: WritingRequest, user=Depends(get_current_user)):
    """Analyze writing quality and provide improvement suggestions."""
    try:
        agent = Agent(model=_build_model(), instructions=[_style_prompt(req.language or "English")])
        response = await agent.arun(req.text)
        res_content = getattr(response, "content", None)
        result = str(res_content) if res_content is not None else str(response or "")
        return WritingResponse(
            result=result,
            operation="style_check",
            word_count_before=_wc(req.text),
            word_count_after=0,  # analysis, not rewrite
        )
    except Exception as e:
        logger.error(f"style_check_failed: {e}")
        raise HTTPException(status_code=500, detail="AI style check failed. Please try again.")


@router.post("/transitions-between", response_model=TransitionResponse)
async def transitions_between_paragraphs(req: TransitionRequest, user=Depends(get_current_user)):
    """Generate transition sentences between multiple paragraphs."""
    try:
        # Format paragraphs for the prompt
        formatted = "\n\n".join(f"[Paragraph {i+1}]\n{p}" for i, p in enumerate(req.paragraphs))
        context_clause = f"\nThesis topic: {req.context}\n" if req.context else ""

        agent = Agent(model=_build_model(), instructions=[_transitions_between_prompt(req.language or "English")])
        response = await agent.arun(f"{context_clause}Paragraphs:\n\n{formatted}")

        # Try to parse as JSON array
        import json
        res_content = getattr(response, "content", None)
        raw = str(res_content or response or "").strip()
        # Extract JSON array from response if wrapped in markdown
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            transitions = json.loads(raw)
        except json.JSONDecodeError:
            # Fallback: split by newlines
            transitions = [line.strip().lstrip("0123456789. ") for line in raw.split("\n") if line.strip()]

        # Build full text with transitions inserted
        full_parts = []
        for i, para in enumerate(req.paragraphs):
            full_parts.append(para)
            if i < len(transitions) and i < len(req.paragraphs) - 1:
                full_parts.append(f"\n{transitions[i]}\n")

        # Suggestions for the user
        suggestions = [
            "Review each transition for logical flow with your specific arguments",
            "Ensure transitions maintain your voice and academic tone",
            "Adjust transitions if your paragraphs have subsection headings",
        ]

        return TransitionResponse(
            transitions=transitions[:len(req.paragraphs) - 1],
            full_text="\n".join(full_parts),
            suggestions=suggestions,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"transitions_between_failed: {e}")
        raise HTTPException(status_code=500, detail="AI transition generation failed. Please try again.")


@router.post("/batch", response_model=BatchResponse)
async def batch_operations(req: BatchRequest, user=Depends(get_current_user)):
    """Run multiple writing operations in a single request."""
    results = {}
    ops_map = {
        "summarize": _summarize_prompt,
        "clarity": _clarity_prompt,
        "transitions": _transition_prompt,
        "expand": _expand_prompt,
        "style": _style_prompt,
    }

    for op in req.operations:
        if op not in ops_map:
            continue
        try:
            agent = Agent(model=_build_model(), instructions=[ops_map[op](req.language or "English")])
            response = await agent.arun(req.text)
            res_content = getattr(response, "content", None)
            results[op] = str(res_content) if res_content is not None else str(response or "")
        except Exception as e:
            logger.warning(f"batch_{op}_failed: {e}")
            results[op] = f"[Error: {op} operation failed]"

    return BatchResponse(
        results=results,
        word_count_before=_wc(req.text),
    )


@router.post("/stream/{operation}")
async def stream_writing_assist(
    operation: str,
    req: WritingRequest,
    user=Depends(get_current_user),
):
    """Stream AI writing assistance results for real-time display."""
    ops_map = {
        "summarize": _summarize_prompt,
        "clarity": _clarity_prompt,
        "transitions": _transition_prompt,
        "expand": _expand_prompt,
        "style": _style_prompt,
    }

    if operation not in ops_map:
        raise HTTPException(status_code=400, detail=f"Unknown operation: {operation}. Use: {list(ops_map.keys())}")

    from fastapi.responses import StreamingResponse
    import json

    async def event_stream():
        try:
            agent = Agent(model=_build_model(), instructions=[ops_map[operation](req.language or "English")])
            async for event in agent.arun(req.text, stream=True):
                if hasattr(event, "content") and event.content:
                    yield f"data: {json.dumps({'chunk': event.content})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
