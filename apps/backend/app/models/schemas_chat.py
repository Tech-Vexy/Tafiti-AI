
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str # 'user' or 'assistant'
    content: str

class ChatResearchRequest(BaseModel):
    query: str
    history: list[ChatMessage] = []
    source_ids: list[str] = [] # User selected paper IDs from library
    uploaded_text: str | None = None # Text extracted from uploaded files
    provider: str | None = None
    model: str | None = None

class ChatResearchResponse(BaseModel):
    answer: str
    sources_used: list[str]
