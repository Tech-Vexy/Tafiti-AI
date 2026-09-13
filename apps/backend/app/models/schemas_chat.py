from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str # 'user' or 'assistant'
    content: str
    sources: Optional[List[dict]] = None

class ChatResearchRequest(BaseModel):
    query: str
    history: List[ChatMessage] = []
    source_ids: List[str] = [] # User selected paper IDs from library
    papers: Optional[List[dict]] = None # Active research thread papers/sources
    uploaded_text: Optional[str] = None # Text extracted from uploaded files
    provider: Optional[str] = None
    model: Optional[str] = None
    career_field: Optional[str] = None
    selected_indexes: Optional[List[str]] = None
    research_mode: Optional[str] = "synthesis" # 'synthesis' | 'search' | 'table' | 'gaps'
    latency_mode: Optional[str] = "auto" # 'fast' | 'auto' | 'deep'
    citation_style: Optional[str] = "apa" # 'apa' | 'ieee' | 'chicago'


class ChatResearchResponse(BaseModel):
    answer: str
    sources_used: List[str]
