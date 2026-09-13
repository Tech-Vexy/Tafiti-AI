"""
Vector store service supporting pgvector (Supabase / Neon PostgreSQL) with optional Qdrant fallback.
"""

from typing import List, Dict, Any, Optional
import time
import os
import asyncio
import concurrent.futures

from sqlalchemy import select, delete, func
from app.core.config import settings
from app.core.logger import get_logger
from app.db.session import AsyncSessionLocal
from app.models.database import QueryEmbedding, PaperEmbedding, HAS_PGVECTOR

logger = get_logger("vector_store")


def _run_async(coro):
    """Run an async coroutine from synchronous caller safely."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)


class VectorStore:
    def __init__(self):
        self._embedding_model = None
        self._initialized = False
        self.collection_name = settings.QDRANT_COLLECTION
        self.backend = getattr(settings, "VECTOR_BACKEND", "pgvector")

    def _ensure_initialized(self):
        if self._initialized:
            return
        logger.info(f"Initializing VectorStore (backend: {self.backend})")
        try:
            if settings.HF_TOKEN:
                os.environ["HF_TOKEN"] = settings.HF_TOKEN

            logger.info("Loading embedding model...")
            from sentence_transformers import SentenceTransformer
            self._embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
            self._initialized = True
            logger.info("VectorStore initialization complete.")
        except Exception as e:
            logger.error(f"Failed to initialize VectorStore: {str(e)}")
            raise

    @property
    def embedding_model(self):
        self._ensure_initialized()
        return self._embedding_model

    async def aadd_query(
        self,
        query_id: str,
        query_text: str,
        answer: str,
        metadata: Dict[str, Any]
    ) -> str:
        start_time = time.time()
        combined_text = f"{query_text}\n\n{answer}"

        try:
            embedding = await asyncio.to_thread(self.embedding_model.encode, combined_text)
            embedding = embedding.tolist()

            async with AsyncSessionLocal() as session:
                await session.execute(
                    delete(QueryEmbedding).where(QueryEmbedding.query_id == str(query_id))
                )
                record = QueryEmbedding(
                    query_id=str(query_id),
                    user_id=str(metadata.get("user_id", "")) or None,
                    text=combined_text,
                    query_metadata=metadata,
                    embedding=embedding,
                )
                session.add(record)
                await session.commit()

            elapsed = time.time() - start_time
            logger.info(f"Successfully added query {query_id} to vector store in {elapsed:.4f}s")
            return query_id
        except Exception as e:
            logger.error(f"Failed to add query {query_id} to vector store: {str(e)}")
            raise

    def add_query(
        self,
        query_id: str,
        query_text: str,
        answer: str,
        metadata: Dict[str, Any]
    ) -> str:
        return _run_async(self.aadd_query(query_id, query_text, answer, metadata))

    async def asearch_similar(
        self,
        query: str,
        k: int = 5,
        user_id: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        start_time = time.time()
        logger.info(f"Searching for similar queries to: '{query}'")

        try:
            embedding = await asyncio.to_thread(self.embedding_model.encode, query)
            embedding = embedding.tolist()

            async with AsyncSessionLocal() as session:
                # If pgvector is available, use cosine_distance
                if HAS_PGVECTOR and not os.environ.get("TESTING"):
                    try:
                        stmt = select(
                            QueryEmbedding,
                            QueryEmbedding.embedding.cosine_distance(embedding).label("distance")
                        )
                        if user_id is not None:
                            stmt = stmt.filter(QueryEmbedding.user_id == str(user_id))
                        stmt = stmt.order_by("distance").limit(k)
                        res = await session.execute(stmt)
                        rows = res.all()
                        return [
                            {
                                'id': row[0].query_id,
                                'distance': float(row[1]) if row[1] is not None else 1.0,
                                'metadata': row[0].query_metadata or {},
                                'document': row[0].text or ""
                            }
                            for row in rows
                        ]
                    except Exception as inner_e:
                        logger.warning(f"pgvector native distance failed, falling back: {inner_e}")

                # Fallback in-memory distance calculation
                stmt = select(QueryEmbedding)
                if user_id is not None:
                    stmt = stmt.filter(QueryEmbedding.user_id == str(user_id))
                stmt = stmt.limit(50)
                res = await session.execute(stmt)
                items = res.scalars().all()

                scored = []
                for item in items:
                    if item.embedding:
                        v = item.embedding
                        dot = sum(a * b for a, b in zip(embedding, v))
                        norm1 = sum(a * a for a in embedding) ** 0.5
                        norm2 = sum(b * b for b in v) ** 0.5
                        sim = dot / (norm1 * norm2) if (norm1 * norm2) > 0 else 0.0
                        dist = max(0.0, 1.0 - sim)
                    else:
                        dist = 1.0
                    scored.append((dist, item))

                scored.sort(key=lambda x: x[0])
                similar_queries = [
                    {
                        'id': item.query_id,
                        'distance': dist,
                        'metadata': item.query_metadata or {},
                        'document': item.text or ""
                    }
                    for dist, item in scored[:k]
                ]

            elapsed = time.time() - start_time
            logger.info(f"Vector search found {len(similar_queries)} results in {elapsed:.4f}s")
            return similar_queries
        except Exception as e:
            logger.error(f"Vector search failed: {str(e)}")
            return []

    def search_similar(
        self,
        query: str,
        k: int = 5,
        user_id: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        return _run_async(self.asearch_similar(query, k, user_id))

    async def adelete_query(self, query_id: str) -> bool:
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(
                    delete(QueryEmbedding).where(QueryEmbedding.query_id == str(query_id))
                )
                await session.commit()
            logger.info(f"Deleted query {query_id} from vector store")
            return True
        except Exception as e:
            logger.error(f"Failed to delete query {query_id} from vector store: {str(e)}")
            return False

    def delete_query(self, query_id: str) -> bool:
        return _run_async(self.adelete_query(query_id))

    def update_query(
        self,
        query_id: str,
        query_text: str,
        answer: str,
        metadata: Dict[str, Any]
    ) -> bool:
        try:
            logger.info(f"Updating query {query_id} in vector store")
            self.delete_query(query_id)
            self.add_query(query_id, query_text, answer, metadata)
            return True
        except Exception as e:
            logger.error(f"Failed to update query {query_id} in vector store: {str(e)}")
            return False

    def index_papers(self, papers: List[Any], collection_name: str = None) -> int:
        """
        Embed and upsert a list of PaperBase objects into pgvector.
        Returns the number of successfully indexed papers.
        """
        self._ensure_initialized()
        target = collection_name or self.collection_name
        indexed = 0
        records = []

        for paper in papers:
            try:
                text = f"{paper.title}\n\n{paper.abstract or ''}"
                embedding = self.embedding_model.encode(text).tolist()
                authors = paper.authors if paper.authors else []
                records.append({
                    "paper_id": str(paper.id),
                    "collection_name": target,
                    "title": paper.title,
                    "abstract": paper.abstract or "",
                    "authors": authors,
                    "year": getattr(paper, "year", None),
                    "citations": getattr(paper, "citations", 0),
                    "embedding": embedding,
                })
                indexed += 1
            except Exception as e:
                logger.warning(f"Failed to embed paper {getattr(paper, 'id', '?')}: {e}")

        if records:
            try:
                async def _upsert():
                    async with AsyncSessionLocal() as session:
                        for r in records:
                            await session.execute(
                                delete(PaperEmbedding).where(
                                    PaperEmbedding.paper_id == r["paper_id"],
                                    PaperEmbedding.collection_name == r["collection_name"]
                                )
                            )
                            p = PaperEmbedding(
                                paper_id=r["paper_id"],
                                collection_name=r["collection_name"],
                                title=r["title"],
                                abstract=r["abstract"],
                                authors=r["authors"],
                                year=r["year"],
                                citations=r["citations"],
                                embedding=r["embedding"],
                            )
                            session.add(p)
                        await session.commit()

                _run_async(_upsert())
                logger.info(f"Indexed {len(records)} papers into '{target}'")
            except Exception as e:
                logger.error(f"pgvector paper upsert failed: {e}")
                return 0

        return indexed

    def retrieve_rag_context(
        self,
        query: str,
        k: int = 5,
        collection_name: str = None,
        score_threshold: float = 0.3,
    ) -> str:
        """
        Retrieve top-k most relevant paper chunks for a query using pgvector and return
        them as a formatted context string ready to prepend to synthesis.
        """
        self._ensure_initialized()
        target = collection_name or self.collection_name
        try:
            embedding = self.embedding_model.encode(query).tolist()

            async def _retrieve():
                async with AsyncSessionLocal() as session:
                    if HAS_PGVECTOR and not os.environ.get("TESTING"):
                        try:
                            stmt = (
                                select(
                                    PaperEmbedding,
                                    PaperEmbedding.embedding.cosine_distance(embedding).label("distance")
                                )
                                .filter(PaperEmbedding.collection_name == target)
                                .order_by("distance")
                                .limit(k)
                            )
                            res = await session.execute(stmt)
                            rows = res.all()
                            matches = []
                            for row in rows:
                                dist = float(row[1]) if row[1] is not None else 1.0
                                sim = 1.0 - dist
                                if sim >= score_threshold:
                                    matches.append(row[0])
                            return matches
                        except Exception as pe:
                            logger.warning(f"pgvector query failed: {pe}")

                    # Fallback
                    stmt = select(PaperEmbedding).filter(PaperEmbedding.collection_name == target).limit(50)
                    res = await session.execute(stmt)
                    items = res.scalars().all()
                    scored = []
                    for item in items:
                        if item.embedding:
                            v = item.embedding
                            dot = sum(a * b for a, b in zip(embedding, v))
                            norm1 = sum(a * a for a in embedding) ** 0.5
                            norm2 = sum(b * b for b in v) ** 0.5
                            sim = dot / (norm1 * norm2) if (norm1 * norm2) > 0 else 0.0
                            if sim >= score_threshold:
                                scored.append((sim, item))
                    scored.sort(key=lambda x: x[0], reverse=True)
                    return [item for _, item in scored[:k]]

            results = _run_async(_retrieve())
            if not results:
                return ""

            context_parts = []
            for i, p in enumerate(results, 1):
                authors = ", ".join(p.authors[:3]) if isinstance(p.authors, list) else "Unknown"
                context_parts.append(
                    f"[RAG-{i}] {p.title} ({p.year or '?'}) — {authors}\n"
                    f"{(p.abstract or '')[:800]}"
                )

            logger.info(f"RAG retrieved {len(results)} chunks for query '{query[:60]}'")
            return "\n\n".join(context_parts)
        except Exception as e:
            logger.warning(f"RAG retrieval failed: {e}")
            return ""

    def get_collection_stats(self) -> Dict[str, Any]:
        try:
            async def _stats():
                async with AsyncSessionLocal() as session:
                    q_count = (await session.execute(select(func.count(QueryEmbedding.id)))).scalar() or 0
                    p_count = (await session.execute(select(func.count(PaperEmbedding.id)))).scalar() or 0
                    return q_count + p_count

            total = _run_async(_stats())
            return {
                "total_vectors": total,
                "backend": "pgvector",
                "embedding_dimension": 384,
                "model": settings.EMBEDDING_MODEL
            }
        except Exception as e:
            logger.error(f"Failed to get collection stats: {str(e)}")
            return {}


vector_store = VectorStore()
