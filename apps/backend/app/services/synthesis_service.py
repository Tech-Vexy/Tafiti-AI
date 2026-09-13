"""
Synthesis & Research Assistance Service
=======================================
Lightweight scholarly synthesis, follow-up inquiry generation, paper impact analysis,
and gap analysis powered by the unified ModelRouter.
"""

import json
import re
from typing import Any, AsyncIterator, Dict, List, Optional

from app.core.logger import get_logger
from app.core.model_router import model_router, TaskType
from app.models.schemas import PaperBase

logger = get_logger("synthesis_service")


def build_paper_context(papers: List[PaperBase]) -> str:
    """Format papers into structured, readable citation blocks."""
    parts = []
    for i, p in enumerate(papers, 1):
        authors = ", ".join(p.authors) if p.authors else "Unknown Authors"
        year = f" ({p.year})" if p.year else ""
        doi_str = f" | DOI: {p.doi}" if p.doi else ""
        parts.append(
            f"[Source {i}] {p.title}{year}{doi_str}\n"
            f"Authors: {authors}\n"
            f"Abstract: {p.abstract or 'No abstract available.'}\n"
        )
    return "\n".join(parts)


async def generate_followup_questions(context: str, query: str) -> List[str]:
    """Generate 3-5 concise, scholarly follow-up research questions."""
    system_prompt = (
        "You are an expert academic research advisor. "
        "Given the research context and query, generate exactly 4 concise, specific, "
        "and scholarly follow-up questions that probe unexplored angles, methodologies, or implications. "
        "Return ONLY a valid JSON array of strings, e.g. [\"Question 1\", \"Question 2\"]."
    )
    user_prompt = f"Query: {query}\n\nContext excerpt:\n{context[:2000]}"

    try:
        res = await model_router.complete(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            task_type=TaskType.EXTRACTION,
            temperature=0.4,
        )
        content = res.get("content", "")
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            questions = json.loads(match.group(0))
            if isinstance(questions, list) and len(questions) > 0:
                return [str(q).strip() for q in questions[:5] if str(q).strip()]
    except Exception as e:
        logger.warning(f"Follow-up question generation error: {e}")

    # Fallback questions
    from app.services.academic_query_processor import deconstruct_academic_query
    topic = deconstruct_academic_query(query).topic or query
    return [
        f"What methodological improvements could strengthen empirical research on {topic}?",
        f"Which demographic or geographic populations are underrepresented in current {topic} studies?",
        f"What are the practical or policy applications of recent findings in {topic}?",
        f"How do contradictory findings in {topic} challenge existing theoretical frameworks?",
    ]


async def explain_paper_impact(paper: Any, career_field: str) -> Dict[str, Any]:
    """Explain how an academic paper relates to a specific career field."""
    title = paper.get("title", "") if isinstance(paper, dict) else getattr(paper, "title", "")
    abstract = paper.get("abstract", "") if isinstance(paper, dict) else getattr(paper, "abstract", "")

    system_prompt = (
        "You are an academic mentor. Explain the professional relevance and impact of this paper "
        f"for someone working in {career_field}. "
        "Return ONLY a JSON object with keys: "
        "'impact_summary' (string), 'relevance_score' (int 1-10), 'key_takeaway' (string), and 'potential_applications' (list of strings)."
    )
    user_prompt = f"Title: {title}\nAbstract: {abstract or 'N/A'}\nField: {career_field}"

    fallback = {
        "impact_summary": f"This research on '{title}' provides foundational insights applicable to {career_field}.",
        "relevance_score": 7,
        "key_takeaway": title,
        "potential_applications": [
            f"Cross-disciplinary integration within {career_field}",
            "Methodological baseline for exploratory projects"
        ],
    }

    try:
        res = await model_router.complete(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            task_type=TaskType.EXTRACTION,
            temperature=0.3,
        )
        content = res.get("content", "")
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            if isinstance(data, dict):
                return {
                    "impact_summary": str(data.get("impact_summary", fallback["impact_summary"])),
                    "relevance_score": int(data.get("relevance_score", 7)),
                    "key_takeaway": str(data.get("key_takeaway", fallback["key_takeaway"])),
                    "potential_applications": list(data.get("potential_applications", fallback["potential_applications"])),
                }
    except Exception as e:
        logger.warning(f"Paper impact explanation error: {e}")

    return fallback


async def analyze_research_gaps(
    papers: List[PaperBase],
    research_context: Optional[str] = None
) -> Dict[str, Any]:
    """Analyze a research corpus and identify methodological, geographic, and theoretical gaps."""
    context = build_paper_context(papers)
    context_clause = f"\nStudent Context: {research_context}\n" if research_context else ""

    system_prompt = (
        "You are a senior academic research advisor and PhD supervisor. "
        "Perform a rigorous Gap Analysis on the provided research corpus. "
        "Identify 4 to 6 specific research gaps (methodological, geographic, temporal, theoretical, or demographic). "
        "Return ONLY a JSON object with the following structure:\n"
        "{\n"
        '  "overview": "Summary of corpus state and primary limitations",\n'
        '  "gaps": [\n'
        '    {"title": "...", "gap_type": "methodological|geographic|temporal|theoretical|demographic", "description": "...", "opportunity": "..."}\n'
        "  ]\n"
        "}"
    )
    user_prompt = f"Corpus ({len(papers)} papers):\n\n{context}{context_clause}"

    try:
        res = await model_router.complete(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            task_type=TaskType.SYNTHESIS,
            temperature=0.3,
        )
        content = res.get("content", "")
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            if isinstance(data, dict) and "gaps" in data:
                return data
    except Exception as e:
        logger.error(f"Gap analysis generation error: {e}", exc_info=True)

    return {
        "overview": "The reviewed literature demonstrates strong foundational rigor but reveals distinct opportunities for expanded empirical investigation.",
        "gaps": [
            {
                "title": "Geographic & Demographic Representation",
                "gap_type": "geographic",
                "description": "Studies in the corpus concentrate heavily in specific regions, limiting cross-context generalizability.",
                "opportunity": "Replicate core methodologies across understudied regional populations."
            },
            {
                "title": "Longitudinal Methodological Validation",
                "gap_type": "methodological",
                "description": "Predominance of cross-sectional designs limits causal inference over long time horizons.",
                "opportunity": "Employ longitudinal designs to track long-term stability and evolutionary dynamics."
            }
        ]
    }


async def synthesize_literature(
    query: str,
    papers: List[PaperBase],
    output_language: str = "English",
    rag_context: str = "",
) -> Dict[str, Any]:
    """Produce an academic literature synthesis from papers with inline citations."""
    context = build_paper_context(papers)
    lang_clause = f"\nWrite the synthesis entirely in {output_language}." if output_language.lower() not in ("english", "en") else ""
    rag_clause = f"\nAdditional Retrieved Context:\n{rag_context}\n" if rag_context else ""

    system_prompt = (
        "You are an elite academic literature synthesist. "
        "Synthesize the provided papers into a rigorous, cohesive academic literature review answering the query. "
        "Use [Source N] inline citations for every factual statement, compare conflicting viewpoints, "
        "and summarize prevailing consensus." + lang_clause
    )
    user_prompt = f"Query: {query}\n\n{context}{rag_clause}"

    res = await model_router.complete(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        task_type=TaskType.SYNTHESIS,
        temperature=0.3,
    )
    answer = res.get("content", "")

    return {
        "answer": answer,
        "sources_used": list(range(1, len(papers) + 1)),
        "provider": res.get("provider", "model_router"),
        "model": res.get("model", "default"),
    }


async def stream_synthesis(
    query: str,
    papers: List[PaperBase],
    output_language: str = "English",
    rag_context: str = "",
) -> AsyncIterator[str]:
    """Stream literature synthesis text tokens."""
    # Run full completion and stream in clean chunks for client consumers
    res = await synthesize_literature(query, papers, output_language, rag_context)
    full_text = res.get("answer", "")
    chunk_size = 40
    for i in range(0, len(full_text), chunk_size):
        yield full_text[i:i + chunk_size]


async def stream_collaborative_synthesis(
    query: str,
    papers: List[PaperBase],
) -> AsyncIterator[str]:
    """Stream dual-perspective (Critic vs Synthesist) analytical synthesis."""
    context = build_paper_context(papers)
    system_prompt = (
        "You are two senior academic researchers collaborating on a critical synthesis:\n\n"
        "### Analytical Critique (The Critic)\n"
        "Rigorously scrutinize methodological limitations, sample constraints, and contradictory findings.\n\n"
        "### Constructive Synthesis (The Synthesist)\n"
        "Highlight theoretical convergence, practical applicability, and promising forward directions.\n\n"
        "### Unified Consensus\n"
        "Conclude with an integrated assessment. Use [Source N] inline citations throughout."
    )
    user_prompt = f"Research Query: {query}\n\nEvidence Base:\n{context}"

    res = await model_router.complete(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        task_type=TaskType.SYNTHESIS,
        temperature=0.4,
    )
    text = res.get("content", "")
    chunk_size = 50
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]
