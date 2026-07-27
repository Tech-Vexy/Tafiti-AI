from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# User Schemas
class UserBase(BaseModel):
    username: str | None = Field(None, max_length=80)
    email: EmailStr | None = None
    bio: str | None = None
    university: str | None = None
    expertise_areas: list[str] = []
    career_field: str | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    bio: str | None = None
    university: str | None = None
    expertise_areas: list[str] | None = None
    career_field: str | None = None


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    last_login: datetime | None = None
    citation_count: int = 0
    interest_score: int = 0
    publications_count: int = 0
    subscription_status: str = "trialing"
    trial_ends_at: datetime | None = None
    subscription_ends_at: datetime | None = None
    notification_count: int = 0
    has_given_feedback: bool = False

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    favorite_feature: str | None = None
    improvement_text: str | None = None
    would_recommend: str | None = None


class FeedbackPublicResponse(BaseModel):
    id: str
    rating: int
    quote: str | None = None  # Maps to improvement_text or favorite_feature
    author: str  # Maps to username or "Anonymous"
    role: str | None = None  # Maps to career_field
    avatar: str | None = None

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
    link: str | None = None
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
    potential_applications: list[str]


class UserDiscoveryResponse(BaseModel):
    id: str
    username: str | None = None
    university: str | None = None
    expertise_areas: list[str] = []
    bio: str | None = None
    similarity_score: float = 0.0

    class Config:
        from_attributes = True


# Paper Schemas
class PaperBase(BaseModel):
    id: str
    title: str
    year: int | None = None
    citations: int | None = 0
    abstract: str | None = ""
    authors: list[str] = []


class PaperSearchRequest(BaseModel):
    query: str = Field(..., min_length=3)
    limit: int = Field(default=10, ge=1, le=50)
    filters: dict | None = None


class PaperSearchResponse(BaseModel):
    papers: list[PaperBase]
    total: int
    from_cache: bool = False


# Synthesis Schemas
class SynthesisRequest(BaseModel):
    query: str
    papers: list[PaperBase]
    provider: str | None = None
    model: str | None = None
    project_id: int | None = None
    output_language: str | None = "English"  # e.g. "Swahili", "French", "Arabic"


class SynthesisResponse(BaseModel):
    answer: str
    sources_used: list[int]
    processing_time: float
    followup_questions: list[str] = []


# Saved Query Schemas
class SavedQueryBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    query: str
    papers: list[PaperBase]
    answer: str
    tags: list[str] = []


class SavedQueryCreate(SavedQueryBase):
    pass


class SavedQueryUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    tags: list[str] | None = None
    is_favorite: bool | None = None


class SavedQueryResponse(SavedQueryBase):
    id: int
    user_id: str
    is_favorite: bool
    project_id: int | None = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# User Settings Schemas
class UserSettingsBase(BaseModel):
    theme: str = "dark"
    default_paper_limit: int = Field(default=10, ge=1, le=50)
    llm_provider: str = "groq"
    llm_model: str | None = None
    auto_export: bool = False
    export_format: str = "markdown"
    preferences: dict = {}


class UserSettingsUpdate(BaseModel):
    theme: str | None = None
    default_paper_limit: int | None = Field(None, ge=1, le=50)
    llm_provider: str | None = None
    llm_model: str | None = None
    auto_export: bool | None = None
    export_format: str | None = None
    preferences: dict | None = None


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
    tags: list[str] = []


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = None
    tags: list[str] | None = None


class NoteResponse(NoteBase):
    id: str
    user_id: str
    project_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Project & Collaboration Schemas
class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None

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
    user_id: str | None = None
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
    seed: PaperBase | None = None
    references: list[PaperBase] = []       # papers the seed cites (past)
    cited_by: list[PaperBase] = []         # papers that cite the seed (future)
    total_cited_by_count: int = 0          # full cited_by count from OpenAlex
    total_references_count: int = 0        # full reference list length from OpenAlex


# Gap Analysis Schemas
class GapAnalysisRequest(BaseModel):
    papers: list[PaperBase]
    research_context: str | None = None  # e.g. "PhD thesis on AI ethics in Africa"


class ResearchGap(BaseModel):
    category: str          # e.g. "Geographic", "Methodological", "Temporal", "Demographic"
    title: str
    description: str
    suggested_questions: list[str]
    urgency: str           # "High", "Medium", "Low"


class GapAnalysisResponse(BaseModel):
    gaps: list[ResearchGap]
    summary: str
    papers_analyzed: int
    processing_time: float
