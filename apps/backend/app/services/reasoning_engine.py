"""
Reasoning Engine
===============
LL-powered synthesis, claim extraction, and analysis across the evidence graph.

Responsibilities:
- Extract claims from research sources
- Synthesize findings across multiple sources
- Generate follow-up research suggestions
- Score claim confidence based on evidence strength
- Produce research reports from the claim graph
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    ResearchQuestion, ResearchTask, Source, Passage, Evidence, Claim,
)

logger = get_logger("reasoning_engine")


class ReasoningEngine:
    """
    LLM-powered reasoning across the evidence graph.
    """

    async def extract_claims_from_sources(
        self,
        question_id: str,
        task_id: str,
        db: AsyncSession,
    ) -> list[dict]:
        """
        Use LLM to extract claims from all sources linked to a research task.
        Creates Claim records in the database.
        """
        # Get sources for this task
        stmt = select(Source).where(Source.task_id == task_id)
        result = await db.execute(stmt)
        sources = result.scalars().all()

        if not sources:
            logger.warning(f"no_sources_for_extraction task_id={task_id}")
            return []

        # Build context from abstracts
        context_parts = []
        for source in sources:
            abstract = source.abstract or ""
            if abstract:
                context_parts.append(
                    f"[{source.title} ({source.year})]\n{abstract[:500]}"
                )

        if not context_parts:
            logger.warning(f"no_abstracts_for_extraction task_id={task_id}")
            return []

        context = "\n\n".join(context_parts[:10])  # cap at 10 sources

        # Get the research question
        question = await db.get(ResearchQuestion, question_id)
        if not question:
            return []

        # Call LLM for claim extraction
        claims = await self._llm_extract_claims(question.question, context)

        # Persist claims
        persisted = []
        for claim_data in claims:
            claim = Claim(
                question_id=question_id,
                text=claim_data.get("text", ""),
                claim_type=claim_data.get("claim_type", "finding"),
                confidence=claim_data.get("confidence", 50),
            )
            db.add(claim)
            persisted.append(claim)

        await db.commit()

        logger.info(
            f"claims_extracted question_id={question_id} "
            f"sources={len(sources)} claims={len(persisted)}"
        )

        return [
            {"id": c.id, "text": c.text, "claim_type": c.claim_type, "confidence": c.confidence}
            for c in persisted
        ]

    async def _llm_extract_claims(self, question: str, context: str) -> list[dict]:
        """
        Call LLM to extract verifiable claims from the context.
        Returns list of {text, claim_type, confidence}.
        """
        try:
            from app.core.model_router import model_router, TaskType

            prompt = f"""You are a research analyst. Given the following research question and source abstracts,
extract specific, verifiable claims. For each claim, provide:
- text: The claim statement (be precise and specific)
- claim_type: One of "finding", "hypothesis", "conclusion", "contradiction"
- confidence: A score from 0-100 based on how well the sources support this claim

Research Question: {question}

Source Abstracts:
{context}

Return a JSON array of claims. Each claim should be independently verifiable.
Example: [{{"text": "X causes Y in Z context", "claim_type": "finding", "confidence": 85}}]

Return ONLY the JSON array, no other text."""

            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.CLAIM_EXTRACTION,
                temperature=0.2, max_tokens=2000,
            )

            import json
            content = result["content"].strip()
            # Extract JSON from response (handle markdown code blocks)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            claims = json.loads(content)
            if isinstance(claims, list):
                return claims[:20]  # cap at 20 claims
            return []

        except Exception as e:
            logger.error(f"llm_claim_extraction_failed: {e}")
            return []

    async def synthesize_findings(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> str:
        """
        Generate a comprehensive synthesis from all verified claims
        and their supporting evidence.
        """
        # Get question
        question = await db.get(ResearchQuestion, question_id)
        if not question:
            raise ValueError(f"Research question {question_id} not found")

        # Get all claims with evidence
        stmt = (
            select(Claim)
            .where(Claim.question_id == question_id)
            .order_by(Claim.confidence.desc())
        )
        result = await db.execute(stmt)
        claims = result.scalars().all()

        # Build context for synthesis
        claim_texts = []
        for claim in claims[:15]:  # cap at 15 claims
            # Get supporting evidence
            ev_stmt = select(Evidence).where(Evidence.claim_id == claim.id)
            ev_result = await db.execute(ev_stmt)
            evidence_items = ev_result.scalars().all()

            supporting = [e for e in evidence_items if e.relation == "supports"]
            contradicting = [e for e in evidence_items if e.relation == "contradicts"]

            claim_texts.append(
                f"CLAIM [{claim.claim_type}] (confidence: {claim.confidence}%, "
                f"status: {claim.verification_status}):\n"
                f"{claim.text}\n"
                f"  Supporting evidence: {len(supporting)} items\n"
                f"  Contradicting evidence: {len(contradicting)} items"
            )

        claims_context = "\n\n".join(claim_texts)

        # Call LLM for synthesis
        synthesis = await self._llm_synthesize(question.question, claims_context)

        return synthesis

    async def _llm_synthesize(self, question: str, claims_context: str) -> str:
        """Call LLM to synthesize findings from claims."""
        try:
            from app.core.model_router import model_router, TaskType

            prompt = f"""You are a research analyst synthesizing findings.
Given the following research question and extracted claims with their evidence,
produce a comprehensive synthesis report.

Research Question: {question}

Extracted Claims:
{claims_context}

Structure your synthesis as:
1. **Key Findings** - The most well-supported claims
2. **Areas of Agreement** - Claims supported by multiple sources
3. **Areas of Dispute** - Contradicting claims and their evidence
4. **Confidence Assessment** - Overall assessment of the evidence quality
5. **Research Gaps** - What remains uncertain or underexplored
6. **Recommendations** - Suggested next steps for the researcher

Be specific, cite the claims by their text, and note confidence levels."""

            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.CLAIM_EXTRACTION,
                temperature=0.2, max_tokens=2000,
            )

            return result["content"].strip()

        except Exception as e:
            logger.error(f"llm_synthesis_failed: {e}")
            return f"Synthesis failed: {str(e)}"

    async def suggest_next_steps(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> list[str]:
        """
        Suggest follow-up research questions based on gaps in the evidence.
        """
        question = await db.get(ResearchQuestion, question_id)
        if not question:
            return []

        stmt = select(Claim).where(Claim.question_id == question_id)
        result = await db.execute(stmt)
        claims = result.scalars().all()

        # Count verification status
        verified = sum(1 for c in claims if c.verification_status == "verified")
        disputed = sum(1 for c in claims if c.verification_status == "disputed")
        unverified = sum(1 for c in claims if c.verification_status == "unverified")

        # Get source count
        task_stmt = select(ResearchTask).where(ResearchTask.question_id == question_id)
        task_result = await db.execute(task_stmt)
        tasks = task_result.scalars().all()

        suggestions = []

        if disputed > 0:
            suggestions.append(
                f"Investigate the {disputed} disputed claims further — "
                "search for additional sources that could resolve the contradictions."
            )

        if unverified > verified:
            suggestions.append(
                f"There are {unverified} unverified claims. "
                "Run a targeted literature search to find supporting or refuting evidence."
            )

        if len(tasks) < 3:
            suggestions.append(
                "Add more search tasks across different APIs "
                "(e.g., CORE for open access repositories, Semantic Scholar for cross-disciplinary)."
            )

        if verified == 0 and len(claims) > 0:
            suggestions.append(
                "No claims are verified yet. Consider increasing the number of "
                "sources or running a contradiction search task."
            )

        # Always suggest a contradiction search
        suggestions.append(
            "Run a contradiction search to find counter-evidence and strengthen your analysis."
        )

        return suggestions[:5]


# Singleton
reasoning_engine = ReasoningEngine()
