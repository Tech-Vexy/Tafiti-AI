from collections.abc import AsyncIterator
from typing import Any, Optional
import asyncio

from agno.agent import Agent
from agno.models.groq import Groq as GroqModel
from agno.models.openai import OpenAIChat
from agno.models.message import Message
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.arxiv import ArxivTools
from agno.db.postgres import PostgresDb
from pydantic import BaseModel
import json
import re

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
    def __init__(self, provider: str | None = None, model: str | None = None):
        self.provider = provider or "gemini"
        self.model = model or settings.GEMINI_DEFAULT_MODEL

        # Build Agno 2.x model object
        self.model_obj = self._build_model()

    def _build_model(self):
        """Build the appropriate Agno 2.x model instance."""
        if self.provider == "gemini":
            from agno.models.google import Gemini
            model_id = self.model or settings.GEMINI_DEFAULT_MODEL
            if "deep-research" in (model_id or ""):
                model_id = "gemini-3.5-pro"
            return Gemini(id=model_id)
        elif self.provider == "nvidia":
            from agno.models.openai import OpenAIChat
            return OpenAIChat(
                id=self.model or settings.NVIDIA_DEFAULT_MODEL,
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.nvidia_api_key,
            )
        elif self.provider == "openrouter":
            from agno.models.openai import OpenAIChat
            return OpenAIChat(
                id=self.model or settings.OPENROUTER_DEFAULT_MODEL,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        elif self.provider == "openai":
            from agno.models.openai import OpenAIChat
            return OpenAIChat(id=self.model or "gpt-4o")
        else:
            from agno.models.google import Gemini
            return Gemini(id=self.model or settings.GEMINI_DEFAULT_MODEL)

        self.temperature = settings.LLM_TEMPERATURE

    def _build_context(self, papers: list[PaperBase]) -> str:
        context = ""
        for i, paper in enumerate(papers, 1):
            authors = ", ".join(paper.authors) if paper.authors else "Unknown"
            context += f"[Source {i}] Title: {paper.title}\n"
            context += f"Authors: {authors}\n"
            context += f"Year: {paper.year}\n"
            context += f"Citations: {paper.citations}\n"
            context += f"Abstract: {paper.abstract}\n\n"
        return context
    
    def _build_system_prompt(self, output_language: str = "English") -> str:
        language_rule = (
            f"8. LANGUAGE: Write the ENTIRE synthesis in {output_language}. "
            f"Even if the source papers are in English, your response MUST be written "
            f"fully and fluently in {output_language}. Do NOT include English text unless "
            f"quoting a source directly (and even then, add a translation in {output_language})."
            if output_language.lower() not in ("english", "en")
            else ""
        )
        return f"""You are an expert academic researcher and synthesis specialist.
Your task is to write a comprehensive, well-structured synthesis of research papers.

STRICT GUIDELINES:
1. GROUNDING: Answer ONLY using the provided context. Never use external knowledge.
2. CITATIONS: MUST cite sources inline using [Source N] format for every claim.
3. STYLE: Write in dense academic prose. Avoid clichés like "In conclusion" or "It is important to note".
4. HONESTY: If papers don't cover an aspect, explicitly state "The provided research does not address this aspect."
5. STRUCTURE: Organize logically with clear topic sentences and smooth transitions.
6. DEPTH: Synthesize across sources, identify patterns, and highlight contradictions.
7. PRECISION: Use specific data, findings, and quotes when relevant.
{language_rule}

Your synthesis should demonstrate critical thinking and scholarly rigor."""

    def _build_human_message(self, query: str, context: str, rag_context: str = "") -> str:
        parts = [f"Context:\n{context}"]
        if rag_context:
            parts.append(
                f"Additional Retrieved Context (from knowledge base):\n{rag_context}"
            )
        parts.append(f"\nQuestion: {query}\n\nProvide a comprehensive synthesis:")
        return "\n\n".join(parts)

    def _get_db(self):
        """Get Supabase-backed session storage for Agno memory."""
        if settings.SUPABASE_URL and settings.DATABASE_URL:
            return PostgresDb(db_url=settings.DATABASE_URL, session_table="agno_sessions")
        return None

    async def synthesize_streaming(
        self,
        query: str,
        papers: list[PaperBase],
        output_language: str = "English",
        rag_context: str = "",
    ) -> AsyncIterator[str]:
        context = self._build_context(papers)
        system_prompt = self._build_system_prompt(output_language=output_language)
        human_content = self._build_human_message(query, context, rag_context)

        agent = Agent(
            model=self.model_obj,
            instructions=[system_prompt],
            db=self._get_db(),
            add_history_to_context=True,
            num_history_runs=2,
        )

        async for event in agent.arun(human_content, stream=True):
            if hasattr(event, "content") and event.content:
                yield event.content

    async def synthesize(
        self,
        query: str,
        papers: list[PaperBase],
        output_language: str = "English",
        rag_context: str = "",
    ) -> dict[str, Any]:
        context = self._build_context(papers)
        system_prompt = self._build_system_prompt(output_language=output_language)
        human_content = self._build_human_message(query, context, rag_context)

        # If Deep Research is explicitly configured or requested, run via DeepResearchAgent (Interactions API)
        if self.provider == "deep-research" or (self.model and "deep-research" in self.model):
            try:
                from app.agents.deep_research_agent import get_deep_research_agent
                dr_agent = get_deep_research_agent()
                engine = "gemini-max" if (self.model and "max" in self.model) else "gemini"
                interaction_id = await dr_agent.start_research(
                    query=f"Synthesize the following academic research papers on '{query}':\n\n{human_content}",
                    engine=engine,
                )
                for _ in range(15):
                    await asyncio.sleep(2)
                    status_info = await dr_agent.get_research_status(interaction_id)
                    if status_info["status"] == "completed" and status_info.get("output"):
                        return {
                            "answer": status_info["output"],
                            "sources_used": list(range(1, len(papers) + 1)),
                            "model": self.model,
                            "provider": "deep-research",
                            "interaction_id": interaction_id,
                        }
                    elif status_info["status"] == "failed":
                        logger.warning(f"Deep research synthesis failed: {status_info.get('error')}, falling back to pro model")
                        break
            except Exception as dr_err:
                logger.warning(f"Deep research agent invocation error: {dr_err}, falling back to pro model")

        agent = Agent(
            model=self.model_obj,
            instructions=[system_prompt],
            db=self._get_db(),
        )

        response = await agent.arun(human_content)

        return {
            "answer": response.content,
            "sources_used": list(range(1, len(papers) + 1)),
            "model": self.model,
            "provider": self.provider
        }
    
    async def extract_key_concepts(self, text: str) -> list[str]:
        agent = Agent(
            model=self.model_obj,
            instructions=["Extract 3-5 key concepts/topics from the following text."],
            output_schema=KeyConceptsOutput
        )
        
        response = await agent.arun(text)
        if response and response.content and hasattr(response.content, "concepts"):
            return response.content.concepts
        return []
    
    async def suggest_follow_up(self, query: str, answer: str) -> list[str]:
        agent = Agent(
            model=self.model_obj,
            instructions=["Based on the research query and answer, suggest 3 relevant follow-up research questions."],
            output_schema=FollowupQuestionsOutput
        )
        
        response = await agent.arun(f"Query: {query}\n\nAnswer: {answer[:500]}...")
        if response and response.content and hasattr(response.content, "questions"):
            return response.content.questions[:3]
        return []

    async def generate_followup_questions(
        self,
        context: str,
        query: str
    ) -> list[str]:
        """Generate 3-5 follow-up research questions after a synthesis."""
        agent = Agent(
            model=self.model_obj,
            instructions=[(
                "You are a research advisor. Given the following research context and query, "
                "generate exactly 4 concise, specific follow-up research questions that would "
                "deepen understanding of the topic."
            )],
            output_schema=FollowupQuestionsOutput
        )
        try:
            response = await agent.arun(f"Context: {context}\nQuery: {query}")
            if response and response.content and hasattr(response.content, "questions"):
                return response.content.questions[:5]
        except Exception as e:
            logger.warning(f"Follow-up question generation failed: {e}")
        # Fallback
        return [
            f"What methodological improvements could strengthen research on {query}?",
            f"Which populations or regions are underrepresented in {query} studies?",
            f"What are the practical applications of recent findings in {query}?",
        ]

    async def chat_research_streaming(
        self,
        query: str,
        history: list[dict[str, str]],
        local_papers: list["PaperBase"],
        uploaded_context: str = ""
    ) -> AsyncIterator[str]:
        """
        Streaming conversational research assistant.
        Grounds responses in provided papers and uploaded document context.
        """
        system_content = (
            "You are an expert research assistant with deep scholarly knowledge. "
            "Answer questions accurately and concisely, citing provided sources with [Source N] "
            "when evidence is available. If the question goes beyond the provided context, "
            "clearly indicate that and draw on general academic knowledge. "
            "Be direct, precise, and academically rigorous."
        )

        if local_papers:
            papers_context = self._build_context(local_papers)
            system_content += f"\n\nAvailable research sources:\n{papers_context}"

        if uploaded_context:
            system_content += f"\n\nUploaded document content:\n{uploaded_context[:3000]}"

        # Map history directly since Agno's `input` can accept list of Dicts or Message objects
        messages = [Message(role=m["role"], content=m["content"]) for m in history[-8:]]
        messages.append(Message(role="user", content=query))

        agent_tools: list[Any] = [DuckDuckGoTools(), ArxivTools()]
        if settings.PARALLEL_API_KEY:
            try:
                from app.services.parallel_service import ParallelTools
                agent_tools.append(ParallelTools())
            except Exception as e:
                logger.warning(f"Could not load ParallelTools: {e}")

        agent = Agent(
            model=self.model_obj,
            instructions=[system_content],
            tools=agent_tools,
            db=self._get_db(),
            add_history_to_context=True,
            num_history_runs=3,
            enable_user_memories=True,
            add_memories_to_context=True,
        )

        async for event in agent.arun(messages, stream=True):
            if hasattr(event, "content") and event.content:
                yield event.content

    async def collaborate_research_streaming(
        self,
        query: str,
        papers: list["PaperBase"]
    ) -> AsyncIterator[str]:
        """
        Multi-perspective collaborative synthesis.
        Simulates two analytical lenses: critical analysis + constructive synthesis.
        """
        context = self._build_context(papers)

        system_prompt = (
            "You are two expert academic voices collaborating on a research synthesis:\n\n"
            "**Voice 1 — The Critic**: Rigorously examines limitations, contradictions, "
            "methodological weaknesses, and unresolved debates across the papers.\n\n"
            "**Voice 2 — The Synthesist**: Identifies convergent findings, theoretical "
            "frameworks, practical implications, and promising directions.\n\n"
            "Structure your response clearly with both perspectives, using [Source N] citations. "
            "End with a unified 'Collaborative Conclusion' that integrates both views."
        )

        agent = Agent(
            model=self.model_obj,
            instructions=[system_prompt]
        )

        async for event in agent.arun(f"Query: {query}\n\nContext: {context}", stream=True):
            if hasattr(event, "content") and event.content:
                yield event.content

    async def explain_paper_impact(
        self,
        paper: "PaperBase",
        career_field: str
    ) -> dict[str, Any]:
        """
        Explain why a specific paper matters to a user given their career field.
        Returns structured impact data with relevance score and key takeaway.
        """
        agent = Agent(
            model=self.model_obj,
            instructions=[(
                "You are a research mentor helping a professional understand the relevance "
                "of academic papers to their specific career field."
            )],
            output_schema=PaperImpactOutput
        )

        human_content = f"Paper: {paper.title}\n\nAbstract: {paper.abstract}\n\nCareer Field: {career_field}"

        data: dict[str, Any] = {
            "impact_summary": f"This paper contributes to research relevant to {career_field}.",
            "relevance_score": 5,
            "key_takeaway": paper.title,
        }
        try:
            response = await agent.arun(human_content)
            if response and response.content and hasattr(response.content, "model_dump"):
                dumped = response.content.model_dump()
                if isinstance(dumped, dict):
                    data = dict(dumped)
            elif isinstance(getattr(response, "content", None), dict):
                data = dict(response.content)
        except Exception as e:
            logger.warning(f"Paper impact explanation failed: {e}")
        return data

    async def analyze_research_gaps(
        self,
        papers: list[PaperBase],
        research_context: str | None = None
    ) -> dict[str, Any]:
        """
        Analyzes a corpus of papers and identifies what is missing —
        geographic, methodological, temporal, demographic, and theoretical gaps.
        Returns a structured JSON object with gap objects.
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
            model=self.model_obj,
            instructions=[system_prompt],
            output_schema=GapAnalysisOutput
        )

        user_prompt = f"""Research Corpus ({len(papers)} papers):

{context}{context_clause}

Perform the Gap Analysis and return only the JSON object:"""

        try:
            response = await agent.arun(user_prompt)
            if response and response.content and hasattr(response.content, "model_dump"):
                dumped = response.content.model_dump()
                if isinstance(dumped, dict):
                    return dict(dumped)
            elif isinstance(getattr(response, "content", None), dict):
                return dict(response.content)
            raise ValueError("LLM response missing structured content")
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            raise ValueError("LLM failed to generate valid gap analysis data.")

def get_research_agent(provider: str | None = None, model: str | None = None) -> ResearchAgent:
    return ResearchAgent(provider=provider, model=model)
