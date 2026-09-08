from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import asyncio
import json

from app.db.session import get_db
from app.models.schemas import (
    SynthesisRequest, SynthesisResponse,
    PaperSearchRequest, PaperSearchResponse, PaperBase, SpringerSearchRequest,
    SearchHistoryResponse, PaperImpactResponse,
    GapAnalysisRequest, GapAnalysisResponse,
    CitationGraphResponse
)
from app.models.schemas_chat import ChatResearchRequest
from app.services.openalex_service import get_openalex_service
from app.services.semantic_scholar_service import get_semantic_scholar_service
from app.services.openalex_service import get_arxiv_service
from app.services.core_service import get_core_service
from app.services.elsevier_service import get_elsevier_service
from app.services.doaj_service import get_doaj_service
from app.services.ajol_service import get_ajol_service
from app.services.africarxiv_service import get_africarxiv_service
from app.services.springer_service import get_springer_service
from app.services.parallel_service import get_parallel_service
from app.models.schemas import (
    ParallelSearchRequest, ParallelSearchResponse, ParallelWebResult,
    ParallelTaskCreateRequest, ParallelTaskResultResponse, ParallelTaskBasis,
    ParallelExtractRequest, ParallelExtractResponse,
)
from app.agents.research_agent import get_research_agent
from app.models.schemas import DeepResearchRequest, DeepResearchResponse, DeepResearchStatusResponse
from app.agents.deep_research_agent import get_deep_research_agent
from app.models.schemas import DeepResearchValidationResponse
from app.agents.validation_agent import get_validation_agent

from app.agents.critic_agent import validated_synthesis, ValidatedSynthesis
from app.services.vector_service import vector_store
from app.core.security import get_current_user
from app.core.subscription import require_trial_or_active
from app.models.database import ResearchSession, SearchHistory
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

    # Instantiate all source services
    openalex    = get_openalex_service(client=http)
    s2          = get_semantic_scholar_service(client=http)
    arxiv       = get_arxiv_service(client=http)
    core        = get_core_service(client=http)
    elsevier    = get_elsevier_service(client=http)
    doaj        = get_doaj_service(client=http)
    ajol        = get_ajol_service(client=http)
    africarxiv  = get_africarxiv_service(client=http)
    springer    = get_springer_service(client=http)
    parallel    = get_parallel_service()

    # Fan-out: all sources run fully in parallel
    gather_tasks = [
        openalex.search_papers(
            query=search_request.query,
            limit=search_request.limit,
            filters=search_request.filters,
        ),
        s2.search_papers(query=search_request.query, limit=per_source),
        arxiv.search_papers(query=search_request.query, limit=per_source),
        core.search_papers(query=search_request.query, limit=per_source),
        elsevier.search_papers(query=search_request.query, limit=per_source),
        doaj.search_papers(query=search_request.query, limit=per_source),
        ajol.search_papers(query=search_request.query, limit=per_source),
        africarxiv.search_papers(query=search_request.query, limit=per_source),
        springer.search_papers(query=search_request.query, limit=per_source),
    ]
    if parallel.is_configured:
        gather_tasks.append(parallel.search_papers(query=search_request.query, limit=per_source))

    gather_results = await asyncio.gather(*gather_tasks, return_exceptions=True)

    oa_results = gather_results[0]
    batch_map = [
        ("s2", gather_results[1]),
        ("arxiv", gather_results[2]),
        ("core", gather_results[3]),
        ("elsevier", gather_results[4]),
        ("doaj", gather_results[5]),
        ("ajol", gather_results[6]),
        ("africarxiv", gather_results[7]),
        ("springer", gather_results[8]),
    ]
    if parallel.is_configured and len(gather_results) > 9:
        batch_map.append(("parallel", gather_results[9]))

    # Merge: OpenAlex first (highest quality metadata), then deduplicate by ID
    papers: list = oa_results if isinstance(oa_results, list) else []
    seen_ids = {p.id for p in papers}
    source_counts: dict = {
        "openalex": len(oa_results) if isinstance(oa_results, list) else 0,
    }
    for label, batch in batch_map:
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

@router.post("/parallel/search", response_model=ParallelSearchResponse)
async def search_parallel_web(
    search_req: ParallelSearchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Direct search endpoint for Parallel Web Systems.
    Executes AI-optimized web searches using the parallel-web SDK.
    """
    service = get_parallel_service()
    res = await service.search(
        search_queries=search_req.search_queries,
        objective=search_req.objective,
        mode=search_req.mode or "advanced",
        advanced_settings=search_req.advanced_settings,
        max_results=search_req.max_results or 10,
    )
    return ParallelSearchResponse(
        search_id=res.get("search_id"),
        session_id=res.get("session_id"),
        results=[ParallelWebResult(**r) for r in res.get("results", [])],
        total=len(res.get("results", [])),
        warnings=res.get("warnings", []),
    )

@router.post("/parallel/task")
async def create_parallel_deep_research(
    task_req: ParallelTaskCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Launch a multi-hop deep research run using the Parallel Task API.
    """
    service = get_parallel_service()
    if not service.is_configured:
        raise HTTPException(status_code=400, detail="PARALLEL_API_KEY is not configured on the server")

    try:
        task_data = await service.create_deep_research(
            input_prompt=task_req.input_prompt,
            processor=task_req.processor or "pro",
        )
        return task_data
    except Exception as e:
        logger.error(f"Parallel Task creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/parallel/task/{run_id}", response_model=ParallelTaskResultResponse)
async def get_parallel_task_result(
    run_id: str,
    api_timeout: int = Query(default=60, ge=5, le=3600),
    current_user: dict = Depends(get_current_user),
):
    """
    Retrieve results of a deep research task run, including synthesis and citations.
    """
    service = get_parallel_service()
    if not service.is_configured:
        raise HTTPException(status_code=400, detail="PARALLEL_API_KEY is not configured on the server")

    try:
        data = await service.get_deep_research_result(run_id=run_id, api_timeout=api_timeout)
        return ParallelTaskResultResponse(
            run_id=data["run_id"],
            content=data.get("content"),
            basis=[
                ParallelTaskBasis(
                    field=b.get("field", ""),
                    citations=b.get("citations", []),
                )
                for b in data.get("basis", [])
            ],
            status=data.get("status", "completed"),
        )
    except Exception as e:
        logger.error(f"Failed to fetch Parallel Task result: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parallel/extract", response_model=ParallelExtractResponse)
async def extract_web_content(
    extract_req: ParallelExtractRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Extract clean markdown from web URLs using the Parallel Extract API.
    """
    service = get_parallel_service()
    if not service.is_configured:
        raise HTTPException(status_code=400, detail="PARALLEL_API_KEY is not configured on the server")

    try:
        data = await service.extract(urls=extract_req.urls)
        return ParallelExtractResponse(results=data.get("results", []))
    except Exception as e:
        logger.error(f"Parallel Extract failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/springer/search", response_model=PaperSearchResponse)
async def search_springer_papers(
    search_req: SpringerSearchRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Search Springer Nature Meta API and Open Access API.
    - `api_source`: 'meta' (versioned metadata), 'openaccess' (open access papers), or 'all' (both deduplicated).
    - `open_access_only`: if True, restricts results exclusively to open access content with full text links.
    """
    http = getattr(request.app.state, "http_client", None)
    service = get_springer_service(client=http)
    if not service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Springer Nature API keys (SPRINGER_META_API_KEY, SPRINGER_OPEN_ACCESS_API_KEY) are not configured on the server."
        )

    if search_req.api_source == "meta":
        papers = await service.search_meta(query=search_req.query, limit=search_req.limit, filters=search_req.filters)
    elif search_req.api_source == "openaccess" or search_req.open_access_only:
        papers = await service.search_openaccess(query=search_req.query, limit=search_req.limit, filters=search_req.filters)
    else:
        papers = await service.search_papers(
            query=search_req.query,
            limit=search_req.limit,
            open_access_only=search_req.open_access_only,
            filters=search_req.filters,
        )

    return PaperSearchResponse(
        papers=papers,
        total=len(papers),
        from_cache=False,
    )

@router.get("/springer/doi/{doi:path}", response_model=PaperBase)
async def get_springer_paper_by_doi(
    doi: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Retrieve paper details from Springer Nature by DOI.
    """
    http = getattr(request.app.state, "http_client", None)
    service = get_springer_service(client=http)
    if not service.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Springer Nature API keys are not configured on the server."
        )

    paper = await service.get_paper_by_doi(doi)
    if not paper:
        raise HTTPException(status_code=404, detail=f"Paper with DOI '{doi}' not found in Springer Nature.")
    return paper

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
    limit: int = Query(default=5, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    openalex = get_openalex_service(client=request.app.state.http_client)
    papers = await openalex.get_related_papers(paper_id, limit=limit)
    return papers

@router.get("/papers/{paper_id}/citation-graph", response_model=CitationGraphResponse)
async def get_citation_graph(
    paper_id: str,
    request: Request,
    refs_limit: int = Query(default=8, ge=1, le=50),
    citing_limit: int = Query(default=8, ge=1, le=50),
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
        raise HTTPException(status_code=502, detail="Research service temporarily unavailable")

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
    limit: int = Query(default=20, ge=1, le=100),
):
    from sqlalchemy import select
    result = await db.execute(
        select(SearchHistory)
        .where(SearchHistory.user_id == current_user["user_id"])
        .order_by(SearchHistory.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()

from sqlalchemy.future import select
from app.models.database import DeepResearchSession
import hashlib
from app.core.cache import cache

@router.post("/deep-research", response_model=DeepResearchResponse)
async def start_deep_research(
    request: Request,
    dr_request: DeepResearchRequest,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a deep research task using Gemini interactions API.
    Returns an interaction ID that can be polled for status.
    """
    try:
        query_hash = hashlib.md5(dr_request.query.encode()).hexdigest()
        cache_key = f"deep_research:{query_hash}"
        cached_output = await cache.get(cache_key)

        if cached_output:
            # Create a DB session marked as completed directly
            new_session = DeepResearchSession(
                user_id=current_user["user_id"],
                query=dr_request.query,
                interaction_id="cached_" + query_hash,
                status="completed",
                output=cached_output
            )
            db.add(new_session)
            await db.commit()
            return DeepResearchResponse(
                interaction_id=new_session.interaction_id,
                message="Deep research task started successfully. Poll the status using /research/deep-research/{interaction_id}"
            )

        agent = get_deep_research_agent()
        interaction_id = await agent.start_research(
            query=dr_request.query,
            mcp_servers=dr_request.mcp_servers,
            engine=dr_request.engine,
            thinking_summaries=dr_request.thinking_summaries,
            visualization=dr_request.visualization,
            collaborative_planning=dr_request.collaborative_planning,
        )

        # Save to DB
        new_session = DeepResearchSession(
            user_id=current_user["user_id"],
            query=dr_request.query,
            interaction_id=interaction_id,
            status="pending"
        )
        db.add(new_session)
        await db.commit()

        return DeepResearchResponse(
            interaction_id=interaction_id,
            message="Deep research task started successfully. Poll the status using /research/deep-research/{interaction_id}"
        )
    except Exception as e:
        logger.error(f"Error starting deep research: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again later.")

@router.get("/deep-research/{interaction_id}", response_model=DeepResearchStatusResponse)
async def get_deep_research_status(
    interaction_id: str,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db),
):
    """
    Poll the status of a deep research task.
    """
    try:
        if interaction_id.startswith("cached_"):
            # Fetch directly from DB
            stmt = select(DeepResearchSession).where(DeepResearchSession.interaction_id == interaction_id)
            result = await db.execute(stmt)
            db_session = result.scalars().first()
            if not db_session:
                 raise HTTPException(status_code=404, detail="Interaction not found")
            return DeepResearchStatusResponse(
                interaction_id=interaction_id,
                status=db_session.status,
                output=db_session.output,
                error=db_session.error
            )

        agent = get_deep_research_agent()
        status_info = await agent.get_research_status(interaction_id)

        # Update DB if found
        stmt = select(DeepResearchSession).where(DeepResearchSession.interaction_id == interaction_id)
        result = await db.execute(stmt)
        db_session = result.scalars().first()

        if db_session:
            if status_info["status"] != db_session.status:
                db_session.status = status_info["status"]
                if status_info.get("output"):
                    db_session.output = status_info["output"]
                    # Cache to Redis
                    query_hash = hashlib.md5(db_session.query.encode()).hexdigest()
                    cache_key = f"deep_research:{query_hash}"
                    await cache.set(cache_key, db_session.output, ttl=86400)
                if status_info.get("error"):
                    db_session.error = status_info["error"]
                await db.commit()

        return DeepResearchStatusResponse(
            interaction_id=interaction_id,
            status=status_info["status"],
            output=status_info.get("output"),
            error=status_info.get("error"),
            progress=status_info.get("progress"),
        )
    except Exception as e:
        logger.error(f"Error polling deep research status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again later.")

@router.post("/deep-research/{interaction_id}/validate", response_model=DeepResearchValidationResponse)
async def validate_deep_research(
    interaction_id: str,
    current_user: dict = Depends(get_current_user),
    _trial: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate the output of a completed deep research task.
    Extracts claims, checks citations, and returns a confidence score.
    """
    try:
        # First get the research output
        if interaction_id.startswith("cached_"):
            stmt = select(DeepResearchSession).where(DeepResearchSession.interaction_id == interaction_id)
            result = await db.execute(stmt)
            db_session = result.scalars().first()
            if not db_session or db_session.status != "completed":
                raise HTTPException(status_code=400, detail="Cannot validate incomplete cached research task.")
            research_text = db_session.output
        else:
            dr_agent = get_deep_research_agent()
            status_info = await dr_agent.get_research_status(interaction_id)

            if status_info["status"] != "completed":
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot validate incomplete research task. Current status: {status_info['status']}"
                )

            research_text = status_info.get("output", "")
        if not research_text:
             raise HTTPException(status_code=400, detail="Research task completed but output is empty.")

        # Run validation
        validation_agent = get_validation_agent()
        validation_result = await validation_agent.validate_research_output(interaction_id, research_text)

        return validation_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating deep research: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again later.")
