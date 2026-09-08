from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, List, Any, Dict
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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)

# ... (other code between line 40 and 180)

class ConnectionResponse(BaseModel):
    id: int
    follower_id: str
    followed_id: str
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class NotificationResponse(BaseModel):
    id: int
    user_id: str
    type: str
    content: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)


# Paper Schemas
class PaperBase(BaseModel):
    id: str
    title: str
    year: Optional[int] = None
    citations: Optional[int] = 0
    abstract: Optional[str] = ""
    authors: List[str] = []
    doi: Optional[str] = None
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    publisher: Optional[str] = None
    source: Optional[str] = None


class PaperSearchRequest(BaseModel):
    query: str = Field(..., min_length=3)
    limit: int = Field(default=10, ge=1, le=50)
    filters: Optional[dict] = None


class PaperSearchResponse(BaseModel):
    papers: List[PaperBase]
    total: int
    from_cache: bool = False


class SpringerSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=10, ge=1, le=100)
    open_access_only: bool = Field(default=False)
    api_source: Optional[str] = Field(default="all", description="'meta', 'openaccess', or 'all'")
    filters: Optional[dict] = None


class ParallelSearchRequest(BaseModel):
    search_queries: List[str] = Field(..., min_length=1)
    objective: Optional[str] = None
    mode: Optional[str] = "advanced"
    advanced_settings: Optional[dict] = None
    max_results: Optional[int] = Field(default=10, ge=1, le=50)


class ParallelWebResult(BaseModel):
    title: str
    url: str
    publish_date: Optional[str] = None
    excerpts: List[str] = []


class ParallelSearchResponse(BaseModel):
    search_id: Optional[str] = None
    session_id: Optional[str] = None
    results: List[ParallelWebResult]
    total: int
    warnings: List[Any] = []


class ParallelTaskCreateRequest(BaseModel):
    input_prompt: str = Field(..., min_length=5, description="Deep research topic or question")
    processor: Optional[str] = Field(default="pro", description="'pro' (~10m) or 'ultra'")


class ParallelTaskCitation(BaseModel):
    url: str
    title: Optional[str] = None
    excerpt: Optional[str] = None


class ParallelTaskBasis(BaseModel):
    field: str
    citations: List[ParallelTaskCitation] = []


class ParallelTaskResultResponse(BaseModel):
    run_id: str
    content: Optional[str] = None
    basis: List[ParallelTaskBasis] = []
    status: str = "completed"


class ParallelExtractRequest(BaseModel):
    urls: List[str] = Field(..., min_length=1)


class ParallelExtractResultItem(BaseModel):
    url: str
    title: Optional[str] = None
    text: Optional[str] = None


class ParallelExtractResponse(BaseModel):
    results: List[ParallelExtractResultItem] = []


# Synthesis Schemas
class SynthesisRequest(BaseModel):
    query: str
    papers: List[PaperBase]
    provider: Optional[str] = None
    model: Optional[str] = None
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
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# User Settings Schemas
class UserSettingsBase(BaseModel):
    theme: str = "dark"
    default_paper_limit: int = Field(default=10, ge=1, le=50)
    llm_provider: str = "groq"
    llm_model: Optional[str] = None
    auto_export: bool = False
    export_format: str = "markdown"
    preferences: dict = {}


class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    default_paper_limit: Optional[int] = Field(None, ge=1, le=50)
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    auto_export: Optional[bool] = None
    export_format: Optional[str] = None
    preferences: Optional[dict] = None


class UserSettingsResponse(UserSettingsBase):
    id: int
    user_id: str
    
    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


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
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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

# Deep Research Schemas
class DeepResearchRequest(BaseModel):
    query: str
    engine: str = "gemini"  # "gemini", "gemini-max", or "parallel"
    mcp_servers: Optional[List[str]] = None  # e.g., ["http://localhost:8000/mcp"]
    thinking_summaries: Optional[str] = None  # "auto" or "none"
    visualization: Optional[str] = None  # "auto" or "off"
    collaborative_planning: Optional[bool] = None

class DeepResearchResponse(BaseModel):
    interaction_id: str
    message: str

class DeepResearchStatusResponse(BaseModel):
    interaction_id: str
    status: str
    output: Optional[str] = None
    error: Optional[str] = None
    progress: Optional[str] = None  # interim progress text while running

class CitationValidation(BaseModel):
    claim: str
    citation: str
    is_valid: bool
    confidence_score: float = Field(ge=0.0, le=1.0)
    explanation: Optional[str] = None

class DeepResearchValidationResponse(BaseModel):
    interaction_id: str
    overall_confidence: float = Field(ge=0.0, le=1.0)
    validations: List[CitationValidation]


# ─── Thesis Editor Schemas ──────────────────────────────────────────────────

class ThesisCreate(BaseModel):
    title: str = Field(default="Untitled Thesis", max_length=500)
    content: str = Field(default="{}")  # SFDT JSON
    question_id: Optional[str] = None


class ThesisUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None  # SFDT JSON
    plain_text: Optional[str] = None
    word_count: Optional[int] = None
    page_count: Optional[int] = None
    status: Optional[str] = Field(None, pattern=r"^(draft|in_review|submitted|archived)$")
    question_id: Optional[str] = None


class ThesisResponse(BaseModel):
    id: str
    user_id: str
    title: str
    content: str  # SFDT JSON
    plain_text: Optional[str] = None
    word_count: int = 0
    page_count: int = 0
    format_version: str = "25"
    status: str = "draft"
    last_auto_save_at: Optional[datetime] = None
    question_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ThesisListResponse(BaseModel):
    """Lightweight list item (no content) for the sidebar."""
    id: str
    title: str
    status: str
    word_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ThesisVersionResponse(BaseModel):
    versions: List[dict] = []  # [{version: int, created_at: str, word_count: int}]
    total_versions: int = 0


# ─── Research Intelligence Layer Schemas ─────────────────────────────────────

class ResearchQuestionCreate(BaseModel):
    question: str = Field(..., min_length=5)
    description: Optional[str] = None


class ResearchQuestionResponse(BaseModel):
    id: str
    user_id: str
    question: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    task_count: int = 0
    claim_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ResearchTaskResponse(BaseModel):
    id: str
    question_id: str
    task_type: str
    description: str
    status: str
    depends_on: List[str] = []
    result_summary: Optional[str] = None
    error: Optional[str] = None
    agent_model: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    source_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class SourceResponse(BaseModel):
    id: str
    task_id: str
    external_id: Optional[str] = None
    source_type: str
    title: str
    authors: List[str] = []
    year: Optional[int] = None
    journal: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    abstract: Optional[str] = None
    citation_count: Optional[int] = None
    relevance_score: int = 0
    discovered_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PassageResponse(BaseModel):
    id: str
    source_id: str
    content: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    position: int = 0
    extracted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceCreate(BaseModel):
    passage_id: str
    claim_id: Optional[str] = None
    relation: str = Field(..., pattern=r"^(supports|contradicts|contextualizes)$")
    confidence: int = Field(default=80, ge=0, le=100)
    notes: Optional[str] = None


class EvidenceResponse(BaseModel):
    id: str
    passage_id: str
    claim_id: Optional[str] = None
    relation: str
    confidence: int
    extracted_by: Optional[str] = None
    notes: Optional[str] = None
    extracted_at: datetime
    passage: Optional[PassageResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ClaimCreate(BaseModel):
    text: str = Field(..., min_length=5)
    claim_type: str = Field(default="finding", pattern=r"^(finding|hypothesis|conclusion|contradiction)$")
    parent_claim_id: Optional[str] = None


class ClaimResponse(BaseModel):
    id: str
    question_id: str
    text: str
    claim_type: str
    confidence: int
    supporting_count: int = 0
    contradicting_count: int = 0
    verification_status: str
    parent_claim_id: Optional[str] = None
    reviewed_by_user: bool = False
    user_verdict: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    evidence: List[EvidenceResponse] = []
    child_claims: List["ClaimResponse"] = []

    model_config = ConfigDict(from_attributes=True)


class ClaimUpdate(BaseModel):
    verification_status: Optional[str] = Field(None, pattern=r"^(unverified|verified|disputed|overturned)$")
    user_verdict: Optional[str] = Field(None, pattern=r"^(accepted|rejected|needs_revision)$")
    reviewed_by_user: bool = True


class ResearchGraphResponse(BaseModel):
    """Full research graph: question + tasks + sources + claims + evidence."""
    question: ResearchQuestionResponse
    tasks: List[ResearchTaskResponse] = []
    claims: List[ClaimResponse] = []
    total_sources: int = 0
    total_passages: int = 0
    total_evidence: int = 0


class ResearchProgressResponse(BaseModel):
    """Summary of all research questions for a user."""
    questions: List[ResearchQuestionResponse]
    total_tasks: int = 0
    total_sources: int = 0
    total_claims: int = 0
    verified_claims: int = 0
    disputed_claims: int = 0


# ─── Dynamic Research Teams Schemas ──────────────────────────────────────────

class TeamCreate(BaseModel):
    """Request to form a new research team."""
    question_id: str
    name: Optional[str] = None  # auto-generated if not provided
    max_agents: int = Field(default=8, ge=2, le=20)
    initial_plan: Optional[dict] = None  # collaborative plan from user


class AgentSpawnRequest(BaseModel):
    """Request to spawn a new agent within a team."""
    role: str = Field(..., description="Agent role: lead, researcher, critic, synthesist, extractor, verifier, scout")
    name: Optional[str] = None  # auto-generated if not provided
    description: Optional[str] = None  # what this agent should focus on
    parent_agent_id: Optional[str] = None  # if spawning as sub-agent of another agent
    capabilities: List[str] = []  # e.g. ["search_openalex", "extract_claims"]
    agent_model: Optional[str] = None  # override default model


class AgentResponse(BaseModel):
    """Response model for an agent."""
    id: str
    team_id: str
    parent_agent_id: Optional[str] = None
    role: str
    name: Optional[str] = None
    description: Optional[str] = None
    status: str
    agent_model: Optional[str] = None
    capabilities: List[str] = []
    current_task_id: Optional[str] = None
    tasks_completed: int = 0
    tasks_failed: int = 0
    output_summary: Optional[str] = None
    error: Optional[str] = None
    spawned_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    sub_agent_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class AgentMessageCreate(BaseModel):
    """Send a message between agents (or from system)."""
    sender_agent_id: Optional[str] = None  # null = system
    receiver_agent_id: Optional[str] = None  # null = broadcast
    message_type: str = Field(..., description="Type: task_assigned, task_complete, spawn_request, finding, critique, synthesis, status_update")
    content: str = Field(..., min_length=1)
    metadata: dict = {}
    priority: int = 0


class AgentMessageResponse(BaseModel):
    """Response model for an agent message."""
    id: str
    team_id: str
    sender_agent_id: Optional[str] = None
    receiver_agent_id: Optional[str] = None
    sender_name: Optional[str] = None
    receiver_name: Optional[str] = None
    message_type: str
    content: str
    metadata: dict = {}
    priority: int = 0
    is_read: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamResponse(BaseModel):
    """Full team status response."""
    id: str
    question_id: str
    name: Optional[str] = None
    status: str
    team_plan: dict = {}
    agent_count: int = 0
    active_agents: int = 0
    completed_agents: int = 0
    failed_agents: int = 0
    max_agents: int = 8
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamDetailResponse(BaseModel):
    """Detailed team status with agents and recent messages."""
    team: TeamResponse
    agents: List[AgentResponse] = []
    recent_messages: List[AgentMessageResponse] = []
    shared_context: Optional[str] = None


class TeamPlanUpdate(BaseModel):
    """Update the team's collaborative plan."""
    plan: dict = Field(..., description="Updated plan with goals, phases, milestones")
    note: Optional[str] = None  # human note about what changed


class CollaborativePlanRequest(BaseModel):
    """Request to generate a collaborative research plan (Gemini Deep Research pattern)."""
    question_id: str
    approach: Optional[str] = None  # e.g. "Focus on recent papers" or "Include historical context"
    constraints: List[str] = []  # e.g. ["Only peer-reviewed papers", "Last 5 years"]


class CollaborativePlanResponse(BaseModel):
    """Generated collaborative plan for review before execution."""
    team_id: str
    plan: dict  # { goals, phases: [{name, description, agent_roles, depends_on}], milestones }
    suggested_roles: List[str] = []  # recommended agent roles for this research
    estimated_duration: Optional[str] = None
    ready_to_execute: bool = False


class SpawnSubagentRequest(BaseModel):
    """Request from an agent to spawn a sub-agent (dynamic composition)."""
    parent_agent_id: str
    role: str = "researcher"
    description: str = Field(..., min_length=10)
    capabilities: List[str] = []
    reason: str = Field(..., description="Why this sub-agent is needed")


# ─── Statefulness Schemas ────────────────────────────────────────────────────

class AuditLogEntry(BaseModel):
    """A single audit log entry for a state transition."""
    id: str
    entity_type: str
    entity_id: str
    from_status: Optional[str] = None
    to_status: str
    reason: Optional[str] = None
    actor: Optional[str] = None
    metadata: dict = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    """Paginated audit log for an entity or question."""
    entries: List[AuditLogEntry]
    total: int = 0


class AgentMemoryCreate(BaseModel):
    """Add a memory to an agent."""
    memory_type: str = Field(..., description="finding, rejected_lead, strategy, context, entity")
    content: str = Field(..., min_length=1)
    confidence: int = Field(default=80, ge=0, le=100)
    source_task_id: Optional[str] = None
    source_claim_id: Optional[str] = None


class AgentMemoryResponse(BaseModel):
    """A single memory entry."""
    id: str
    agent_id: str
    memory_type: str
    content: str
    confidence: int
    access_count: int = 0
    is_active: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CheckpointResponse(BaseModel):
    """A research checkpoint."""
    id: str
    question_id: str
    team_id: Optional[str] = None
    trigger: str
    summary: Optional[str] = None
    task_count: int = 0
    source_count: int = 0
    claim_count: int = 0
    agent_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CheckpointDetailResponse(CheckpointResponse):
    """Checkpoint with full snapshot."""
    snapshot: dict = {}


class SessionStatusResponse(BaseModel):
    """Status of a background research session."""
    question_id: str
    is_running: bool
    total_tasks: int = 0
    completed_tasks: int = 0
    ready_tasks: int = 0
    blocked_tasks: int = 0
    running_tasks: int = 0
    checkpoints: int = 0
    last_checkpoint: Optional[datetime] = None
    agent_count: int = 0
    active_agents: int = 0
    elapsed_seconds: int = 0
    estimated_remaining: Optional[str] = None


# ─── Durability Schemas ──────────────────────────────────────────────────────

class SessionStateResponse(BaseModel):
    """Persistent session state response."""
    id: str
    question_id: str
    status: str
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    batches_run: int = 0
    last_error: Optional[str] = None
    retry_count: int = 0
    heartbeat_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExecutionLogResponse(BaseModel):
    """Task execution log entry (write-ahead log)."""
    id: str
    task_id: str
    agent_id: Optional[str] = None
    status: str
    attempt_number: int = 1
    planned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_summary: Optional[str] = None
    error: Optional[str] = None
    timeout_seconds: int = 300

    model_config = ConfigDict(from_attributes=True)


class CrashRecoveryResponse(BaseModel):
    """Crash recovery status."""
    orphaned_sessions: int = 0
    recovered_sessions: int = 0
    orphaned_tasks: int = 0
    recovered_tasks: int = 0
    details: List[dict] = []
