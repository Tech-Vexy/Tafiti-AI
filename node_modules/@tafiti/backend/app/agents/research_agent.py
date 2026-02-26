from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from typing import List, Dict, Any, Optional, AsyncIterator
import asyncio
import json
import re

from app.core.config import settings
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("research_agent")


class ResearchAgent:
    def __init__(self, provider: str = None, model: str = None):
        self.provider = provider or settings.DEFAULT_LLM_PROVIDER
        self.model = model or settings.DEFAULT_LLM_MODEL

        if self.provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            self.llm = ChatGoogleGenerativeAI(
                model=self.model or "gemini-1.5-flash",
                temperature=settings.LLM_TEMPERATURE,
                max_output_tokens=settings.LLM_MAX_TOKENS,
                google_api_key=settings.GOOGLE_API_KEY,
                streaming=True,
            )
        else:
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
        papers: List[PaperBase],
        output_language: str = "English",
        rag_context: str = "",
    ) -> AsyncIterator[str]:
        context = self._build_context(papers)
        system_prompt = self._build_system_prompt(output_language=output_language)
        human_content = self._build_human_message(query, context, rag_context)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_content),
        ]

        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content

    async def synthesize(
        self,
        query: str,
        papers: List[PaperBase],
        output_language: str = "English",
        rag_context: str = "",
    ) -> Dict[str, Any]:
        context = self._build_context(papers)
        system_prompt = self._build_system_prompt(output_language=output_language)
        human_content = self._build_human_message(query, context, rag_context)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_content),
        ]

        response = await self.llm.agenerate([messages])
        answer = response.generations[0][0].text

        return {
            "answer": answer,
            "sources_used": list(range(1, len(papers) + 1)),
            "model": self.model,
            "provider": self.provider
        }
    
    async def extract_key_concepts(self, text: str) -> List[str]:
        messages = [
            SystemMessage(content="Extract 3-5 key concepts/topics from the following text. Return as comma-separated list."),
            HumanMessage(content=text)
        ]
        
        response = await self.llm.agenerate([messages])
        concepts_text = response.generations[0][0].text
        return [c.strip() for c in concepts_text.split(",")]
    
    async def suggest_follow_up(self, query: str, answer: str) -> List[str]:
        messages = [
            SystemMessage(content="Based on the research query and answer, suggest 3 relevant follow-up research questions. Return as numbered list."),
            HumanMessage(content=f"Query: {query}\n\nAnswer: {answer[:500]}...")
        ]
        
        response = await self.llm.agenerate([messages])
        suggestions_text = response.generations[0][0].text
        
        suggestions = []
        for line in suggestions_text.split("\n"):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith("-")):
                suggestions.append(line.lstrip("0123456789.-) "))
        
        return suggestions[:3]

    async def generate_followup_questions(
        self,
        context: str,
        query: str
    ) -> List[str]:
        """Generate 3-5 follow-up research questions after a synthesis."""
        messages = [
            SystemMessage(content=(
                "You are a research advisor. Given the following research context and query, "
                "generate exactly 4 concise, specific follow-up research questions that would "
                "deepen understanding of the topic. Return them as a JSON array of strings only, "
                "no other text. Example: [\"Question 1?\", \"Question 2?\"]"
            )),
            HumanMessage(content=f"Query: {query}\n\nContext excerpt:\n{context[:1500]}")
        ]
        try:
            response = await self.llm.agenerate([messages])
            raw = response.generations[0][0].text.strip()
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
        history: List[Dict[str, str]],
        local_papers: List["PaperBase"],
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

        messages = [SystemMessage(content=system_content)]
        for msg in history[-8:]:  # Keep last 8 messages for context window efficiency
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                from langchain_core.messages import AIMessage
                messages.append(AIMessage(content=msg["content"]))
        messages.append(HumanMessage(content=query))

        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content

    async def collaborate_research_streaming(
        self,
        query: str,
        papers: List["PaperBase"]
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

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Research Question: {query}\n\nCorpus:\n{context}\n\nBegin collaborative analysis:")
        ]

        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content

    async def explain_paper_impact(
        self,
        paper: "PaperBase",
        career_field: str
    ) -> Dict[str, Any]:
        """
        Explain why a specific paper matters to a user given their career field.
        Returns structured impact data with relevance score and key takeaway.
        """
        messages = [
            SystemMessage(content=(
                "You are a research mentor helping a professional understand the relevance "
                "of academic papers to their specific career field. "
                "Return ONLY a valid JSON object with exactly these keys: "
                "impact_summary (2-3 sentence explanation), "
                "relevance_score (integer 1-10), "
                "key_takeaway (one sentence, the single most actionable insight). "
                "No markdown fences, no extra text."
            )),
            HumanMessage(content=(
                f"Career field: {career_field}\n\n"
                f"Paper title: {paper.title}\n"
                f"Authors: {', '.join(paper.authors or [])}\n"
                f"Year: {paper.year}\n"
                f"Citations: {paper.citations}\n"
                f"Abstract: {paper.abstract or 'No abstract available.'}\n\n"
                f"Explain the impact of this paper for someone in {career_field}:"
            ))
        ]

        response = await self.llm.agenerate([messages])
        raw = response.generations[0][0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                data = {
                    "impact_summary": f"This paper contributes to research relevant to {career_field}.",
                    "relevance_score": 5,
                    "key_takeaway": paper.title,
                }
        return data

    async def analyze_research_gaps(
        self,
        papers: List[PaperBase],
        research_context: Optional[str] = None
    ) -> Dict[str, Any]:
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

You MUST return your answer as a single valid JSON object — no markdown fences, no extra text.
The JSON must have exactly this structure:
{
  "summary": "A 2-3 sentence executive summary of what the corpus covers and what is missing overall.",
  "gaps": [
    {
      "category": "Geographic",
      "title": "Short descriptive title of the gap",
      "description": "2-3 sentence explanation of why this gap exists in the corpus and why it matters.",
      "suggested_questions": [
        "A concrete, researchable question that would fill this gap.",
        "A second researchable question."
      ],
      "urgency": "High"
    }
  ]
}

CATEGORY must be one of: Geographic, Methodological, Temporal, Demographic, Theoretical, Interdisciplinary
URGENCY must be one of: High, Medium, Low
Return between 4 and 7 gaps. Be specific and scholarly. Do NOT invent papers; only analyze what is given."""

        user_prompt = f"""Research Corpus ({len(papers)} papers):

{context}{context_clause}

Perform the Gap Analysis and return only the JSON object:"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        response = await self.llm.agenerate([messages])
        raw_text = response.generations[0][0].text.strip()

        # Strip markdown fences if the LLM wraps in ```json ... ```
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError:
            # Attempt to extract JSON block if there is surrounding text
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"LLM did not return valid JSON. Raw output: {raw_text[:300]}")

        return data


def get_research_agent(provider: str = None, model: str = None) -> ResearchAgent:
    return ResearchAgent(provider=provider, model=model)
