"""
Research Workflow — Agno 2.x Workflow Primitives
=================================================
Orchestrates the full research pipeline using Agno's Workflow system.

Pipeline:
    1. Discovery: Search academic databases for sources
    2. Extraction: Pull claims and evidence from sources
    3. Verification: Cross-reference claims against sources
    4. Synthesis: Integrate findings into comprehensive report

Each step uses a specialized Agno Agent with structured output.
The workflow handles state passing between steps automatically.
"""

import json
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field

from agno.agent import Agent
from agno.workflow import Workflow, Step, Parallel, StepInput, StepOutput
from agno.run.agent import RunOutput

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("research_workflow")


# ── Workflow State Schemas ───────────────────────────────────────────────────

class DiscoveryState(BaseModel):
    """State after the discovery step."""
    sources: List[Dict[str, Any]] = []
    source_count: int = 0
    search_queries: List[str] = []


class ExtractionState(BaseModel):
    """State after the extraction step."""
    claims: List[Dict[str, Any]] = []
    claim_count: int = 0
    evidence_count: int = 0


class VerificationState(BaseModel):
    """State after the verification step."""
    verified_claims: List[Dict[str, Any]] = []
    disputed_claims: List[Dict[str, Any]] = []
    overall_confidence: float = 0.0


class SynthesisState(BaseModel):
    """State after the synthesis step."""
    report: str = ""
    key_findings: List[str] = []
    citations_used: int = 0


# ── Workflow Agents ──────────────────────────────────────────────────────────

def _get_model(provider: str = "nvidia", model_id: Optional[str] = None):
    """Get the appropriate Agno model based on agent role and provider."""
    prov = provider or getattr(settings, "DEFAULT_LLM_PROVIDER", "nvidia")
    if prov == "gemini":
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
    elif prov == "nvidia":
        from agno.models.openai import OpenAIChat
        return OpenAIChat(
            id=model_id or settings.NVIDIA_DEFAULT_MODEL,
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.nvidia_api_key,
        )
    else:
        from agno.models.openai import OpenAIChat
        return OpenAIChat(
            id=model_id or settings.NVIDIA_DEFAULT_MODEL,
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.nvidia_api_key,
        )


def _create_discovery_agent() -> Agent:
    """Agent for searching and discovering academic sources (Research -> Gemini)."""
    from agno.tools.duckduckgo import DuckDuckGoTools
    from agno.tools.arxiv import ArxivTools

    return Agent(
        name="DiscoveryAgent",
        model=_get_model(provider="gemini"),
        tools=[
            DuckDuckGoTools(enable_search=True),
            ArxivTools(),
        ],
        instructions=[
            "Search for academic sources on the given topic.",
            "Return structured JSON with sources list containing: title, authors, year, abstract, citations, url.",
            "Target at least 10-15 high-quality sources.",
            "Prioritize recent, highly-cited publications.",
        ],
        description="Discovers academic sources for research topics.",
        add_history_to_context=False,
    )


def _create_extraction_agent() -> Agent:
    """Agent for extracting claims from sources (Backend Extraction -> Nvidia)."""
    return Agent(
        name="ExtractionAgent",
        model=_get_model(provider="nvidia"),
        instructions=[
            "Analyze the provided sources and extract key research claims.",
            "For each claim provide: text, source_refs, confidence (0-1), status (verified/disputed/unverified).",
            "Extract 5-15 distinct claims from the sources.",
            "Focus on verifiable, specific claims rather than general statements.",
            "Return as JSON array of claim objects.",
        ],
        description="Extracts verifiable claims from research sources.",
        add_history_to_context=False,
    )


def _create_verification_agent() -> Agent:
    """Agent for verifying claims against sources (Critic/Verification -> OpenRouter)."""
    return Agent(
        name="VerificationAgent",
        model=_get_model(provider="openrouter"),
        instructions=[
            "Cross-reference each claim against its cited sources.",
            "For each claim determine: supported (bool), confidence adjustment, issues found.",
            "Return JSON with verified_claims and disputed_claims lists.",
            "Flag any misquotations or unsupported assertions.",
        ],
        description="Verifies research claims against source documents.",
        add_history_to_context=False,
    )


def _create_synthesis_agent() -> Agent:
    """Agent for synthesizing the final research report (Research Synthesis -> Gemini)."""
    return Agent(
        name="SynthesisAgent",
        model=_get_model(provider="gemini"),
        instructions=[
            "Write a comprehensive academic research synthesis.",
            "Include: executive summary, key findings, methodology, limitations, future directions.",
            "Cite sources using [Source N] format.",
            "Write in dense academic prose. No filler phrases.",
            "Ground every claim in the provided evidence.",
        ],
        description="Synthesizes verified findings into comprehensive reports.",
        add_history_to_context=True,
        num_history_runs=2,
    )


# ── Workflow Steps ───────────────────────────────────────────────────────────

def discovery_step(
    step_input: Union[StepInput, Dict[str, Any]],
    session_state: Optional[Dict[str, Any]] = None,
) -> StepOutput:
    """Step 1: Search academic databases for sources."""
    state = step_input if isinstance(step_input, dict) else (session_state if session_state is not None else {})
    query = state.get("query", "")
    logger.info(f"Workflow Step 1 - Discovery: {query[:80]}...")

    agent = _create_discovery_agent()
    response: RunOutput = agent.run(
        f"Search for academic sources on: {query}\n\n"
        f"Additional context: {state.get('context', '')}"
    )

    # Parse response into structured state
    res_content = getattr(response, "content", None)
    content = str(res_content) if res_content is not None else str(response or "")
    try:
        # Try to extract JSON from response
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]
        else:
            json_str = content

        parsed = json.loads(json_str)
        sources = parsed if isinstance(parsed, list) else parsed.get("sources", [])
    except (json.JSONDecodeError, IndexError):
        # Fallback: treat the whole response as source descriptions
        sources = [{"title": f"Source from query: {query[:50]}", "abstract": content[:500]}]

    state["discovery"] = {
        "sources": sources,
        "source_count": len(sources),
        "search_queries": [query],
    }
    logger.info(f"Discovery found {len(sources)} sources")
    return StepOutput(content=state)


def extraction_step(
    step_input: Union[StepInput, Dict[str, Any]],
    session_state: Optional[Dict[str, Any]] = None,
) -> StepOutput:
    """Step 2: Extract claims from discovered sources."""
    state = step_input if isinstance(step_input, dict) else (session_state if session_state is not None else {})
    discovery = state.get("discovery", {})
    sources = discovery.get("sources", [])
    logger.info(f"Workflow Step 2 - Extraction: processing {len(sources)} sources")

    agent = _create_extraction_agent()
    response: RunOutput = agent.run(
        f"Extract research claims from these sources:\n\n"
        f"{json.dumps(sources, indent=2, default=str)[:3000]}"
    )

    res_content = getattr(response, "content", None)
    content = str(res_content) if res_content is not None else str(response or "")
    try:
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]
        else:
            json_str = content

        parsed = json.loads(json_str)
        claims = parsed if isinstance(parsed, list) else parsed.get("claims", [])
    except (json.JSONDecodeError, IndexError):
        claims = [{"claim": f"Key finding from research on {state.get('query', '')[:50]}",
                    "confidence": 0.5, "status": "unverified"}]

    state["extraction"] = {
        "claims": claims,
        "claim_count": len(claims),
    }
    logger.info(f"Extracted {len(claims)} claims")
    return StepOutput(content=state)


def verification_step(
    step_input: Union[StepInput, Dict[str, Any]],
    session_state: Optional[Dict[str, Any]] = None,
) -> StepOutput:
    """Step 3: Verify claims against sources."""
    state = step_input if isinstance(step_input, dict) else (session_state if session_state is not None else {})
    extraction = state.get("extraction", {})
    claims = extraction.get("claims", [])
    discovery = state.get("discovery", {})
    sources = discovery.get("sources", [])

    logger.info(f"Workflow Step 3 - Verification: verifying {len(claims)} claims")

    agent = _create_verification_agent()
    response: RunOutput = agent.run(
        f"Verify these claims against the sources:\n\n"
        f"Claims:\n{json.dumps(claims, indent=2, default=str)[:2000]}\n\n"
        f"Sources:\n{json.dumps(sources, indent=2, default=str)[:2000]}"
    )

    res_content = getattr(response, "content", None)
    content = str(res_content) if res_content is not None else str(response or "")
    try:
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]
        else:
            json_str = content

        parsed = json.loads(json_str)
        verified = parsed.get("verified_claims", [])
        disputed = parsed.get("disputed_claims", [])
        confidence = parsed.get("overall_confidence", 0.5)
    except (json.JSONDecodeError, IndexError):
        verified = [c for c in claims if c.get("confidence", 0) > 0.7]
        disputed = [c for c in claims if c.get("confidence", 0) <= 0.3]
        confidence = 0.5

    state["verification"] = {
        "verified_claims": verified,
        "disputed_claims": disputed,
        "overall_confidence": confidence,
    }
    logger.info(f"Verification: {len(verified)} verified, {len(disputed)} disputed, confidence={confidence:.2f}")
    return StepOutput(content=state)


def synthesis_step(
    step_input: Union[StepInput, Dict[str, Any]],
    session_state: Optional[Dict[str, Any]] = None,
) -> StepOutput:
    """Step 4: Synthesize final research report."""
    state = step_input if isinstance(step_input, dict) else (session_state if session_state is not None else {})
    query = state.get("query", "")
    discovery = state.get("discovery", {})
    extraction = state.get("extraction", {})
    verification = state.get("verification", {})

    logger.info("Workflow Step 4 - Synthesis: generating final report")

    agent = _create_synthesis_agent()
    response: RunOutput = agent.run(
        f"Synthesize a comprehensive research report.\n\n"
        f"Research Question: {query}\n\n"
        f"Sources Found: {discovery.get('source_count', 0)}\n"
        f"Claims Extracted: {extraction.get('claim_count', 0)}\n"
        f"Verified Claims: {len(verification.get('verified_claims', []))}\n"
        f"Disputed Claims: {len(verification.get('disputed_claims', []))}\n"
        f"Overall Confidence: {verification.get('overall_confidence', 0.5):.2f}\n\n"
        f"Claims:\n{json.dumps(extraction.get('claims', [])[:10], indent=2, default=str)[:2000]}\n\n"
        f"Write the full research synthesis with citations."
    )

    res_content = getattr(response, "content", None)
    report = str(res_content) if res_content is not None else str(response or "")
    key_findings = [f"Finding from {discovery.get('source_count', 0)} sources"]

    state["synthesis"] = {
        "report": report,
        "key_findings": key_findings,
        "citations_used": discovery.get("source_count", 0),
    }
    logger.info(f"Synthesis complete: {len(report)} chars")
    return StepOutput(content=state)


# ── Workflow Factory ─────────────────────────────────────────────────────────

def create_research_workflow() -> Workflow:
    """
    Create the full research workflow with sequential steps.

    Pipeline:
        Discovery → Extraction → Verification → Synthesis
    """
    workflow = Workflow(
        name="ResearchPipeline",
        steps=[
            Step(name="discovery", executor=discovery_step),
            Step(name="extraction", executor=extraction_step),
            Step(name="verification", executor=verification_step),
            Step(name="synthesis", executor=synthesis_step),
        ],
    )
    return workflow


# ── Public API ───────────────────────────────────────────────────────────────

_workflow_instance: Optional[Workflow] = None


def get_research_workflow() -> Workflow:
    """Get or create the research workflow singleton."""
    global _workflow_instance
    if _workflow_instance is None:
        _workflow_instance = create_research_workflow()
    return _workflow_instance


async def run_research_workflow(
    query: str,
    context: str = "",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute the full research workflow.

    Args:
        query: The research question.
        context: Additional context or documents.
        session_id: Optional session ID for persistence.

    Returns:
        Dict with research results from each pipeline stage.
    """
    workflow = get_research_workflow()

    session_state = {
        "query": query,
        "context": context,
        "session_id": session_id,
    }

    try:
        result = await workflow.arun(session_state=session_state)

        # Extract final state from workflow result
        if hasattr(result, "session_state"):
            state = result.session_state
        elif isinstance(result, dict):
            state = result
        else:
            state = session_state

        return {
            "query": query,
            "discovery": state.get("discovery", {}),
            "extraction": state.get("extraction", {}),
            "verification": state.get("verification", {}),
            "synthesis": state.get("synthesis", {}),
            "success": True,
        }
    except Exception as e:
        logger.error(f"Research workflow failed: {e}", exc_info=True)
        return {
            "query": query,
            "discovery": {},
            "extraction": {},
            "verification": {},
            "synthesis": {"report": f"Workflow error: {str(e)}"},
            "success": False,
            "error": str(e),
        }
