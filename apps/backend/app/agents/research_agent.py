from collections.abc import AsyncIterator
from typing import Any

from agno.agent import Agent
from agno.models.message import Message
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.arxiv import ArxivTools
from agno.db.sqlite import SqliteDb
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.arxiv import ArxivTools
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from langchain_core.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from typing import List, Dict, Any, Optional, AsyncIterator, TypedDict, Annotated
import asyncio
from langchain_core.messages import HumanMessage, SystemMessage
from typing import List, Dict, Any, Optional, AsyncIterator
import json
import re
import operator

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

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
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

class ResearchAgent:
    def __init__(self, provider: str = None, model: str = None):
        self.provider = provider or settings.DEFAULT_LLM_PROVIDER
        self.model = model or settings.DEFAULT_LLM_MODEL

        # Agno model string: "provider:model_id"
        # However, for groq, openai, google, we can use canonical strings
        if self.provider == "gemini":
            self.model_str = f"google:{self.model or settings.GEMINI_DEFAULT_MODEL}"
        elif self.provider == "groq":
            self.model_str = f"groq:{self.model}"
        elif self.provider == "openai":
            self.model_str = f"openai:{self.model}"
        else:
            self.model_str = f"{self.provider}:{self.model}"

        self.temperature = settings.LLM_TEMPERATURE
    
    def _build_context(self, papers: list[PaperBase]) -> str:
            if self.provider == "groq":
                base_url = "https://api.groq.com/openai/v1"
                api_key = settings.GROQ_API_KEY
            elif self.provider == "openai":
                base_url = None
                api_key = settings.OPENAI_API_KEY
            else:
                base_url = "http://localhost:11434/v1"
                api_key = "ollama"

            self.llm = ChatOpenAI(
                model_name=self.model,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                openai_api_base=base_url,
                openai_api_key=api_key,
                streaming=True,
            )

        # Initialize the state graph
        workflow = StateGraph(AgentState)

        # Define the nodes
        workflow.add_node("agent", self._call_model)

        # Define the edges
        workflow.add_edge(START, "agent")
        workflow.add_edge("agent", END)

        # Compile the workflow
        self.app = workflow.compile()

    async def _call_model(self, state: AgentState):
        messages = state["messages"]
        response = await self.llm.ainvoke(messages)
        # We return a list, because this will get added to the existing list
        return {"messages": [response]}

    def _build_context(self, papers: List[PaperBase]) -> str:
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
            model=self.model_str,
            system_message=system_prompt
        )

        async for event in agent.arun(human_content, stream=True):
            if hasattr(event, "content") and event.content:
                yield event.content
        async for event in self.app.astream_events({"messages": messages}, version="v2"):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield chunk.content

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

        agent = Agent(
            model=self.model_str,
            system_message=system_prompt
        )

        response = await agent.arun(human_content)
        state = await self.app.ainvoke({"messages": messages})
        answer = state["messages"][-1].content

        return {
            "answer": response.content,
            "sources_used": list(range(1, len(papers) + 1)),
            "model": self.model,
            "provider": self.provider
        }
    
    async def extract_key_concepts(self, text: str) -> list[str]:
        agent = Agent(
            model=self.model_str,
            system_message="Extract 3-5 key concepts/topics from the following text.",
            output_schema=KeyConceptsOutput
        )
        
        response = await agent.arun(text)
        return response.content.concepts
    
    async def suggest_follow_up(self, query: str, answer: str) -> list[str]:
        agent = Agent(
            model=self.model_str,
            system_message="Based on the research query and answer, suggest 3 relevant follow-up research questions.",
            output_schema=FollowupQuestionsOutput
        )
        state = await self.app.ainvoke({"messages": messages})
        concepts_text = state["messages"][-1].content
        return [c.strip() for c in concepts_text.split(",")]
    
    async def suggest_follow_up(self, query: str, answer: str) -> List[str]:
        messages = [
            SystemMessage(content="Based on the research query and answer, suggest 3 relevant follow-up research questions. Return as numbered list."),
            HumanMessage(content=f"Query: {query}\n\nAnswer: {answer[:500]}...")
        ]
        
        state = await self.app.ainvoke({"messages": messages})
        suggestions_text = state["messages"][-1].content
        
        suggestions = []
        for line in suggestions_text.split("\n"):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith("-")):
                suggestions.append(line.lstrip("0123456789.-) "))
        
        response = await agent.arun(f"Query: {query}\n\nAnswer: {answer[:500]}...")
        return response.content.questions[:3]

    async def generate_followup_questions(
        self,
        context: str,
        query: str
    ) -> list[str]:
        """Generate 3-5 follow-up research questions after a synthesis."""
        agent = Agent(
            model=self.model_str,
            system_message=(
                "You are a research advisor. Given the following research context and query, "
                "generate exactly 4 concise, specific follow-up research questions that would "
                "deepen understanding of the topic."
            ),
            output_schema=FollowupQuestionsOutput
        )
        try:
            state = await self.app.ainvoke({"messages": messages})
            raw = state["messages"][-1].content.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            questions = json.loads(raw)
            if isinstance(questions, list):
                return [str(q) for q in questions[:5]]
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

        agent = Agent(
            model=self.model_str,
            system_message=system_content,
            tools=[DuckDuckGoTools(), ArxivTools()],
            db=SqliteDb(db_file="tmp/memory.db"),
            add_history_to_context=True,
            num_history_runs=3,
        )

        async for event in self.app.astream_events({"messages": messages}, version="v2"):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield chunk.content

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
            model=self.model_str,
            system_message=system_prompt
        )

        async for event in self.app.astream_events({"messages": messages}, version="v2"):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield chunk.content

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
            model=self.model_str,
            system_message=(
                "You are a research mentor helping a professional understand the relevance "
                "of academic papers to their specific career field."
            ),
            output_schema=PaperImpactOutput
        )

        state = await self.app.ainvoke({"messages": messages})
        raw = state["messages"][-1].content.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        try:
            response = await agent.arun(human_content)
            data = response.content.dict()
        except Exception as e:
            logger.warning(f"Paper impact explanation failed: {e}")
            data = {
                "impact_summary": f"This paper contributes to research relevant to {career_field}.",
                "relevance_score": 5,
                "key_takeaway": paper.title,
            }
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
            model=self.model_str,
            system_message=system_prompt,
            output_schema=GapAnalysisOutput
        )

        user_prompt = f"""Research Corpus ({len(papers)} papers):

{context}{context_clause}

Perform the Gap Analysis and return only the JSON object:"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        state = await self.app.ainvoke({"messages": messages})
        raw_text = state["messages"][-1].content.strip()

        # Strip markdown fences if the LLM wraps in ```json ... ```
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)

        try:
            response = await agent.arun(user_prompt)
            return response.content.dict()
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            raise ValueError("LLM failed to generate valid gap analysis data.")

def get_research_agent(provider: str = None, model: str = None) -> ResearchAgent:
    return ResearchAgent(provider=provider, model=model)
