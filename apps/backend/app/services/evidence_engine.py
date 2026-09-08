"""
Evidence Engine
==============
Extracts, annotates, and manages evidence from research sources.

Responsibilities:
- Extract key passages from papers (abstracts, full text if available)
- Create evidence items linking passages to claims
- Compute confidence scores based on source quality and citation count
- Detect contradictions between sources
- Manage the evidence ↔ claim relationship graph
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    Source, Passage, Evidence, Claim,
)

logger = get_logger("evidence_engine")


class EvidenceEngine:
    """
    Manages the extraction and annotation of evidence from research sources.
    """

    async def extract_evidence_for_claim(
        self,
        claim_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Given a claim, search all passages from the same research question
        and create evidence items linking relevant passages to this claim.
        Returns a summary of evidence extracted.
        """
        # Get the claim and its question
        claim = await db.get(Claim, claim_id)
        if not claim:
            raise ValueError(f"Claim {claim_id} not found")

        # Get all sources from tasks under this question
        from app.models.database import ResearchTask, ResearchQuestion
        question = await db.get(ResearchQuestion, claim.question_id)
        if not question:
            raise ValueError(f"Research question {claim.question_id} not found")

        # Find all passages from sources linked to this question's tasks
        stmt = (
            select(Passage)
            .join(Source, Passage.source_id == Source.id)
            .join(ResearchTask, Source.task_id == ResearchTask.id)
            .where(ResearchTask.question_id == claim.question_id)
        )
        result = await db.execute(stmt)
        passages = result.scalars().all()

        # Simple relevance scoring based on keyword overlap
        claim_words = set(claim.text.lower().split())
        evidence_items = []

        for passage in passages:
            passage_words = set(passage.content.lower().split())
            overlap = len(claim_words & passage_words)
            total = len(claim_words | passage_words)
            relevance = overlap / total if total > 0 else 0

            # Only create evidence for passages with meaningful overlap
            if relevance >= 0.15:
                # Determine relation based on simple heuristics
                relation = "supports"
                negation_words = {"not", "no", "never", "contrary", "however", "despite", "although", "whereas"}
                if passage_words & negation_words:
                    relation = "contextualizes"

                # Confidence based on source citation count and relevance
                source = await db.get(Source, passage.source_id)
                citation_bonus = min(20, (source.citation_count or 0) // 100) if source else 0
                confidence = min(100, int(relevance * 60) + citation_bonus + 30)

                evidence = Evidence(
                    passage_id=passage.id,
                    claim_id=claim_id,
                    relation=relation,
                    confidence=confidence,
                    extracted_by="evidence_engine",
                )
                db.add(evidence)
                evidence_items.append(evidence)

        # Update claim confidence based on evidence
        await self._recompute_claim_confidence(claim_id, db)

        await db.commit()

        logger.info(
            f"evidence_extracted claim_id={claim_id} "
            f"passages_scanned={len(passages)} evidence_created={len(evidence_items)}"
        )

        return {
            "claim_id": claim_id,
            "passages_scanned": len(passages),
            "evidence_created": len(evidence_items),
            "supporting": sum(1 for e in evidence_items if e.relation == "supports"),
            "contradicting": sum(1 for e in evidence_items if e.relation == "contradicts"),
            "contextualizing": sum(1 for e in evidence_items if e.relation == "contextualizes"),
        }

    async def _recompute_claim_confidence(self, claim_id: str, db: AsyncSession):
        """
        Recompute a claim's confidence and supporting/contradicting counts
        based on all linked evidence items.
        """
        claim = await db.get(Claim, claim_id)
        if not claim:
            return

        stmt = select(Evidence).where(Evidence.claim_id == claim_id)
        result = await db.execute(stmt)
        evidence_items = result.scalars().all()

        supporting = [e for e in evidence_items if e.relation == "supports"]
        contradicting = [e for e in evidence_items if e.relation == "contradicts"]

        claim.supporting_count = len(supporting)
        claim.contradicting_count = len(contradicting)

        # Compute confidence: weighted average of evidence confidence
        if evidence_items:
            avg_confidence = sum(e.confidence for e in evidence_items) // len(evidence_items)
            # Boost if more sources, penalize if contradictions
            contradiction_penalty = len(contradicting) * 5
            claim.confidence = max(0, min(100, avg_confidence - contradiction_penalty))
        else:
            claim.confidence = 50  # default when no evidence

        # Auto-set verification status
        if claim.supporting_count >= 3 and claim.contradicting_count == 0:
            claim.verification_status = "verified"
        elif claim.contradicting_count > claim.supporting_count:
            claim.verification_status = "disputed"
        else:
            claim.verification_status = "unverified"

    async def get_evidence_graph(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Get the full evidence graph for a research question:
        claims ↔ evidence ↔ passages ↔ sources.
        """
        # Get all claims for this question
        stmt = select(Claim).where(Claim.question_id == question_id)
        result = await db.execute(stmt)
        claims = result.scalars().all()

        graph = {"claims": [], "sources": set(), "passages": 0, "evidence": 0}

        for claim in claims:
            # Get evidence for this claim
            ev_stmt = select(Evidence).where(Evidence.claim_id == claim.id)
            ev_result = await db.execute(ev_stmt)
            evidence_items = ev_result.scalars().all()

            claim_data = {
                "id": claim.id,
                "text": claim.text,
                "claim_type": claim.claim_type,
                "confidence": claim.confidence,
                "verification_status": claim.verification_status,
                "supporting_count": claim.supporting_count,
                "contradicting_count": claim.contradicting_count,
                "evidence": [],
            }

            for ev in evidence_items:
                passage = await db.get(Passage, ev.passage_id)
                source = await db.get(Source, passage.source_id) if passage else None

                if source:
                    graph["sources"].add(source.id)

                claim_data["evidence"].append({
                    "id": ev.id,
                    "relation": ev.relation,
                    "confidence": ev.confidence,
                    "passage_content": passage.content[:200] if passage else None,
                    "source_title": source.title if source else None,
                    "source_doi": source.doi if source else None,
                })

                graph["evidence"] += 1

            graph["passages"] += sum(1 for _ in claims)  # approximate
            graph["claims"].append(claim_data)

        graph["sources"] = len(graph["sources"])
        return graph

    async def detect_contradictions(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> list[dict]:
        """
        Detect contradictory claims within a research question.
        Returns pairs of claims that have contradicting evidence.
        """
        stmt = select(Claim).where(
            Claim.question_id == question_id,
            Claim.verification_status == "unverified",
        )
        result = await db.execute(stmt)
        claims = result.scalars().all()

        contradictions = []

        for i, claim_a in enumerate(claims):
            for claim_b in claims[i + 1:]:
                # Check if they share contradicting evidence
                ev_a = await db.execute(
                    select(Evidence).where(
                        Evidence.claim_id == claim_a.id,
                        Evidence.relation == "contradicts",
                    )
                )
                ev_b = await db.execute(
                    select(Evidence).where(
                        Evidence.claim_id == claim_b.id,
                        Evidence.relation == "contradicts",
                    )
                )

                # Simple contradiction detection: check for negation word overlap
                words_a = set(claim_a.text.lower().split())
                words_b = set(claim_b.text.lower().split())
                negation_words = {"not", "no", "never", "does", "is", "are", "was", "were"}

                if words_a & negation_words and words_b & negation_words:
                    shared_subject = (words_a - negation_words) & (words_b - negation_words)
                    if len(shared_subject) >= 2:
                        contradictions.append({
                            "claim_a": {"id": claim_a.id, "text": claim_a.text},
                            "claim_b": {"id": claim_b.id, "text": claim_b.text},
                            "shared_concepts": list(shared_subject)[:5],
                        })

        return contradictions


# Singleton
evidence_engine = EvidenceEngine()
