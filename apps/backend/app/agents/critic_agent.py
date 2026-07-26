from __future__ import annotations

import re
from typing import List, Optional

from pydantic import BaseModel, Field
from agno.agent import Agent

from app.core.config import settings
from app.core.logger import get_logger
from app.models.schemas import PaperBase

logger = get_logger("critic_agent")

class CitationCheck(BaseModel):
    source_ref: str          # e.g. "[Source 3]"
    claim: str               # the sentence that made this citation
    supported: bool          # does the source text support the claim?
    confidence: float = Field(ge=0.0, le=1.0)
    note: Optional[str] = None   # critic's note if unsupported

class ValidatedSynthesis(BaseModel):
    draft: str                           # full synthesis text (may include [FLAGGED] markers)
    citations: List[CitationCheck] = []
    flagged_count: int = 0
    overall_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    critique_summary: Optional[str] = None

def _build_drafter_agent() -> Agent:
    model_str = getattr(settings, "DRAFTER_MODEL", "google:gemini-1.5-pro")
    if model_str.startswith("gemini"):
        model_str = f"google:{model_str}"

    return Agent(
        model=model_str,
        system_message=(
            "You are an expert academic researcher. "
            "Synthesise the provided papers into a dense, well-cited academic paragraph. "
            "Use [Source N] inline citations for every factual claim. "
            "Return only the synthesis text — no preamble."
        ),
    )

def _build_critic_agent() -> Agent:
    model_str = getattr(settings, "CRITIC_MODEL", "groq:llama-3.3-70b-versatile")
    return Agent(
        model=model_str,
        output_schema=ValidatedSynthesis,
        system_message=(
            "You are a rigorous academic fact-checker. "
            "Given a synthesis draft and source paper abstracts, "
            "verify that every [Source N] citation is supported by the source text. "
            "For unsupported claims set supported=false and provide a note. "
            "Calculate overall_confidence as mean of all citation confidence scores."
        ),
    )

_drafter: Optional[Agent] = None
_critic: Optional[Agent] = None

def get_drafter() -> Agent:
    global _drafter
    if _drafter is None:
        _drafter = _build_drafter_agent()
    return _drafter

def get_critic() -> Agent:
    global _critic
    if _critic is None:
        _critic = _build_critic_agent()
    return _critic

def _build_context_block(papers: List[PaperBase]) -> str:
    parts = []
    for i, p in enumerate(papers, 1):
        authors = ", ".join(p.authors) if p.authors else "Unknown"
        parts.append(
            f"[Source {i}]\n"
            f"Title: {p.title}\n"
            f"Authors: {authors} ({p.year})\n"
            f"Abstract: {p.abstract or 'N/A'}\n"
        )
    return "\n".join(parts)

async def validated_synthesis(
    query: str,
    papers: List[PaperBase],
    output_language: str = "English",
) -> ValidatedSynthesis:
    context = _build_context_block(papers)
    language_note = (
        f"\n\nIMPORTANT: Write the entire synthesis in {output_language}."
        if output_language.lower() not in ("english", "en")
        else ""
    )
    drafter_prompt = (
        f"Papers:\n{context}\n\nResearch Question: {query}{language_note}"
    )

    try:
        drafter = get_drafter()
        draft_result = await drafter.arun(drafter_prompt)
        draft_text: str = draft_result.content
    except Exception as e:
        logger.warning(f"Drafter agent failed, falling back to empty draft: {e}")
        return ValidatedSynthesis(
            draft=f"[Synthesis unavailable: {e}]",
            overall_confidence=0.0,
            critique_summary="Drafter agent error.",
        )

    critic_prompt = (
        f"Synthesis Draft:\n{draft_text}\n\n"
        f"Source Papers:\n{context}\n\n"
        "Validate all [Source N] citations in the draft."
    )

    try:
        critic = get_critic()
        validated_result = await critic.arun(critic_prompt)
        validated: ValidatedSynthesis = validated_result.content

        if not validated.draft:
            validated.draft = draft_text

        flagged = [c for c in validated.citations if not c.supported]
        validated.flagged_count = len(flagged)
        for flag in flagged:
            validated.draft = validated.draft.replace(
                flag.source_ref, f"[FLAGGED]{flag.source_ref}"
            )
        logger.info(
            f"Critic validated synthesis: {len(validated.citations)} citations, "
            f"{validated.flagged_count} flagged, "
            f"confidence={validated.overall_confidence:.2f}"
        )
        return validated
    except Exception as e:
        logger.warning(f"Critic agent failed, returning unvalidated draft: {e}")
        return ValidatedSynthesis(
            draft=draft_text,
            overall_confidence=0.5,
            critique_summary=f"Critic agent error: {e}",
        )
