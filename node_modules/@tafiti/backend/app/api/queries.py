from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List
from datetime import datetime
import traceback
import json

from app.db.session import get_db
from app.models.database import SavedQuery, User
from app.models.schemas import (
    SavedQueryCreate, SavedQueryResponse, SavedQueryUpdate,
    VectorSearchRequest, VectorSearchResult, PaperBase
)
from app.core.security import get_current_user
from app.services.vector_service import vector_store
from app.core.logger import get_logger

logger = get_logger("queries_api")

router = APIRouter()


@router.post("/", response_model=SavedQueryResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_query(
    query_data: SavedQueryCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    logger.info(f"Creating saved query for user {current_user['user_id']}: {query_data.title}")
    
    # Check if user exists in our local DB
    user_result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = user_result.scalar_one_or_none()
    if not user:
        logger.warning(f"User {current_user['user_id']} not found in local DB. Attempting auto-creation.")
        user = User(
            id=current_user["user_id"],
            username=current_user.get("username") or current_user.get("email", "Researcher"),
            email=current_user.get("email")
        )
        db.add(user)
        await db.flush() # Flush to ensure user is available for FK
        logger.info(f"Auto-created user record for {current_user['user_id']}")

    saved_query = SavedQuery(
        user_id=current_user["user_id"],
        title=query_data.title,
        query=query_data.query,
        papers=[p.dict() for p in query_data.papers],
        answer=query_data.answer,
        tags=query_data.tags
    )
    
    try:
        db.add(saved_query)
        await db.flush()
        logger.info(f"Saved query record created with ID: {saved_query.id}")
        
        vector_id = f"query_{saved_query.id}_{current_user['user_id']}"
        logger.info(f"Adding query to vector store with ID: {vector_id}")
        
        vector_store.add_query(
            query_id=vector_id,
            query_text=query_data.query,
            answer=query_data.answer,
            metadata={
                "query_id": saved_query.id,
                "user_id": current_user["user_id"],
                "title": query_data.title,
                "tags": ",".join(query_data.tags)
            }
        )
        
        saved_query.vector_id = vector_id
        await db.commit()
        await db.refresh(saved_query)
        logger.info(f"Successfully created and indexed saved query {saved_query.id}")
        
        return saved_query
    except Exception as e:
        logger.error(f"Failed to create saved query: {str(e)}\n{traceback.format_exc()}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[SavedQueryResponse])
async def get_saved_queries(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedQuery)
        .where(SavedQuery.user_id == current_user["user_id"])
        .order_by(desc(SavedQuery.created_at))
        .offset(skip)
        .limit(limit)
    )
    queries = result.scalars().all()
    
    # Defensive fix for JSON serialization issues
    for q in queries:
        if isinstance(q.papers, str):
            try: q.papers = json.loads(q.papers)
            except: q.papers = []
        if isinstance(q.tags, str):
            try: q.tags = json.loads(q.tags)
            except: q.tags = []
                
    return queries


@router.get("/{query_id}", response_model=SavedQueryResponse)
async def get_saved_query(
    query_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedQuery).where(
            SavedQuery.id == query_id,
            SavedQuery.user_id == current_user["user_id"]
        )
    )
    query = result.scalar_one_or_none()
    
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    # Defensive fix for JSON serialization
    if isinstance(query.papers, str):
        try:
            query.papers = json.loads(query.papers)
        except:
            query.papers = []
    if isinstance(query.tags, str):
        try:
            query.tags = json.loads(query.tags)
        except:
            query.tags = []
            
    return query


@router.put("/{query_id}", response_model=SavedQueryResponse)
async def update_saved_query(
    query_id: int,
    query_update: SavedQueryUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedQuery).where(
            SavedQuery.id == query_id,
            SavedQuery.user_id == current_user["user_id"]
        )
    )
    query = result.scalar_one_or_none()
    
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    update_data = query_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(query, field, value)
    
    await db.commit()
    await db.refresh(query)
    return query


@router.delete("/{query_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_query(
    query_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedQuery).where(
            SavedQuery.id == query_id,
            SavedQuery.user_id == current_user["user_id"]
        )
    )
    query = result.scalar_one_or_none()
    
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    if query.vector_id:
        vector_store.delete_query(query.vector_id)
    
    await db.delete(query)
    await db.commit()


@router.post("/{query_id}/favorite", response_model=SavedQueryResponse)
async def toggle_favorite(
    query_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedQuery).where(
            SavedQuery.id == query_id,
            SavedQuery.user_id == current_user["user_id"]
        )
    )
    query = result.scalar_one_or_none()
    
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    query.is_favorite = not query.is_favorite
    await db.commit()
    await db.refresh(query)
    return query


@router.post("/search", response_model=List[VectorSearchResult])
async def vector_search(
    search_request: VectorSearchRequest,
    current_user: dict = Depends(get_current_user)
):
    results = vector_store.search_similar(
        query=search_request.query,
        k=search_request.k,
        user_id=current_user["user_id"]
    )
    
    formatted_results = []
    for result in results:
        if result['distance'] < (1 - search_request.threshold):
            formatted_results.append(VectorSearchResult(
                query_id=result['metadata']['query_id'],
                title=result['metadata']['title'],
                similarity=1 - result['distance'],
                created_at=result['metadata'].get('created_at', datetime.now())
            ))
    
    return formatted_results


@router.get("/favorites/list", response_model=List[SavedQueryResponse])
async def get_favorites(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedQuery)
        .where(
            SavedQuery.user_id == current_user["user_id"],
            SavedQuery.is_favorite == True
        )
        .order_by(desc(SavedQuery.updated_at))
    )
    queries = result.scalars().all()
    return queries


@router.post("/library/papers", response_model=PaperBase)
async def save_paper(
    paper: PaperBase,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.database import SavedPaper
    
    # Check if already saved
    result = await db.execute(
        select(SavedPaper).where(
            SavedPaper.user_id == current_user["user_id"],
            SavedPaper.paper_id == paper.id
        )
    )
    if result.scalar_one_or_none():
        return paper

    saved_paper = SavedPaper(
        user_id=current_user["user_id"],
        paper_id=paper.id,
        title=paper.title,
        authors=paper.authors,
        year=paper.year,
        citations=paper.citations,
        abstract=paper.abstract
    )
    db.add(saved_paper)
    await db.commit()
    return paper


@router.get("/library/papers", response_model=List[PaperBase])
async def get_library_papers(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.database import SavedPaper
    result = await db.execute(
        select(SavedPaper)
        .where(SavedPaper.user_id == current_user["user_id"])
        .order_by(desc(SavedPaper.created_at))
    )
    rows = result.scalars().all()
    
    # Defensive fix for JSON serialization 
    for r in rows:
        if isinstance(r.authors, str):
            try: r.authors = json.loads(r.authors)
            except: r.authors = []
            
    return [
        PaperBase(
            id=r.paper_id,
            title=r.title,
            year=r.year,
            citations=r.citations,
            abstract=r.abstract,
            authors=r.authors
        ) for r in rows
    ]
