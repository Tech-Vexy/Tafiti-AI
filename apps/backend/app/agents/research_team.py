"""
Research Team — Agno 2.x Supervisor Mode
=========================================
Dynamic multi-agent research team using Agno's Team abstraction.

Team Mode: Supervisor (coordinate)
- Leader agent decomposes complex research tasks
- Delegates to specialist agents (researcher, extractor, critic, verifier, synthesist)
- Reviews output and synthesizes final result
- Dynamically spawns specialists based on discoveries

Agno handles message passing, delegation, and result synthesis automatically.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from agno.agent import Agent
from agno.team import Team
from agno.team.mode import TeamMode
from agno.models.groq import Groq as GroqModel
from agno.models.openai import OpenAIChat
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.arxiv import ArxivTools

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("research_team")


# ── Structured Output Schemas ────────────────────────────────────────────────

class ResearchPlan(BaseModel):
    """Structured output for research planning."""
    research_question: str = Field(description="The core research question")
    sub_questions: List[str] = Field(description="Decomposed sub-questions")
    search_terms: List[str] = Field(description="Key search terms and queries")
    expected_sources: int = Field(description="Target number of sources", default=15)
    approach: str = Field(description="Research approach description")


class SourceExtraction(BaseModel):
    """Extracted source information."""
    title: str
    authors: List[str] = []
    year: Optional[int] = None
    abstract: str = ""
    citations: int = 0
    source_type: str = "paper"
    url: Optional[str] = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class ClaimAnalysis(BaseModel):
    """An individual claim with verification status."""
    claim: str = Field(description="The research claim")
    source_refs: List[str] = Field(description="Source references supporting this claim")
    confidence: float = Field(ge=0.0, le=1.0)
    status: str = Field(description="verified/disputed/unverified", default="unverified")
    supporting_evidence: List[str] = []
    contradicting_evidence: List[str] = []


class ResearchSynthesis(BaseModel):
    """Final research synthesis output."""
    summary: str = Field(description="Executive summary of findings")
    key_findings: List[str] = Field(description="Top findings with citations")
    methodology: str = Field(description="Research methodology overview")
    limitations: List[str] = Field(description="Research limitations")
    future_directions: List[str] = Field(description="Suggested future research")
    citations_used: int = Field(description="Number of citations used")
    confidence_score: float = Field(ge=0.0, le=1.0, description="Overall confidence")


# ── Agent Factory Functions ──────────────────────────────────────────────────

def _get_model(model_id: Optional[str] = None, provider: Optional[str] = None):
    """Get the appropriate Agno model based on provider."""
    prov = provider or "nvidia"
    mid = model_id

    if prov == "gemini":
        from agno.models.google import Gemini
        return Gemini(id=mid or settings.GEMINI_DEFAULT_MODEL)
    elif prov == "openrouter":
        from agno.models.openai import OpenAIChat
        actual_model = mid or settings.OPENROUTER_DEFAULT_MODEL
        if ":" in actual_model:
            actual_model = actual_model.split(":", 1)[1]
        return OpenAIChat(
            id=actual_model,
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY,
        )
    elif prov == "nvidia":
        from agno.models.openai import OpenAIChat
        return OpenAIChat(
            id=mid or settings.NVIDIA_DEFAULT_MODEL,
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.nvidia_api_key,
        )
    elif prov == "openai":
        from agno.models.openai import OpenAIChat
        return OpenAIChat(id=mid or "gpt-4o")
    else:
        from agno.models.google import Gemini
        return Gemini(id=mid or settings.GEMINI_DEFAULT_MODEL)


def create_researcher_agent() -> Agent:
    """Creates the researcher agent (Research -> Gemini)."""
    return Agent(
        name="AcademicResearcher",
        role="Search academic databases and discover research sources",
        model=_get_model(provider="gemini"),
        tools=[
            DuckDuckGoTools(enable_search=True, enable_news=True),
            ArxivTools(),
        ],
        instructions=[
            "You are an expert academic researcher.",
            "Search DuckDuckGo and arXiv for relevant papers and sources.",
            "Return structured source information with title, authors, year, abstract, citations.",
            "Prioritize recent publications (last 5 years) with high citation counts.",
            "Always cite the source URL or DOI when available.",
        ],
        description="Finds and evaluates academic sources for research questions.",
        markdown=True,
        add_history_to_context=True,
        num_history_runs=2,
    )


def create_extractor_agent() -> Agent:
    """Creates the extractor agent (Extraction/Backend -> Nvidia)."""
    return Agent(
        name="ClaimExtractor",
        role="Extract research claims from discovered sources",
        model=_get_model(provider="nvidia"),
        instructions=[
            "You are a meticulous claim extraction specialist.",
            "Analyze provided research sources and extract key claims.",
            "For each claim, identify supporting sources and assign confidence scores.",
            "Distinguish between facts, findings, opinions, and speculations.",
            "Be precise: extract verifiable claims, not general statements.",
        ],
        description="Extracts verifiable claims from academic sources.",
        markdown=True,
        add_history_to_context=False,
    )


def create_critic_agent() -> Agent:
    """Creates the critic agent (Critique -> OpenRouter)."""
    return Agent(
        name="ResearchCritic",
        role="Review research quality, identify gaps and weaknesses",
        model=_get_model(provider="openrouter"),
        instructions=[
            "You are a rigorous academic reviewer and fact-checker.",
            "Review claims for methodological soundness and evidence quality.",
            "Identify unsupported assertions, logical fallacies, and missing evidence.",
            "Flag contradictions between sources.",
            "Provide constructive feedback on research quality.",
        ],
        description="Validates research claims and identifies weaknesses.",
        markdown=True,
        add_history_to_context=False,
    )


def create_verifier_agent() -> Agent:
    """Creates the verifier agent (Critique/Verification -> OpenRouter)."""
    return Agent(
        name="FactVerifier",
        role="Cross-reference claims against original sources",
        model=_get_model(provider="openrouter"),
        instructions=[
            "You are a meticulous fact-checker specializing in academic research.",
            "Cross-reference each claim against its cited source.",
            "Verify that citations actually support the claims made.",
            "Flag any misquotations or misrepresentations.",
            "Assign verification confidence scores to each claim.",
        ],
        description="Verifies claims against source documents.",
        markdown=True,
        add_history_to_context=False,
    )


def create_synthesist_agent() -> Agent:
    """Creates the synthesist agent (Research/Synthesis -> Gemini)."""
    return Agent(
        name="ResearchSynthesist",
        role="Synthesize findings into a coherent research report",
        model=_get_model(provider="gemini"),
        instructions=[
            "You are an expert academic writer and synthesist.",
            "Integrate findings from multiple sources into a coherent narrative.",
            "Identify patterns, themes, and contradictions across sources.",
            "Structure the output with clear sections: summary, key findings, methodology, limitations.",
            "Cite sources using [Source N] format for every factual claim.",
            "Write in dense academic prose. Avoid clichés and filler phrases.",
        ],
        description="Synthesizes research findings into comprehensive reports.",
        markdown=True,
        add_history_to_context=True,
        num_history_runs=3,
    )


# ── Research Team ────────────────────────────────────────────────────────────

def create_research_team(
    members: Optional[List[Agent]] = None,
    mode: str = "coordinate",
) -> Team:
    """
    Create the research team with Supervisor mode.

    Args:
        members: Optional custom list of agents. If None, uses default team.
        mode: Team mode - "coordinate" (supervisor), "collaborate", or "route".

    Returns:
        Configured Agno Team instance.
    """
    if members is None:
        members = [
            create_researcher_agent(),
            create_extractor_agent(),
            create_critic_agent(),
            create_verifier_agent(),
            create_synthesist_agent(),
        ]

    # Map mode string to TeamMode enum
    team_mode = TeamMode.coordinate  # Default: supervisor
    if mode == "collaborate":
        team_mode = TeamMode.collaborate
    elif mode == "route":
        team_mode = TeamMode.route

    team = Team(
        name="ResearchIntelligenceTeam",
        mode=team_mode,
        members=members,
        instructions=[
            "You are the research team supervisor managing a team of expert agents.",
            "Decompose complex research questions into specialized sub-tasks.",
            "Delegate tasks to the most appropriate agent based on their role.",
            "Review all agent outputs for quality and accuracy.",
            "Synthesize a comprehensive final report from team findings.",
            "If you discover contradictions, delegate verification to the FactVerifier.",
            "If sources are insufficient, delegate additional search to the AcademicResearcher.",
            "Always ground your synthesis in the evidence provided by team members.",
        ],
        markdown=True,
        add_history_to_context=True,
        num_history_runs=3,
    )

    return team


# ── Public API ───────────────────────────────────────────────────────────────

_team_instance: Optional[Team] = None


def get_research_team(mode: str = "coordinate") -> Team:
    """Get or create the research team singleton."""
    global _team_instance
    if _team_instance is None:
        _team_instance = create_research_team(mode=mode)
    return _team_instance


async def research_team_run(
    query: str,
    context: str = "",
    mode: str = "coordinate",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute a research query using the Agno Team.

    Args:
        query: The research question.
        context: Additional context (papers, documents).
        mode: Team mode (coordinate/collaborate/route).
        session_id: Optional session ID for continuity.

    Returns:
        Dict with answer, team trace, and metadata.
    """
    team = create_research_team(mode=mode)

    # Build the full prompt with context
    prompt = query
    if context:
        prompt = f"Research Question: {query}\n\nAdditional Context:\n{context}"

    try:
        response = await team.arun(
            prompt,
            session_id=session_id,
            stream=False,
        )

        return {
            "answer": response.content if hasattr(response, "content") else str(response),
            "team_mode": mode,
            "session_id": session_id,
            "success": True,
        }
    except Exception as e:
        logger.error(f"Research team execution failed: {e}", exc_info=True)
        return {
            "answer": f"Research team encountered an error: {str(e)}",
            "team_mode": mode,
            "session_id": session_id,
            "success": False,
            "error": str(e),
        }


async def research_team_stream(
    query: str,
    context: str = "",
    mode: str = "coordinate",
    session_id: Optional[str] = None,
):
    """
    Stream a research query using the Agno Team.

    Yields:
        Chunks of the research response as they're generated.
    """
    team = create_research_team(mode=mode)

    prompt = query
    if context:
        prompt = f"Research Question: {query}\n\nAdditional Context:\n{context}"

    try:
        async for event in team.arun(
            prompt,
            session_id=session_id,
            stream=True,
        ):
            if hasattr(event, "content") and event.content:
                yield event.content
    except Exception as e:
        logger.error(f"Research team stream failed: {e}", exc_info=True)
        yield f"Error: {str(e)}"
