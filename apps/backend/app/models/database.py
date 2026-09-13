from app.core.timeutil import utcnow
import json
import os
import uuid

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON, Index, LargeBinary, UniqueConstraint
from sqlalchemy import TypeDecorator
from sqlalchemy.orm import relationship

from app.db.session import Base

if os.environ.get("TESTING") == "1":
    JSONB = JSON
else:
    from sqlalchemy.dialects.postgresql import JSONB

DB_JSON = JSON if os.environ.get("TESTING") else JSONB

class FlexibleJSONB(TypeDecorator):
    impl = JSON().with_variant(JSONB, "postgresql")
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (ValueError, TypeError):
                pass
        return value

class FlexibleJSON(TypeDecorator):
    impl = JSON
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (ValueError, TypeError):
                pass
        return value

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(80), unique=True, index=True, nullable=True)
    email = Column(String(120), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True) # Optional with Neon Auth
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Academic Profile Fields
    bio = Column(Text, nullable=True)
    university = Column(String(200), nullable=True)
    expertise_areas = Column(FlexibleJSONB, default=list)  # List of strings
    career_field = Column(String(200), nullable=True)
    citation_count = Column(Integer, default=0)
    publications_count = Column(Integer, default=0)
    interest_score = Column(Integer, default=0)
    
    # Subscription & Trial
    subscription_status = Column(String(20), default="trialing") # trialing, active, expired, canceled
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_ends_at = Column(DateTime, nullable=True)
    paystack_customer_id = Column(String(100), nullable=True)
    paystack_subscription_id = Column(String(100), nullable=True)
    has_given_feedback = Column(Boolean, default=False)
    
    queries = relationship("SavedQuery", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    theses = relationship("Thesis", back_populates="user", cascade="all, delete-orphan")
    saved_papers = relationship("SavedPaper", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    research_sessions = relationship("ResearchSession", back_populates="user", cascade="all, delete-orphan")
    deep_research_sessions = relationship("DeepResearchSession", back_populates="user", cascade="all, delete-orphan")
    search_history = relationship("SearchHistory", back_populates="user", cascade="all, delete-orphan")
    
    # Social Relationships
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    
    # Connections as follower (active)
    following = relationship(
        "Connection",
        foreign_keys="Connection.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan"
    )
    # Connections as followed (passive)
    followers = relationship(
        "Connection",
        foreign_keys="Connection.followed_id",
        back_populates="followed",
        cascade="all, delete-orphan"
    )

    # Research Intelligence Layer
    # (backrefs: research_questions via ResearchQuestion.user, uploaded_files)

class SavedQuery(Base):
    __tablename__ = "saved_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    query = Column(Text, nullable=False)
    papers = Column(FlexibleJSONB, nullable=False)
    answer = Column(Text, nullable=False)
    tags = Column(FlexibleJSONB, default=list)
    is_favorite = Column(Boolean, default=False)
    vector_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    user = relationship("User", back_populates="queries")

class UserSettings(Base):
    __tablename__ = "user_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String(20), default="dark")
    default_paper_limit = Column(Integer, default=5)
    llm_provider = Column(String(20), default="nvidia")
    llm_model = Column(String(50), nullable=True)
    auto_export = Column(Boolean, default=False)
    export_format = Column(String(20), default="markdown")
    preferences = Column(FlexibleJSON, default=dict)
    
    user = relationship("User", back_populates="settings")

class ResearchSession(Base):
    __tablename__ = "research_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    papers_count = Column(Integer, default=0)
    synthesis_length = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    
    user = relationship("User", back_populates="research_sessions")

class SavedPaper(Base):
    __tablename__ = "saved_papers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id = Column(String(100), nullable=False) # OpenAlex ID
    title = Column(String(500), nullable=False)
    filters = Column(FlexibleJSONB, default=dict)  # Store search filters
    authors = Column(FlexibleJSONB, default=list)
    year = Column(Integer)
    citations = Column(Integer)
    abstract = Column(Text)
    created_at = Column(DateTime, default=utcnow)
    
    user = relationship("User", back_populates="saved_papers")
    
class Note(Base):
    __tablename__ = "notes"
    
    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False, default="")
    tags = Column(FlexibleJSON, default=list)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    user = relationship("User", back_populates="notes")

class SearchHistory(Base):
    __tablename__ = "search_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    results_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    
    user = relationship("User", back_populates="search_history")

class Connection(Base):
    __tablename__ = "connections"
    
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followed_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending") # pending, accepted, blocked
    created_at = Column(DateTime, default=utcnow)
    
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    followed = relationship("User", foreign_keys=[followed_id], back_populates="followers")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False) # connection_request, synthesis_complete, paper_clipt
    content = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    
    user = relationship("User", back_populates="notifications")

class TrialFeedback(Base):
    __tablename__ = "trial_feedback"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    favorite_feature = Column(String(50), nullable=True)
    improvement_text = Column(Text, nullable=True)
    would_recommend = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=utcnow)

# ─── File Uploads History ─────────────────────────────────────────────────────

class UploadedFile(Base):
    """Tracks every PDF a user uploads to Supabase Storage."""
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    cid = Column(String(500), nullable=True)           # Supabase Storage path (e.g. user_id/filename.pdf)
    file_size = Column(Integer, nullable=True)          # bytes
    uploaded_at = Column(DateTime, default=utcnow)

    user = relationship("User", backref="uploaded_files")

class DeepResearchSession(Base):
    __tablename__ = "deep_research_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    interaction_id = Column(String(255), index=True, nullable=True) # Null if cached
    status = Column(String(50), default="pending")
    output = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="deep_research_sessions")


# ─── Research Intelligence Layer ─────────────────────────────────────────────

class ResearchQuestion(Base):
    """
    A top-level research question that drives an investigation.
    Owns a DAG of ResearchTasks, which produce Sources -> Passages -> Evidence -> Claims.
    """
    __tablename__ = "research_questions"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")  # active, paused, completed, abandoned
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", backref="research_questions")
    tasks = relationship("ResearchTask", back_populates="question", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="question", cascade="all, delete-orphan")


class ResearchTask(Base):
    """
    A unit of work within a research question - a step in the Research DAG.
    Tasks can depend on other tasks, forming a directed acyclic graph.
    """
    __tablename__ = "research_tasks"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False)
    task_type = Column(String(50), nullable=False)  # search, literature_review, contradiction_search, synthesis, dataset_analysis
    description = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending, running, completed, failed, cancelled
    depends_on = Column(FlexibleJSONB, default=list)  # list of task IDs (DAG edges)
    result_summary = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    agent_model = Column(String(100), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    question = relationship("ResearchQuestion", back_populates="tasks")
    sources = relationship("Source", back_populates="task", cascade="all, delete-orphan")


class Source(Base):
    """
    A discovered source document (paper, dataset, webpage) linked to a research task.
    """
    __tablename__ = "research_sources"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(50), ForeignKey("research_tasks.id", ondelete="CASCADE"), nullable=False)
    external_id = Column(String(200), nullable=True, index=True)  # OpenAlex ID, DOI, PMID
    source_type = Column(String(50), nullable=False)  # paper, dataset, webpage, book, report
    title = Column(String(500), nullable=False)
    authors = Column(FlexibleJSONB, default=list)
    year = Column(Integer, nullable=True)
    journal = Column(String(300), nullable=True)
    doi = Column(String(200), nullable=True, index=True)
    url = Column(String(500), nullable=True)
    abstract = Column(Text, nullable=True)
    citation_count = Column(Integer, nullable=True)
    relevance_score = Column(Integer, default=0)  # 0-100
    source_metadata = Column("metadata", FlexibleJSONB, default=dict)
    discovered_at = Column(DateTime, default=utcnow)

    def __init__(self, **kwargs):
        if "metadata" in kwargs and "source_metadata" not in kwargs:
            kwargs["source_metadata"] = kwargs.pop("metadata")
        super().__init__(**kwargs)

    task = relationship("ResearchTask", back_populates="sources")
    passages = relationship("Passage", back_populates="source", cascade="all, delete-orphan")


class Passage(Base):
    """
    A specific excerpt from a Source that is relevant to the research question.
    Passages are the atomic unit of evidence extraction.
    """
    __tablename__ = "research_passages"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    source_id = Column(String(50), ForeignKey("research_sources.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    section = Column(String(200), nullable=True)
    position = Column(Integer, default=0)
    embedding_id = Column(String(100), nullable=True)  # reference to Qdrant vector
    extracted_at = Column(DateTime, default=utcnow)

    source = relationship("Source", back_populates="passages")
    evidence_items = relationship("Evidence", back_populates="passage", cascade="all, delete-orphan")


class Evidence(Base):
    """
    An evidence item: a Passage extracted and annotated to support or refute a Claim.
    Bridge between raw passages and structured claims.
    """
    __tablename__ = "research_evidence"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    passage_id = Column(String(50), ForeignKey("research_passages.id", ondelete="CASCADE"), nullable=False)
    claim_id = Column(String(50), ForeignKey("research_claims.id", ondelete="SET NULL"), nullable=True)
    relation = Column(String(20), nullable=False)  # supports, contradicts, contextualizes
    confidence = Column(Integer, default=80)  # 0-100
    extracted_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    extracted_at = Column(DateTime, default=utcnow)

    passage = relationship("Passage", back_populates="evidence_items")
    claim = relationship("Claim", back_populates="evidence")


class Claim(Base):
    """
    A specific, verifiable assertion derived from research evidence.
    Claims can support, contradict, or derive from other claims.
    """
    __tablename__ = "research_claims"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    claim_type = Column(String(50), default="finding")  # finding, hypothesis, conclusion, contradiction
    confidence = Column(Integer, default=50)  # 0-100, computed from evidence
    supporting_count = Column(Integer, default=0)
    contradicting_count = Column(Integer, default=0)
    verification_status = Column(String(20), default="unverified")  # unverified, verified, disputed, overturned
    parent_claim_id = Column(String(50), ForeignKey("research_claims.id", ondelete="SET NULL"), nullable=True)
    reviewed_by_user = Column(Boolean, default=False)
    user_verdict = Column(String(20), nullable=True)  # accepted, rejected, needs_revision
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    question = relationship("ResearchQuestion", back_populates="claims")
    evidence = relationship("Evidence", back_populates="claim")
    parent_claim = relationship("Claim", remote_side="Claim.id", backref="child_claims")


# ─── Thesis Editor ─────────────────────────────────────────────────────────

class Thesis(Base):
    """A thesis document stored as Syncfusion SFDT format for the word processor."""
    __tablename__ = "theses"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False, default="Untitled Thesis")
    # Syncfusion Document Editor content (SFDT JSON format)
    content = Column(Text, nullable=False, default="{}")
    # Plain-text version for search
    plain_text = Column(Text, nullable=True)
    # Metadata
    word_count = Column(Integer, default=0)
    page_count = Column(Integer, default=0)
    format_version = Column(String(20), default="25")  # Syncfusion format version
    # Status
    status = Column(String(30), default="draft")  # draft, in_review, submitted, archived
    # Auto-save tracking
    last_auto_save_at = Column(DateTime, nullable=True)
    # Yjs CRDT state for conflict-free collaborative editing
    yjs_state = Column(LargeBinary, nullable=True)  # Full Yjs document state
    yjs_state_vector = Column(LargeBinary, nullable=True)  # State vector for incremental sync
    # Version snapshots (JSON array of {version, content, created_at})
    version_history = Column(FlexibleJSONB, default=list)
    # Associated research question
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="theses")
    question = relationship("ResearchQuestion", backref="theses")


class ThesisCollaborator(Base):
    __tablename__ = "thesis_collaborators"
    __table_args__ = (UniqueConstraint("thesis_id", "user_id", name="uq_thesis_collaborator"),)

    id = Column(Integer, primary_key=True, index=True)
    thesis_id = Column(String(50), ForeignKey("theses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False, default="editor")
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reference = Column(String(100), unique=True, nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    currency = Column(String(10), nullable=False)
    status = Column(String(20), nullable=False, default="initialized")
    webhook_event = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)


# ─── Performance Indexes ─────────────────────────────────────────────────────
# Composite indexes for common query patterns to avoid full table scans.

Index("ix_theses_user_id", Thesis.user_id)
Index("ix_theses_status", Thesis.user_id, Thesis.status)
Index("ix_saved_papers_user_id", SavedPaper.user_id)
Index("ix_saved_queries_user_id", SavedQuery.user_id)
Index("ix_notes_user_id", Note.user_id)
Index("ix_notifications_user_read", Notification.user_id, Notification.is_read)
Index("ix_search_history_user_id", SearchHistory.user_id)
Index("ix_deep_research_interaction_id", DeepResearchSession.interaction_id)
# Evidence layer indexes
Index("ix_rql_user_id", ResearchQuestion.user_id)
Index("ix_rtask_question_id", ResearchTask.question_id)
Index("ix_rtask_status", ResearchTask.status)
Index("ix_rsource_task_id", Source.task_id)
Index("ix_rsource_doi", Source.doi)
Index("ix_rpassage_source_id", Passage.source_id)
Index("ix_revidence_passage_id", Evidence.passage_id)
Index("ix_revidence_claim_id", Evidence.claim_id)
Index("ix_rclaim_question_id", Claim.question_id)
Index("ix_rclaim_parent_id", Claim.parent_claim_id)
Index("ix_rclaim_verification", Claim.verification_status)


# ─── Dynamic Research Teams (AntiGravity-style) ──────────────────────────────

class AgentTeam(Base):
    """
    A dynamic research team formed around a research question.
    Teams are not predefined — they grow and adapt as research progresses.
    
    Inspired by Google AntiGravity's Teamwork pattern:
    - A Team Lead spawns specialized sub-agents as needed
    - Agents coordinate via shared context and message passing
    - Team composition evolves during research execution
    """
    __tablename__ = "agent_teams"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=True)  # auto-generated team name
    status = Column(String(20), default="forming")  # forming, active, paused, completed, disbanded
    team_plan = Column(FlexibleJSONB, default=dict)  # collaborative plan: goals, phases, milestones
    shared_context = Column(Text, nullable=True)  # accumulated knowledge shared across agents
    max_agents = Column(Integer, default=8)  # safety cap on agent count
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    question = relationship("ResearchQuestion", backref="agent_teams")
    agents = relationship("Agent", back_populates="team", cascade="all, delete-orphan")


class Agent(Base):
    """
    An individual agent within a research team.
    Agents have roles but are not limited to them — any agent can spawn sub-agents.
    
    Agent lifecycle: spawned → active → working → completed/failed/retired
    
    Key design: parent_agent_id enables recursive sub-agent spawning,
    so a "researcher" agent can spawn a "deep-dive" sub-agent when it
    encounters a complex sub-problem.
    """
    __tablename__ = "agents"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String(50), ForeignKey("agent_teams.id", ondelete="CASCADE"), nullable=False)
    parent_agent_id = Column(String(50), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)

    # Agent identity
    role = Column(String(50), nullable=False)  # lead, researcher, critic, synthesist, extractor, verifier, scout
    name = Column(String(100), nullable=True)  # human-readable name (e.g. "Literature Scout #1")
    description = Column(Text, nullable=True)  # what this agent is responsible for

    # Agent state
    status = Column(String(20), default="spawned")  # spawned, active, working, completed, failed, retired
    agent_model = Column(String(100), nullable=True)  # which LLM model powers this agent
    capabilities = Column(FlexibleJSONB, default=list)  # e.g. ["search", "extract", "synthesize"]

    # Task tracking
    current_task_id = Column(String(50), ForeignKey("research_tasks.id", ondelete="SET NULL"), nullable=True)
    tasks_completed = Column(Integer, default=0)
    tasks_failed = Column(Integer, default=0)

    # Output
    output_summary = Column(Text, nullable=True)
    error = Column(Text, nullable=True)

    # Lifecycle
    spawned_at = Column(DateTime, default=utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    retired_at = Column(DateTime, nullable=True)

    team = relationship("AgentTeam", back_populates="agents")
    parent_agent = relationship("Agent", remote_side="Agent.id", backref="sub_agents")
    current_task = relationship("ResearchTask", foreign_keys=[current_task_id])
    messages_sent = relationship("AgentMessage", foreign_keys="AgentMessage.sender_agent_id", back_populates="sender")
    messages_received = relationship("AgentMessage", foreign_keys="AgentMessage.receiver_agent_id", back_populates="receiver")


class AgentMessage(Base):
    """
    Inter-agent communication within a research team.
    Agents coordinate, share findings, delegate subtasks, and report results.
    
    Message types mirror AntiGravity's agent coordination patterns:
    - task_assigned: Lead assigns a task to a researcher
    - task_complete: Agent reports task completion with results
    - spawn_request: Agent asks lead to spawn a sub-agent
    - finding: Agent shares a discovery with the team
    - critique: Critic agent provides feedback
    - synthesis: Agent contributes to the team's synthesis
    - status_update: Agent reports its current status
    """
    __tablename__ = "agent_messages"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String(50), ForeignKey("agent_teams.id", ondelete="CASCADE"), nullable=False)
    sender_agent_id = Column(String(50), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True)  # null = system message
    receiver_agent_id = Column(String(50), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True)  # null = broadcast

    message_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    message_metadata = Column("metadata", FlexibleJSONB, default=dict)  # structured data
    priority = Column(Integer, default=0)  # higher = more urgent

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    team = relationship("AgentTeam", backref="messages")
    sender = relationship("Agent", back_populates="messages_sent", foreign_keys=[sender_agent_id])
    receiver = relationship("Agent", back_populates="messages_received", foreign_keys=[receiver_agent_id])


# ─── Dynamic Agent Indexes ───────────────────────────────────────────────────
Index("ix_ateam_question_id", AgentTeam.question_id)
Index("ix_ateam_status", AgentTeam.status)
Index("ix_agent_team_id", Agent.team_id)
Index("ix_agent_parent_id", Agent.parent_agent_id)
Index("ix_agent_status", Agent.status)
Index("ix_agent_role", Agent.role)
Index("ix_amsg_team_id", AgentMessage.team_id)
Index("ix_amsg_sender", AgentMessage.sender_agent_id)
Index("ix_amsg_receiver", AgentMessage.receiver_agent_id)
Index("ix_amsg_type", AgentMessage.message_type)

# ─── Research Statefulness ────────────────────────────────────────────────────

class ResearchAuditLog(Base):
    """Immutable audit trail for all state transitions in the research system.
    Records every status change with who did it, when, and why."""
    __tablename__ = "research_audit_log"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    # What changed (exactly one of these is set)
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=True)
    task_id = Column(String(50), ForeignKey("research_tasks.id", ondelete="SET NULL"), nullable=True)
    team_id = Column(String(50), ForeignKey("agent_teams.id", ondelete="SET NULL"), nullable=True)
    agent_id = Column(String(50), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    # Transition details
    entity_type = Column(String(30), nullable=False)  # question, task, team, agent
    entity_id = Column(String(50), nullable=False)
    from_status = Column(String(30), nullable=True)  # null for creation
    to_status = Column(String(30), nullable=False)
    reason = Column(Text, nullable=True)
    actor = Column(String(100), nullable=True)  # user_id, agent_id, "system", "scheduler"
    # Context snapshot
    log_metadata = Column("metadata", FlexibleJSONB, default=dict)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class AgentMemory(Base):
    """Persistent memory for each agent across tasks.
    Agents learn from their discoveries and share knowledge."""
    __tablename__ = "agent_memory"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String(50), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    memory_type = Column(String(30), nullable=False)  # finding, rejected_lead, strategy, context, entity
    content = Column(Text, nullable=False)
    # Relevance scoring
    confidence = Column(Integer, default=80)  # 0-100
    access_count = Column(Integer, default=0)
    # Source tracking
    source_task_id = Column(String(50), ForeignKey("research_tasks.id", ondelete="SET NULL"), nullable=True)
    source_claim_id = Column(String(50), ForeignKey("research_claims.id", ondelete="SET NULL"), nullable=True)
    # Lifecycle
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)  # optional TTL for ephemeral memories
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    agent = relationship("Agent", backref="memories")
    source_task = relationship("ResearchTask", foreign_keys=[source_task_id])


class ResearchCheckpoint(Base):
    """Serialized snapshot of full research state for pause/resume."""
    __tablename__ = "research_checkpoints"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(String(50), ForeignKey("agent_teams.id", ondelete="SET NULL"), nullable=True)
    # Snapshot
    trigger = Column(String(50), nullable=False)  # auto, manual, pause, complete, error
    snapshot = Column(FlexibleJSONB, nullable=False)  # full state serialization
    summary = Column(Text, nullable=True)
    # Metadata
    task_count = Column(Integer, default=0)
    source_count = Column(Integer, default=0)
    claim_count = Column(Integer, default=0)
    agent_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    question = relationship("ResearchQuestion", backref="checkpoints")


class ResearchTaskSchedule(Base):
    """Tracks DAG execution state for task dependency resolution."""
    __tablename__ = "research_task_schedules"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(String(50), ForeignKey("research_tasks.id", ondelete="CASCADE"), nullable=False)
    # DAG state
    is_ready = Column(Boolean, default=False)  # True when all deps are completed
    is_blocked = Column(Boolean, default=False)  # True when a dep failed
    blocked_by = Column(FlexibleJSONB, default=list)  # task IDs that are blocking
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    # Execution window
    scheduled_at = Column(DateTime, nullable=True)  # when it became ready
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    timeout_seconds = Column(Integer, default=300)  # per-task timeout

    question = relationship("ResearchQuestion", backref="task_schedules")
    task = relationship("ResearchTask", backref="schedule")

    def __init__(self, **kwargs):
        if "metadata" in kwargs and "schedule_metadata" not in kwargs:
            kwargs["schedule_metadata"] = kwargs.pop("metadata")
        super().__init__(**kwargs)


# ─── Statefulness Indexes ────────────────────────────────────────────────────
Index("ix_audit_log_question", ResearchAuditLog.question_id)
Index("ix_audit_log_entity", ResearchAuditLog.entity_type, ResearchAuditLog.entity_id)
Index("ix_audit_log_created", ResearchAuditLog.created_at)
Index("ix_agent_memory_agent_id", AgentMemory.agent_id)
Index("ix_agent_memory_type", AgentMemory.memory_type)
Index("ix_checkpoint_question_id", ResearchCheckpoint.question_id)
Index("ix_task_schedule_question", ResearchTaskSchedule.question_id)
Index("ix_task_schedule_ready", ResearchTaskSchedule.question_id, ResearchTaskSchedule.is_ready)
Index("ix_task_schedule_task", ResearchTaskSchedule.task_id)

# ─── Research Durability ──────────────────────────────────────────────────────

class ResearchSessionState(Base):
    """Persistent session state — replaces in-memory _active_sessions dict.
    Survives server restarts. Enables crash recovery."""
    __tablename__ = "research_session_states"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(50), ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False, unique=True)
    # Session lifecycle
    status = Column(String(20), default="idle")  # idle, running, paused, completed, failed, recovering
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    # Progress tracking
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    failed_tasks = Column(Integer, default=0)
    batches_run = Column(Integer, default=0)
    current_batch = Column(FlexibleJSONB, default=list)  # task IDs in current batch
    # Error state
    last_error = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    # Heartbeat — if heartbeat is stale, session is orphaned
    heartbeat_at = Column(DateTime, nullable=True)
    heartbeat_interval = Column(Integer, default=30)  # seconds
    # Checkpoint reference
    last_checkpoint_id = Column(String(50), ForeignKey("research_checkpoints.id", ondelete="SET NULL"), nullable=True)
    # Metadata
    session_metadata = Column("metadata", FlexibleJSONB, default=dict)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    question = relationship("ResearchQuestion", backref="session_state")


class TaskExecutionLog(Base):
    """Write-ahead log for task execution.
    Records intent to execute BEFORE the work happens.
    On crash recovery, tasks with 'executing' status but no completion = orphaned."""
    __tablename__ = "task_execution_logs"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(50), ForeignKey("research_tasks.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(50), ForeignKey("research_session_states.id", ondelete="SET NULL"), nullable=True)
    agent_id = Column(String(50), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    # WAL status
    status = Column(String(20), default="planned")  # planned, executing, completed, failed, orphaned
    # Timing
    planned_at = Column(DateTime, default=utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    # Results
    result_summary = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    # Idempotency
    idempotency_key = Column(String(100), nullable=True, index=True)  # task_id + attempt
    attempt_number = Column(Integer, default=1)
    # Timeout
    timeout_seconds = Column(Integer, default=300)
    timeout_at = Column(DateTime, nullable=True)

    task = relationship("ResearchTask", backref="execution_logs")
    session = relationship("ResearchSessionState", backref="execution_logs")


# ─── Durability Indexes ──────────────────────────────────────────────────────
Index("ix_session_state_question", ResearchSessionState.question_id)
Index("ix_session_state_status", ResearchSessionState.status)
Index("ix_session_state_heartbeat", ResearchSessionState.heartbeat_at)
Index("ix_exec_log_task_id", TaskExecutionLog.task_id)
Index("ix_exec_log_session_id", TaskExecutionLog.session_id)
Index("ix_exec_log_status", TaskExecutionLog.status)
Index("ix_exec_log_idempotency", TaskExecutionLog.idempotency_key)


# ─── pgvector Models ──────────────────────────────────────────────────────────
try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False

VectorType = Vector(384) if HAS_PGVECTOR and not os.environ.get("TESTING") else DB_JSON


class QueryEmbedding(Base):
    """Vector embeddings for user queries and research interactions."""
    __tablename__ = "query_embeddings"

    id = Column(String(100), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    query_id = Column(String(100), index=True, nullable=False)
    user_id = Column(String(100), index=True, nullable=True)
    text = Column(Text, nullable=False)
    query_metadata = Column("metadata", FlexibleJSONB, default=dict)
    embedding = Column(VectorType, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class PaperEmbedding(Base):
    """Vector embeddings for scientific papers and RAG retrieval."""
    __tablename__ = "paper_embeddings"

    id = Column(String(100), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String(100), index=True, nullable=False)
    collection_name = Column(String(100), default="research_queries", index=True)
    title = Column(Text, nullable=False)
    abstract = Column(Text, nullable=True)
    authors = Column(FlexibleJSONB, default=list)
    year = Column(Integer, nullable=True)
    citations = Column(Integer, default=0)
    embedding = Column(VectorType, nullable=True)
    created_at = Column(DateTime, default=utcnow)

