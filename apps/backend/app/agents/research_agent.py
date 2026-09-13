"""
Tafiti AI Follow-up Research Agent
===================================
Specialized interactive agent for handling follow-up questions on existing research sessions.
Maintains multi-turn conversational context, builds upon previous synthesis and citations,
and provides rapid streaming responses.

Also houses specialized analytical capabilities that DeepResearchAgent does not perform:
- Research gap analysis across corpora (methodological, geographic, temporal, theoretical)
- Paper impact evaluation tailored to user career fields
- Concept extraction and dynamic follow-up inquiry generation
"""

from collections.abc import AsyncIterator
from typing import Any, Optional

from agno.agent import Agent
from agno.models.message import Message
from agno.models.openai import OpenAIChat
from pydantic import BaseModel

from app.core.config import settings
from app.core.logger import get_logger
from app.models.schemas import PaperBase

logger = get_logger("research_agent")


class KeyConceptsOutput(BaseModel):
    concepts: list[str]


class FollowupQuestionsOutput(BaseModel):
    questions: list[str]


class PaperImpactOutput(BaseModel):
    impact_summary: str
    relevance_score: int
    key_takeaway: str


class GapAnalysisGap(BaseModel):
    category: str
    title: str
    description: str
    suggested_questions: list[str]
    urgency: str


class GapAnalysisOutput(BaseModel):
    summary: str
    gaps: list[GapAnalysisGap]


class ResearchAgent:
    """
    Dedicated follow-up research agent and analytical toolkit.
    Handles follow-up research questions interactively with multi-turn context
    and provides corpus gap analysis & paper impact evaluation.
    """

    def __init__(self, provider: str | None = None, model: str | None = None):
        self.provider = provider or "gemini"
        self.model = model or settings.GEMINI_DEFAULT_MODEL
        self.temperature = settings.LLM_TEMPERATURE
        self.model_obj = self._build_model()

    def _build_model(self):
        """
        Build the conversational model instance for fast interactive follow-up responses.
        Uses Gemini Flash / OpenRouter / Nvidia for low latency conversational turns.
        """
        if self.provider == "gemini":
            from agno.models.google import Gemini
            model_id = self.model or "gemini-3.8-flash"
            # Avoid using deep-research batch model for conversational follow-ups
            if "deep-research" in str(model_id):
                model_id = "gemini-3.8-flash"
            return Gemini(
                id=model_id,
                api_key=settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY,
            )
        elif self.provider == "nvidia":
            return OpenAIChat(
                id=self.model or settings.NVIDIA_DEFAULT_MODEL,
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.nvidia_api_key,
            )
        elif self.provider == "openrouter":
            return OpenAIChat(
                id=self.model or settings.OPENROUTER_DEFAULT_MODEL,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        else:
            from agno.models.google import Gemini
            return Gemini(
                id="gemini-3.8-flash",
                api_key=settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY,
            )

    def _subagent_model(self, task: str = "general"):
        """Build specialized model instances for structured extraction tasks."""
        if task in ("critique", "gap_analysis") and settings.OPENROUTER_API_KEY:
            mid = settings.OPENROUTER_DEFAULT_MODEL
            if ":" in mid:
                mid = mid.split(":", 1)[1]
            return OpenAIChat(
                id=mid,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        elif settings.nvidia_api_key:
            return OpenAIChat(
                id=settings.NVIDIA_DEFAULT_MODEL,
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.nvidia_api_key,
            )
        elif settings.OPENROUTER_API_KEY:
            mid = settings.OPENROUTER_DEFAULT_MODEL
            if ":" in mid:
                mid = mid.split(":", 1)[1]
            return OpenAIChat(
                id=mid,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        from agno.models.google import Gemini
        return Gemini(
            id="gemini-3.8-flash",
            api_key=settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY,
        )

    def _fallback_model(self):
        """Fallback model if primary provider encounters errors."""
        from agno.models.google import Gemini
        if settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY:
            return Gemini(
                id="gemini-3.8-flash",
                api_key=settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY,
            )
        if settings.nvidia_api_key:
            return OpenAIChat(
                id=settings.NVIDIA_DEFAULT_MODEL,
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.nvidia_api_key,
            )
        if settings.OPENROUTER_API_KEY:
            mid = settings.OPENROUTER_DEFAULT_MODEL or "openrouter/free"
            if ":" in mid:
                mid = mid.split(":", 1)[1]
            return OpenAIChat(
                id=mid,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        return Gemini(
            id="gemini-3.8-flash",
            api_key=settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY,
        )

    def _build_context(self, papers: list[PaperBase]) -> str:
        """Format reference papers into numbered citation blocks."""
        context_parts = []
        max_context_chars = 100_000
        context_length = 0
        for i, paper in enumerate(papers, 1):
            authors = ", ".join(paper.authors) if paper.authors else "Unknown"
            source = (
                f"[Source {i}] Title: {paper.title}\n"
                f"Authors: {authors}\n"
                f"Year: {paper.year}\n"
                f"Citations: {paper.citations}\n"
                f"Abstract: {paper.abstract}\n\n"
            )
            if context_length + len(source) > max_context_chars:
                break
            context_parts.append(source)
            context_length += len(source)
        return "".join(context_parts)

    def _get_db(self):
        """Get session storage for Agno memory."""
        if settings.SUPABASE_URL and settings.DATABASE_URL and "asyncpg" not in settings.DATABASE_URL:
            try:
                from agno.db.postgres import PostgresDb
                return PostgresDb(db_url=settings.DATABASE_URL, session_table="agno_sessions")
            except Exception:
                return None
        return None

    async def stream_followup(
        self,
        query: str,
        history: list[dict[str, str]],
        career_field: Optional[str] = None,
        local_papers: Optional[list[PaperBase]] = None,
        uploaded_context: str = "",
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Stream conversational follow-up research answers.
        Maintains full context from prior research inquiry, deep research synthesis,
        and user-provided documents.

        Yields structured SSE dict events:
        - {"type": "thought", "signature": str, "content": str}
        - {"type": "text", "content": str}
        - {"type": "completed", "output": str}
        """
        logger.info(f"[ResearchAgent] Handling follow-up question: '{query[:80]}'")
        yield {
            "type": "thought",
            "signature": "Research Continuity",
            "content": "Analyzing follow-up in context of previous literature findings...",
        }

        # Resolve active research thread papers (from explicit argument or prior history)
        thread_papers = list(local_papers or [])
        if not thread_papers and history:
            for turn in reversed(history):
                turn_sources = turn.get("sources")
                if turn_sources and isinstance(turn_sources, list):
                    for idx, s in enumerate(turn_sources, 1):
                        if isinstance(s, dict):
                            p_title = s.get("title") or f"Source {idx}"
                            p_id = s.get("id") or s.get("paper_id") or s.get("url") or f"src_{idx}"
                            p_year = s.get("year")
                            p_authors = s.get("authors") or ([s.get("author")] if s.get("author") else [])
                            p_abstract = s.get("abstract") or s.get("excerpt") or ""
                            p_cites = s.get("citations") or 0
                            thread_papers.append(
                                PaperBase(
                                    id=str(p_id),
                                    title=p_title,
                                    year=p_year if isinstance(p_year, int) else None,
                                    citations=p_cites if isinstance(p_cites, int) else 0,
                                    abstract=p_abstract,
                                    authors=p_authors if isinstance(p_authors, list) else [],
                                )
                            )
                    if thread_papers:
                        break

        system_content = (
            "You are an expert academic research advisor continuing an active research investigation thread.\n"
            "This follow-up question is part of the same research thread as the previous messages.\n"
            "Guidelines:\n"
            "1. Maintain deep continuity with the prior research synthesis, questions, and evidence established in this thread.\n"
            "2. Refer directly to the literature and findings already established without asking the user to repeat context.\n"
            "3. When referring to evidence from the thread's literature, cite them accurately using [Source N] notation.\n"
            "4. Answer the user's specific follow-up question directly, rigorously, and accurately.\n"
            "5. If exploring methodological nuances, counterarguments, or practical extensions, be academically precise.\n"
            "6. Do not re-summarize the entire previous answer unless explicitly asked; focus on answering the follow-up question directly."
        )

        if career_field:
            system_content += f"\n\nUser Career Field / Context: {career_field}"

        if thread_papers:
            system_content += f"\n\nActive Research Thread Literature:\n{self._build_context(thread_papers)}"

        if uploaded_context:
            system_content += f"\n\nUploaded Document Excerpt:\n{uploaded_context[:3000]}"

        # Assemble messages from recent conversation history
        messages: list[Message] = []
        for m in history[-10:]:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append(Message(role=role, content=content))
        messages.append(Message(role="user", content=query))

        # Optional tools for live lookup
        agent_tools: list[Any] = []
        try:
            from agno.tools.duckduckgo import DuckDuckGoTools
            from agno.tools.arxiv import ArxivTools
            agent_tools.extend([DuckDuckGoTools(), ArxivTools()])
        except Exception as e:
            logger.debug(f"Could not load search/arxiv tools: {e}")

        if settings.PARALLEL_API_KEY:
            try:
                from app.services.parallel_service import ParallelTools
                agent_tools.append(ParallelTools())
            except Exception as e:
                logger.debug(f"Could not load ParallelTools: {e}")

        model = self.model_obj or self._fallback_model()
        agent = Agent(
            model=model,
            instructions=[system_content],
            tools=agent_tools if agent_tools else None,
            db=self._get_db(),
            add_history_to_context=True,
            num_history_runs=len(messages),
        )

        full_output = []
        has_yielded = False

        try:
            async for event in agent.arun(messages, stream=True):
                # 1. Thinking / reasoning step
                reasoning = getattr(event, "reasoning_content", None)
                if reasoning:
                    yield {
                        "type": "thought",
                        "signature": "Reasoning Step",
                        "content": str(reasoning),
                    }
                # 2. Content delta
                elif hasattr(event, "content") and event.content:
                    content_str = str(event.content)
                    if (
                        '{"error"' in content_str
                        or "ACCESS_TOKEN_TYPE_UNSUPPORTED" in content_str
                        or "ClientResponse" in content_str
                        or "404 Not Found" in content_str
                        or "generativelanguage.googleapis.com" in content_str
                    ):
                        logger.error(f"Suppressed raw LLM error from primary follow-up agent: {content_str[:150]}")
                        raise RuntimeError(f"Primary model returned error: {content_str[:150]}")
                    has_yielded = True
                    full_output.append(content_str)
                    yield {"type": "text", "content": content_str}

        except Exception as primary_err:
            logger.warning(f"Primary model failed in follow-up stream: {primary_err}. Triggering fallback model.")
            if not has_yielded:
                fallback = self._fallback_model()
                fb_agent = Agent(
                    model=fallback,
                    instructions=[system_content],
                    tools=agent_tools if agent_tools else None,
                    db=self._get_db(),
                    add_history_to_context=False,
                )
                try:
                    async for event in fb_agent.arun(messages, stream=True):
                        if hasattr(event, "content") and event.content:
                            content_str = str(event.content)
                            if (
                                '{"error"' not in content_str
                                and "ACCESS_TOKEN_TYPE_UNSUPPORTED" not in content_str
                                and "ClientResponse" not in content_str
                                and "404 Not Found" not in content_str
                            ):
                                full_output.append(content_str)
                                yield {"type": "text", "content": content_str}
                except Exception as fb_err:
                    logger.error(f"Fallback model also failed in follow-up stream: {fb_err}")

        combined_text = "".join(full_output)
        yield {
            "type": "completed",
            "output": combined_text,
        }

    async def chat_research_streaming(
        self,
        query: str,
        history: list[dict[str, str]],
        local_papers: list[PaperBase] | None = None,
        uploaded_context: str = "",
    ) -> AsyncIterator[str]:
        """Backward-compatible string token stream for chat."""
        async for chunk in self.stream_followup(
            query=query,
            history=history,
            local_papers=local_papers,
            uploaded_context=uploaded_context,
        ):
            if chunk.get("type") == "text":
                yield chunk.get("content", "")

    async def extract_key_concepts(self, text: str) -> list[str]:
        """Extract 3-5 key academic concepts from text."""
        agent = Agent(
            model=self._subagent_model("extraction"),
            instructions=["Extract 3-5 key concepts/topics from the following text."],
            output_schema=KeyConceptsOutput,
        )
        response = await agent.arun(text)
        if response and response.content and hasattr(response.content, "concepts"):
            return response.content.concepts
        return []

    async def generate_followup_questions(
        self,
        context: str,
        query: str,
    ) -> list[str]:
        """Generate 3-5 follow-up research questions after a response."""
        agent = Agent(
            model=self._subagent_model("extraction"),
            instructions=[
                "You are a research advisor. Given the following research context and query, "
                "generate exactly 4 concise, specific follow-up research questions that would "
                "deepen understanding of the topic."
            ],
            output_schema=FollowupQuestionsOutput,
        )
        try:
            response = await agent.arun(f"Context: {context}\nQuery: {query}")
            if response and response.content and hasattr(response.content, "questions"):
                return response.content.questions[:5]
        except Exception as e:
            logger.warning(f"Follow-up question generation failed: {e}")

        # Fallback questions
        from app.services.academic_query_processor import deconstruct_academic_query
        target_topic = deconstruct_academic_query(query).topic or query
        return [
            f"What methodological improvements could strengthen research on {target_topic}?",
            f"Which populations or regions are underrepresented in {target_topic} studies?",
            f"What are the practical applications of recent findings in {target_topic}?",
            f"How do contradictory findings in {target_topic} challenge existing theoretical frameworks?",
        ]

    async def suggest_follow_up(self, query: str, answer: str) -> list[str]:
        """Alias for generate_followup_questions."""
        return await self.generate_followup_questions(context=answer[:1000], query=query)

    async def explain_paper_impact(
        self,
        paper: PaperBase,
        career_field: str,
    ) -> dict[str, Any]:
        """
        Explain why a specific paper matters to a user given their career field.
        Returns structured impact data with relevance score and key takeaway.
        """
        agent = Agent(
            model=self._subagent_model("extraction"),
            instructions=[
                "You are a research mentor helping a professional understand the relevance "
                "of academic papers to their specific career field."
            ],
            output_schema=PaperImpactOutput,
        )

        human_content = f"Paper: {paper.title}\n\nAbstract: {paper.abstract}\n\nCareer Field: {career_field}"

        data: dict[str, Any] = {
            "impact_summary": f"This paper contributes to research relevant to {career_field}.",
            "relevance_score": 5,
            "key_takeaway": paper.title,
        }
        try:
            response = await agent.arun(human_content)
            resp_content = getattr(response, "content", None)
            if resp_content and hasattr(resp_content, "model_dump"):
                dumped = resp_content.model_dump()
                if isinstance(dumped, dict):
                    data = dict(dumped)
            elif isinstance(resp_content, dict):
                data = dict(resp_content)
        except Exception as e:
            logger.warning(f"Paper impact explanation failed: {e}")
        return data

    async def analyze_research_gaps(
        self,
        papers: list[PaperBase],
        research_context: str | None = None,
    ) -> dict[str, Any]:
        """
        Analyzes a corpus of papers and identifies what is missing:
        geographic, methodological, temporal, demographic, and theoretical gaps.
        """
        context = self._build_context(papers)
        context_clause = (
            f"\nThe student's research context: {research_context}\n"
            if research_context
            else ""
        )

        system_prompt = """You are a senior academic research advisor and PhD supervisor.
Your task is to perform a rigorous Gap Analysis on a student's research corpus.

A "research gap" is something that the provided papers collectively do NOT address —
an unstudied population, unexplored methodology, missing geography, ignored time period,
untested theory, or an absent interdisciplinary perspective.

Return between 4 and 7 gaps. Be specific and scholarly. Do NOT invent papers; only analyze what is given."""

        agent = Agent(
            model=self._subagent_model("gap_analysis"),
            instructions=[system_prompt],
            output_schema=GapAnalysisOutput,
        )

        user_prompt = f"""Research Corpus ({len(papers)} papers):

{context}{context_clause}

Perform the Gap Analysis and return only the JSON object:"""

        try:
            response = await agent.arun(user_prompt)
            resp_content = getattr(response, "content", None)
            if resp_content and hasattr(resp_content, "model_dump"):
                dumped = resp_content.model_dump()
                if isinstance(dumped, dict):
                    return dict(dumped)
            elif isinstance(resp_content, dict):
                return dict(resp_content)
            raise ValueError("LLM response missing structured content")
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            raise ValueError("LLM failed to generate valid gap analysis data.")


_research_agent_instance: Optional[ResearchAgent] = None


def get_research_agent(provider: str | None = None, model: str | None = None) -> ResearchAgent:
    """Singleton factory for ResearchAgent."""
    global _research_agent_instance
    if _research_agent_instance is None or provider is not None or model is not None:
        _research_agent_instance = ResearchAgent(provider=provider, model=model)
    return _research_agent_instance
