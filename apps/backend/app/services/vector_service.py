from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import uuid
import time
import os

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("vector_store")

class VectorStore:
    def __init__(self):
        self._client = None
        self._embedding_model = None
        self.collection_name = settings.QDRANT_COLLECTION
        self._initialized = False

    def _ensure_initialized(self):
        if self._initialized:
            return
        logger.info(f"Initializing VectorStore with collection: {self.collection_name}")
        try:
            if settings.HF_TOKEN:
                os.environ["HF_TOKEN"] = settings.HF_TOKEN
                logger.info("HF_TOKEN set for authenticated requests.")

            self._client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY
            )
            logger.info("Loading embedding model...")
            self._embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
            self._init_collection()
            self._initialized = True
            logger.info("VectorStore initialization complete.")
        except Exception as e:
            logger.error(f"Failed to initialize VectorStore: {str(e)}")
            raise

    @property
    def client(self):
        self._ensure_initialized()
        return self._client

    @property
    def embedding_model(self):
        self._ensure_initialized()
        return self._embedding_model
    
    def _init_collection(self):
        """Initialize collection if it doesn't exist."""
        try:
            collections = self._client.get_collections().collections
            if not any(c.name == self.collection_name for c in collections):
                logger.info(f"Creating collection: {self.collection_name}")
                self._client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=384,  # all-MiniLM-L6-v2 dimension
                        distance=Distance.COSINE
                    )
                )
        except Exception as e:
            logger.error(f"Error checking/creating collection: {str(e)}")
    
    def add_query(
        self,
        query_id: str,
        query_text: str,
        answer: str,
        metadata: Dict[str, Any]
    ) -> str:
        start_time = time.time()
        combined_text = f"{query_text}\n\n{answer}"
        
        try:
            embedding = self.embedding_model.encode(combined_text).tolist()
            
            point = PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={
                    "query_id": query_id,
                    "text": combined_text,
                    **metadata
                }
            )
            
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
            
            elapsed = time.time() - start_time
            logger.info(f"Successfully added query {query_id} to vector store in {elapsed:.4f}s")
            return query_id
        except Exception as e:
            logger.error(f"Failed to add query {query_id} to vector store: {str(e)}")
            raise
    
    def search_similar(
        self,
        query: str,
        k: int = 5,
        user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        start_time = time.time()
        logger.info(f"Searching for similar queries to: '{query}'")
        
        try:
            embedding = self.embedding_model.encode(query).tolist()
            
            query_filter = None
            if user_id:
                from qdrant_client.models import Filter, FieldCondition, MatchValue
                query_filter = Filter(
                    must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
                )
            
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=embedding,
                limit=k,
                query_filter=query_filter
            )
            
            similar_queries = []
            for result in results:
                similar_queries.append({
                    'id': result.payload.get('query_id'),
                    'distance': 1 - result.score,  # Convert similarity to distance
                    'metadata': result.payload,
                    'document': result.payload.get('text', '')
                })
            
            elapsed = time.time() - start_time
            logger.info(f"Vector search found {len(similar_queries)} results in {elapsed:.4f}s")
            return similar_queries
        except Exception as e:
            logger.error(f"Vector search failed: {str(e)}")
            return []
    
    def delete_query(self, query_id: str) -> bool:
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="query_id", match=MatchValue(value=query_id))]
                )
            )
            logger.info(f"Deleted query {query_id} from vector store")
            return True
        except Exception as e:
            logger.error(f"Failed to delete query {query_id} from vector store: {str(e)}")
            return False
    
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
    
    def get_collection_stats(self) -> Dict[str, Any]:
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "total_queries": info.points_count,
                "embedding_dimension": 384,
                "model": settings.EMBEDDING_MODEL
            }
        except Exception as e:
            logger.error(f"Failed to get collection stats: {str(e)}")
            return {}


vector_store = VectorStore()
