from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime


# User Schemas
class UserBase(BaseModel):
    username: Optional[str] = Field(None, max_length=80)
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    university: Optional[str] = None
    expertise_areas: List[str] = []
    career_field: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    university: Optional[str] = None
    expertise_areas: Optional[List[str]] = None
    career_field: Optional[str] = None


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    citation_count: int = 0
    interest_score: int = 0
    publications_count: int = 0
    subscription_status: str = "trialing"
    trial_ends_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
    notification_count: int = 0
    has_given_feedback: bool = False

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    favorite_feature: Optional[str] = None
    improvement_text: Optional[str] = None
    would_recommend: Optional[str] = None


class FeedbackPublicResponse(BaseModel):
    id: str
    rating: int
    quote: Optional[str] = None  # Maps to improvement_text or favorite_feature
    author: str  # Maps to username or "Anonymous"
    role: Optional[str] = None  # Maps to career_field
    avatar: Optional[str] = None

    class Config:
        from_attributes = True

# ... (other code between line 40 and 180)

class ConnectionResponse(BaseModel):
    id: int
    follower_id: str
    followed_id: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    user_id: str
    type: str
    content: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class PaperImpactResponse(BaseModel):
    paper_id: str
    career_field: str
    relevance_score: int # 1-10
    impact_summary: str
    key_takeaway: str
    potential_applications: List[str]


class UserDiscoveryResponse(BaseModel):
    id: str
    username: Optional[str] = None
    university: Optional[str] = None
    expertise_areas: List[str] = []
    bio: Optional[str] = None
    similarity_score: float = 0.0

    class Config:
        from_attributes = True


# Paper Schemas
class PaperBase(BaseModel):
    id: str
    title: str
    year: Optional[int] = None
    citations: Optional[int] = 0
    abstract: Optional[str] = ""
    authors: List[str] = []


class PaperSearchRequest(BaseModel):
    query: str = Field(..., min_length=3)
    limit: int = Field(default=5, ge=1, le=20)
    filters: Optional[dict] = None


class PaperSearchResponse(BaseModel):
    papers: List[PaperBase]
    total: int
    from_cache: bool = False


# Synthesis Schemas
class SynthesisRequest(BaseModel):
    query: str
    papers: List[PaperBase]
    provider: Optional[str] = None
    model: Optional[str] = None
    project_id: Optional[int] = None
    output_language: Optional[str] = "English"  # e.g. "Swahili", "French", "Arabic"


class SynthesisResponse(BaseModel):
    answer: str
    sources_used: List[int]
    processing_time: float
    followup_questions: List[str] = []


# Saved Query Schemas
class SavedQueryBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    query: str
    papers: List[PaperBase]
    answer: str
    tags: List[str] = []


class SavedQueryCreate(SavedQueryBase):
    pass


class SavedQueryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    tags: Optional[List[str]] = None
    is_favorite: Optional[bool] = None


class SavedQueryResponse(SavedQueryBase):
    id: int
    user_id: str
    is_favorite: bool
    project_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# User Settings Schemas
class UserSettingsBase(BaseModel):
    theme: str = "dark"
    default_paper_limit: int = Field(default=5, ge=1, le=20)
    llm_provider: str = "groq"
    llm_model: Optional[str] = None
    auto_export: bool = False
    export_format: str = "markdown"
    preferences: dict = {}


class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    default_paper_limit: Optional[int] = Field(None, ge=1, le=20)
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    auto_export: Optional[bool] = None
    export_format: Optional[str] = None
    preferences: Optional[dict] = None


class UserSettingsResponse(UserSettingsBase):
    id: int
    user_id: str
    
    class Config:
        from_attributes = True


# Statistics Schemas
class UserStatistics(BaseModel):
    total_queries: int
    saved_queries: int
    favorites: int
    avg_papers_per_query: float
    total_synthesis_time: float


# Vector Search Schemas
class VectorSearchRequest(BaseModel):
    query: str
    k: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class VectorSearchResult(BaseModel):
    query_id: int
    title: str
    similarity: float
    created_at: datetime


class SearchHistoryResponse(BaseModel):
    id: int
    user_id: str
    query: str
    results_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# Note Schemas
class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""
    tags: List[str] = []


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class NoteResponse(NoteBase):
    id: str
    user_id: str
    project_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Project & Collaboration Schemas
class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    owner_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProjectMemberResponse(BaseModel):
    id: int
    project_id: int
    user_id: str
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProjectActivityResponse(BaseModel):
    id: int
    project_id: int
    user_id: Optional[str] = None
    activity_type: str
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProjectInviteRequest(BaseModel):
    user_id: str
    role: str = "member" # member, editor, viewer


# Citation Graph Schemas
class CitationGraphResponse(BaseModel):
    seed: Optional[PaperBase] = None
    references: List[PaperBase] = []       # papers the seed cites (past)
    cited_by: List[PaperBase] = []         # papers that cite the seed (future)
    total_cited_by_count: int = 0          # full cited_by count from OpenAlex
    total_references_count: int = 0        # full reference list length from OpenAlex


# Gap Analysis Schemas
class GapAnalysisRequest(BaseModel):
    papers: List[PaperBase]
    research_context: Optional[str] = None  # e.g. "PhD thesis on AI ethics in Africa"


class ResearchGap(BaseModel):
    category: str          # e.g. "Geographic", "Methodological", "Temporal", "Demographic"
    title: str
    description: str
    suggested_questions: List[str]
    urgency: str           # "High", "Medium", "Low"


class GapAnalysisResponse(BaseModel):
    gaps: List[ResearchGap]
    summary: str
    papers_analyzed: int
    processing_time: float
