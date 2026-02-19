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


class ResearchAgent:
    def __init__(self, provider: str = None, model: str = None):
        self.provider = provider or settings.DEFAULT_LLM_PROVIDER
        self.model = model or settings.DEFAULT_LLM_MODEL
        
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
            streaming=True
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

    async def synthesize_streaming(
        self,
        query: str,
        papers: List[PaperBase],
        output_language: str = "English"
    ) -> AsyncIterator[str]:
        context = self._build_context(papers)
        system_prompt = self._build_system_prompt(output_language=output_language)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}\n\nProvide a comprehensive synthesis:")
        ]

        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content

    async def synthesize(
        self,
        query: str,
        papers: List[PaperBase],
        output_language: str = "English"
    ) -> Dict[str, Any]:
        context = self._build_context(papers)
        system_prompt = self._build_system_prompt(output_language=output_language)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}\n\nProvide a comprehensive synthesis:")
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
