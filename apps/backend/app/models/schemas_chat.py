from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class ChatMessage(BaseModel):
    role: str # 'user' or 'assistant'
    content: str

class ChatResearchRequest(BaseModel):
    query: str
    history: List[ChatMessage] = []
    source_ids: List[str] = [] # User selected paper IDs from library
    uploaded_text: Optional[str] = None # Text extracted from uploaded files
    provider: Optional[str] = None
    model: Optional[str] = None

class ChatResearchResponse(BaseModel):
    answer: str
    sources_used: List[str]
