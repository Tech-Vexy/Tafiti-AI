from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import asyncio
import json

from app.db.session import get_db
from app.models.schemas import (
    SynthesisRequest, SynthesisResponse,
    PaperSearchRequest, PaperSearchResponse, PaperBase,
    SearchHistoryResponse, PaperImpactResponse,
    GapAnalysisRequest, GapAnalysisResponse,
    CitationGraphResponse
)
from app.models.schemas_chat import ChatMessage, ChatResearchRequest
from app.services.openalex_service import (
    get_openalex_service,
    get_semantic_scholar_service,
    get_arxiv_service,
    get_core_service,
    get_elsevier_service,
    get_pubmed_service,
    get_doaj_service,
    get_ajol_service,
    get_africarxiv_service,
)
from app.agents.research_agent import get_research_agent
from app.agents.critic_agent import validated_synthesis, ValidatedSynthesis
from app.services.vector_service import vector_store
from app.core.security import get_current_user
from app.core.subscription import require_trial_or_active
from app.models.database import ResearchSession, SearchHistory
from datetime import datetime
import time
from app.core.logger import get_logger

logger = get_logger("research_api")
router = APIRouter()


@router.post("/search", response_model=PaperSearchResponse)
async def search_papers(
    request: Request,
    search_request: PaperSearchRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    start_time = time.time()
    http = request.app.state.http_client
    per_source = max(5, search_request.limit // 2)

    # Instantiate all nine source services
    openalex    = get_openalex_service(client=http)
    s2          = get_semantic_scholar_service(client=http)
    arxiv       = get_arxiv_service(client=http)
    core        = get_core_service(client=http)
    elsevier    = get_elsevier_service(client=http)
    pubmed      = get_pubmed_service(client=http)
    doaj        = get_doaj_service(client=http)
    ajol        = get_ajol_service(client=http)
    africarxiv  = get_africarxiv_service(client=http)

    # Fan-out: all nine sources run fully in parallel
    (
        oa_results, s2_results, arxiv_results,
        core_results, elsevier_results, pubmed_results,
        doaj_results, ajol_results, africarxiv_results,
    ) = await asyncio.gather(
        openalex.search_papers(
            query=search_request.query,
            limit=search_request.limit,
            filters=search_request.filters,
        ),
        s2.search_papers(query=search_request.query, limit=per_source),
        arxiv.search_papers(query=search_request.query, limit=per_source),
        core.search_papers(query=search_request.query, limit=per_source),
        elsevier.search_papers(query=search_request.query, limit=per_source),
        pubmed.search_papers(query=search_request.query, limit=per_source),
        doaj.search_papers(query=search_request.query, limit=per_source),
        ajol.search_papers(query=search_request.query, limit=per_source),
        africarxiv.search_papers(query=search_request.query, limit=per_source),
        return_exceptions=True,
    )

    # Merge: OpenAlex first (highest quality metadata), then deduplicate by ID
    papers: list = oa_results if isinstance(oa_results, list) else []
    seen_ids = {p.id for p in papers}
    source_counts: dict = {
        "openalex": len(oa_results) if isinstance(oa_results, list) else 0,
    }
    for label, batch in (
        ("s2", s2_results),
        ("arxiv", arxiv_results),
        ("core", core_results),
        ("elsevier", elsevier_results),
        ("pubmed", pubmed_results),
        ("doaj", doaj_results),
        ("ajol", ajol_results),
        ("africarxiv", africarxiv_results),
    ):
        count = 0
        if isinstance(batch, list):
            for p in batch:
                if p.id not in seen_ids:
                    papers.append(p)
                    seen_ids.add(p.id)
                    count += 1
        elif isinstance(batch, Exception):
            logger.warning(f"{label} source error: {batch}")
        source_counts[label] = count

    elapsed = time.time() - start_time
    logger.info(
        f"Paper search for '{search_request.query}' completed in {elapsed:.4f}s | "
        + " + ".join(f"{v} {k}" for k, v in source_counts.items())
        + f" = {len(papers)} total"
    )

    # Record search history
    try:
        history = SearchHistory(
            user_id=current_user["user_id"],
            query=search_request.query,
            results_count=len(papers)
        )
        db.add(history)
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to record search history: {e}")
        await db.rollback()

    return PaperSearchResponse(
        papers=papers,
        total=len(papers),
        from_cache=False
    )


@router.post("/synthesize", response_model=SynthesisResponse)
async def synthesize(
    request: Request,
    synth_request: SynthesisRequest,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db),
):
    if not synth_request.papers:
        raise HTTPException(status_code=400, detail="No papers provided")
    
    start_time = time.time()
    logger.info(f"Starting synthesis for query: {synth_request.query}")
    
    agent = get_research_agent(
        provider=synth_request.provider,
        model=synth_request.model
    )

    # RAG: index the current papers, then retrieve the most relevant chunks
    # to enrich the synthesis context beyond what the user explicitly selected.
    rag_context = ""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, vector_store.index_papers, synth_request.papers)
        rag_context = await loop.run_in_executor(
            None, vector_store.retrieve_rag_context, synth_request.query
        )
    except Exception as rag_err:
        logger.warning(f"RAG enrichment skipped: {rag_err}")

    result = await agent.synthesize(
        query=synth_request.query,
        papers=synth_request.papers,
        output_language=synth_request.output_language or "English",
        rag_context=rag_context,
    )
    
    processing_time = time.time() - start_time
    logger.info(f"Synthesis for '{synth_request.query}' completed in {processing_time:.4f}s")
    
    session = ResearchSession(
        user_id=current_user["user_id"],
        query=synth_request.query,
        papers_count=len(synth_request.papers),
        synthesis_length=len(result["answer"]),
        duration_seconds=int(processing_time)
    )
    db.add(session)
    await db.commit()
    
    # Generate follow-up questions
    followup = await agent.generate_followup_questions(
        context=agent._build_context(synth_request.papers),
        query=synth_request.query
    )
    
    return SynthesisResponse(
        answer=result["answer"],
        sources_used=result["sources_used"],
        processing_time=processing_time,
        followup_questions=followup
    )


@router.post("/synthesize/validated")
async def synthesize_validated(
    request: Request,
    synth_request: SynthesisRequest,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
):
    """
    Drafter + Critic multi-agent synthesis.
    Uses Gemini for drafting and Groq for citation validation.
    Returns the synthesis with per-citation confidence scores and flagged unsupported claims.
    """
    if not synth_request.papers:
        raise HTTPException(status_code=400, detail="No papers provided")

    start_time = time.time()
    result: ValidatedSynthesis = await validated_synthesis(
        query=synth_request.query,
        papers=synth_request.papers,
        output_language=synth_request.output_language or "English",
    )
    processing_time = time.time() - start_time

    return {
        "answer": result.draft,
        "citations": [c.model_dump() for c in result.citations],
        "flagged_count": result.flagged_count,
        "overall_confidence": result.overall_confidence,
        "critique_summary": result.critique_summary,
        "processing_time": processing_time,
        "sources_used": list(range(1, len(synth_request.papers) + 1)),
    }


@router.post("/synthesize/stream")
async def synthesize_streaming(
    request: Request,
    synth_request: SynthesisRequest,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
):
    if not synth_request.papers:
        raise HTTPException(status_code=400, detail="No papers provided")
    
    agent = get_research_agent(
        provider=synth_request.provider,
        model=synth_request.model
    )

    # RAG enrichment (best-effort, non-blocking)
    rag_context = ""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, vector_store.index_papers, synth_request.papers)
        rag_context = await loop.run_in_executor(
            None, vector_store.retrieve_rag_context, synth_request.query
        )
    except Exception as rag_err:
        logger.warning(f"RAG enrichment skipped (stream): {rag_err}")

    async def generate():
        logger.info(f"Starting streaming synthesis for query: {synth_request.query}")
        try:
            async for chunk in agent.synthesize_streaming(
                query=synth_request.query,
                papers=synth_request.papers,
                output_language=synth_request.output_language or "English",
                rag_context=rag_context,
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except Exception as e:
            logger.error(f"Streaming synthesis failed for '{synth_request.query}': {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            logger.info(f"Streaming synthesis for '{synth_request.query}' finished")
            # Generate and stream follow-up questions at the end
            try:
                followup = await agent.generate_followup_questions(
                    context=agent._build_context(synth_request.papers),
                    query=synth_request.query
                )
                yield f"data: {json.dumps({'followup': followup})}\n\n"
            except Exception as e:
                logger.error(f"Failed to generate follow-up questions: {e}")
            
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


@router.post("/synthesize/collaborative")
async def collaborate_synthesis(
    request: Request,
    synth_request: SynthesisRequest,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db),
):
    """
    Multi-agent collaborative synthesis (Groq + Gemini).
    """
    if not synth_request.papers:
        raise HTTPException(status_code=400, detail="No papers provided")
        
    agent = get_research_agent()
    
    async def generate():
        logger.info(f"Starting collaborative synthesis for query: {synth_request.query}")
        try:
            full_content = ""
            async for chunk in agent.collaborate_research_streaming(
                query=synth_request.query,
                papers=synth_request.papers
            ):
                full_content += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            
            # Record activity if project_id provided
            if synth_request.project_id:
                from app.models.database import ProjectActivity
                activity = ProjectActivity(
                    project_id=synth_request.project_id,
                    user_id=current_user["user_id"],
                    activity_type="collaborative_synthesis",
                    content=f"Collaborative synthesis performed for: {synth_request.query}"
                )
                db.add(activity)
                await db.commit()
                
        except Exception as e:
            logger.error(f"Collaborative synthesis failed: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # Generate and stream follow-up questions at the end
            try:
                followup = await agent.generate_followup_questions(
                    context=agent._build_context(synth_request.papers),
                    query=synth_request.query
                )
                yield f"data: {json.dumps({'followup': followup})}\n\n"
            except Exception as e:
                logger.error(f"Failed to generate follow-up questions: {e}")
            
            yield "data: [DONE]\n\n"
            
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


@router.get("/papers/{paper_id}")
async def get_paper_details(
    paper_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    openalex = get_openalex_service(client=request.app.state.http_client)
    paper = await openalex.get_paper_details(paper_id)
    
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    return paper


@router.get("/papers/{paper_id}/related", response_model=List[PaperBase])
async def get_related_papers(
    paper_id: str,
    request: Request,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    openalex = get_openalex_service(client=request.app.state.http_client)
    papers = await openalex.get_related_papers(paper_id, limit=limit)
    return papers


@router.get("/papers/{paper_id}/citation-graph", response_model=CitationGraphResponse)
async def get_citation_graph(
    paper_id: str,
    request: Request,
    refs_limit: int = 8,
    citing_limit: int = 8,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns a live citation graph for a given paper:
    - seed: the paper itself
    - references: papers it cites (ancestors/past)
    - cited_by: papers that cite it (descendants/future impact)
    """
    openalex = get_openalex_service(client=request.app.state.http_client)
    data = await openalex.get_citation_graph(
        paper_id=paper_id,
        refs_limit=refs_limit,
        citing_limit=citing_limit,
    )
    if not data.get('seed'):
        raise HTTPException(status_code=404, detail="Paper not found")

    return CitationGraphResponse(
        seed=data['seed'],
        references=data['references'],
        cited_by=data['cited_by'],
        total_cited_by_count=data['total_cited_by_count'],
        total_references_count=data['total_references_count'],
    )

@router.post("/papers/{paper_id}/impact", response_model=PaperImpactResponse)
async def explain_paper_impact(
    paper_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    _gate: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db)
):
    from app.models.database import User
    from sqlalchemy import select
    
    # Get user career field
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()
    career_field = user.career_field if user and user.career_field else "Academic Research"
    
    # Get paper details
    openalex = get_openalex_service(client=request.app.state.http_client)
    paper = await openalex.get_paper_details(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
        
    agent = get_research_agent()
    impact_data = await agent.explain_paper_impact(paper, career_field)
    
    return PaperImpactResponse(
        paper_id=paper_id,
        career_field=career_field,
        **impact_data
    )
@router.post("/chat/stream")
async def chat_research_streaming(
    request: Request,
    chat_request: ChatResearchRequest,
    current_user: dict = Depends(get_current_user),
    _gate: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db)
):
    agent = get_research_agent(
        provider=chat_request.provider,
        model=chat_request.model
    )
    
    # Fetch local sources if IDs provided
    local_papers = []
    if chat_request.source_ids:
        from app.models.database import SavedPaper
        from sqlalchemy import select
        
        result = await db.execute(
            select(SavedPaper).where(
                SavedPaper.user_id == current_user["user_id"],
                SavedPaper.paper_id.in_(chat_request.source_ids)
            )
        )
        papers_db = result.scalars().all()
        for p in papers_db:
            local_papers.append(PaperBase(
                id=p.paper_id,
                title=p.title,
                year=p.year,
                citations=p.citations,
                abstract=p.abstract,
                authors=p.authors
            ))

    async def generate():
        logger.info(f"Starting chat research for: {chat_request.query}")
        history_dicts = [{"role": m.role, "content": m.content} for m in chat_request.history]
        
        try:
            async for chunk in agent.chat_research_streaming(
                query=chat_request.query,
                history=history_dicts,
                local_papers=local_papers,
                uploaded_context=chat_request.uploaded_text or ""
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except Exception as e:
            logger.error(f"Chat research failed: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )

@router.post("/gap-analysis", response_model=GapAnalysisResponse)
async def run_gap_analysis(
    gap_request: GapAnalysisRequest,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
):
    """
    Analyzes a research corpus and identifies scholarly gaps:
    geographic, methodological, temporal, demographic, theoretical, and interdisciplinary.
    """
    if not gap_request.papers:
        raise HTTPException(status_code=400, detail="At least one paper is required for gap analysis.")
    if len(gap_request.papers) < 2:
        raise HTTPException(status_code=400, detail="Gap analysis works best with 2 or more papers.")

    start_time = time.time()
    logger.info(
        f"Starting gap analysis for user {current_user['user_id']} "
        f"with {len(gap_request.papers)} papers."
    )

    agent = get_research_agent()

    try:
        data = await agent.analyze_research_gaps(
            papers=gap_request.papers,
            research_context=gap_request.research_context,
        )
    except ValueError as e:
        logger.error(f"Gap analysis LLM error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

    processing_time = time.time() - start_time
    logger.info(f"Gap analysis completed in {processing_time:.4f}s")

    return GapAnalysisResponse(
        gaps=data.get("gaps", []),
        summary=data.get("summary", ""),
        papers_analyzed=len(gap_request.papers),
        processing_time=processing_time,
    )


@router.get("/history", response_model=List[SearchHistoryResponse])
async def get_search_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20
):
    from sqlalchemy import select
    result = await db.execute(
        select(SearchHistory)
        .where(SearchHistory.user_id == current_user["user_id"])
        .order_by(SearchHistory.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
