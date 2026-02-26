from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(80), unique=True, index=True, nullable=True)
    email = Column(String(120), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True) # Optional with Neon Auth
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Academic Profile Fields
    bio = Column(Text, nullable=True)
    university = Column(String(200), nullable=True)
    expertise_areas = Column(JSONB, default=list) # List of strings
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
    saved_papers = relationship("SavedPaper", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    research_sessions = relationship("ResearchSession", back_populates="user", cascade="all, delete-orphan")
    search_history = relationship("SearchHistory", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("ResearchProject", back_populates="owner", cascade="all, delete-orphan")
    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
    
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


class SavedQuery(Base):
    __tablename__ = "saved_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    query = Column(Text, nullable=False)
    papers = Column(JSONB, nullable=False)
    answer = Column(Text, nullable=False)
    tags = Column(JSONB, default=list)
    is_favorite = Column(Boolean, default=False)
    vector_id = Column(String(100), nullable=True)
    project_id = Column(Integer, ForeignKey("research_projects.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="queries")
    project = relationship("ResearchProject", back_populates="queries")


class UserSettings(Base):
    __tablename__ = "user_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String(20), default="dark")
    default_paper_limit = Column(Integer, default=5)
    llm_provider = Column(String(20), default="groq")
    llm_model = Column(String(50), nullable=True)
    auto_export = Column(Boolean, default=False)
    export_format = Column(String(20), default="markdown")
    preferences = Column(JSON, default=dict)
    
    user = relationship("User", back_populates="settings")


class ResearchSession(Base):
    __tablename__ = "research_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    papers_count = Column(Integer, default=0)
    synthesis_length = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="research_sessions")


class SavedPaper(Base):
    __tablename__ = "saved_papers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id = Column(String(100), nullable=False) # OpenAlex ID
    title = Column(String(500), nullable=False)
    filters = Column(JSONB, default=dict) # Store search filters
    authors = Column(JSONB, default=list)
    year = Column(Integer)
    citations = Column(Integer)
    abstract = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="saved_papers")
    
class Note(Base):
    __tablename__ = "notes"
    
    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False, default="")
    tags = Column(JSON, default=list)
    project_id = Column(Integer, ForeignKey("research_projects.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="notes")
    project = relationship("ResearchProject", back_populates="notes")

class SearchHistory(Base):
    __tablename__ = "search_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    results_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="search_history")

class Connection(Base):
    __tablename__ = "connections"
    
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followed_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending") # pending, accepted, blocked
    created_at = Column(DateTime, default=datetime.utcnow)
    
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
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="notifications")

class ResearchProject(Base):
    __tablename__ = "research_projects"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    activities = relationship("ProjectActivity", back_populates="project", cascade="all, delete-orphan")
    queries = relationship("SavedQuery", back_populates="project")
    notes = relationship("Note", back_populates="project")

class ProjectMember(Base):
    __tablename__ = "project_members"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="member") # owner, editor, viewer
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("ResearchProject", back_populates="members")
    user = relationship("User", back_populates="memberships")

class ProjectActivity(Base):
    __tablename__ = "project_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    activity_type = Column(String(50), nullable=False) # query_added, note_created, member_joined
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("ResearchProject", back_populates="activities")


class TrialFeedback(Base):
    __tablename__ = "trial_feedback"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    favorite_feature = Column(String(50), nullable=True)
    improvement_text = Column(Text, nullable=True)
    would_recommend = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── ORCID Integration ────────────────────────────────────────────────────────

class OrcidProfile(Base):
    """Stores the linked ORCID ID and OAuth token for a user."""
    __tablename__ = "orcid_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    orcid_id = Column(String(30), unique=True, index=True, nullable=False)   # e.g. "0000-0002-1825-0097"
    access_token = Column(Text, nullable=True)    # ORCID OAuth access token
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="orcid_profile", uselist=False)


class OrcidPublication(Base):
    """Publications pulled from ORCID and synced to a user's profile."""
    __tablename__ = "orcid_publications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    put_code = Column(String(50), nullable=True)     # ORCID work put-code
    title = Column(String(500), nullable=False)
    doi = Column(String(200), nullable=True, index=True)
    publication_year = Column(Integer, nullable=True)
    journal = Column(String(300), nullable=True)
    work_type = Column(String(50), nullable=True)    # journal-article, conference-paper, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="orcid_publications")


# ─── Ghost Profiles ───────────────────────────────────────────────────────────

class GhostProfile(Base):
    """
    Auto-created unclaimed profiles for co-authors discovered via ORCID syncs.
    When the co-author signs up with their email, this profile is merged into a real User.
    """
    __tablename__ = "ghost_profiles"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    display_name = Column(String(200), nullable=False)
    email = Column(String(120), nullable=True, index=True)
    orcid_id = Column(String(30), nullable=True, index=True)
    affiliation = Column(String(300), nullable=True)
    # co-publication context — list of DOIs where this person appears as co-author
    co_publication_dois = Column(JSONB, default=list)
    # once claimed, points to the real user
    claimed_by_user_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    invite_sent_at = Column(DateTime, nullable=True)
    invite_token = Column(String(100), nullable=True, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    claimed_by = relationship("User", backref="claimed_ghost_profile", foreign_keys=[claimed_by_user_id])


# ─── Micro-Bounties ───────────────────────────────────────────────────────────

class Bounty(Base):
    """
    A financial or reputation bounty attached to a paper or research question,
    incentivising rapid peer review via Paystack.
    """
    __tablename__ = "bounties"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    creator_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # What is being bounty-hunted?
    paper_id = Column(String(100), nullable=True)       # OpenAlex / arXiv / etc. paper ID
    paper_title = Column(String(500), nullable=True)
    description = Column(Text, nullable=False)           # what kind of review is needed
    # Reward
    amount_kes = Column(Integer, default=0)              # KES amount (can be 0 = reputation only)
    reputation_points = Column(Integer, default=10)
    # Status
    status = Column(String(20), default="open")         # open, awarded, expired, cancelled
    # Paystack payment reference for the bounty fund
    paystack_reference = Column(String(100), nullable=True)
    funded = Column(Boolean, default=False)
    # Winner
    awarded_to_user_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    awarded_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[creator_id], backref="created_bounties")
    awarded_to = relationship("User", foreign_keys=[awarded_to_user_id], backref="won_bounties")
    submissions = relationship("BountySubmission", back_populates="bounty", cascade="all, delete-orphan")


class BountySubmission(Base):
    """A peer-review submission made against an open bounty."""
    __tablename__ = "bounty_submissions"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    bounty_id = Column(String(50), ForeignKey("bounties.id", ondelete="CASCADE"), nullable=False)
    submitter_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    review_text = Column(Text, nullable=False)
    is_winner = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    bounty = relationship("Bounty", back_populates="submissions")
    submitter = relationship("User", backref="bounty_submissions")


# ─── Institutional Sandboxes ──────────────────────────────────────────────────

class InstitutionalSandbox(Base):
    """
    A closed, branded workspace scoped to a university or event.
    All research sessions, notes, and projects inside are visible only to members.
    """
    __tablename__ = "institutional_sandboxes"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    institution = Column(String(300), nullable=False)   # e.g. "University of Nairobi"
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    # Access control
    admin_user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invite_code = Column(String(20), unique=True, index=True, nullable=False)  # share to join
    is_public = Column(Boolean, default=False)          # True = discoverable, False = invite-only
    # Optional event window
    event_start = Column(DateTime, nullable=True)
    event_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    admin = relationship("User", backref="administered_sandboxes", foreign_keys=[admin_user_id])
    members = relationship("SandboxMember", back_populates="sandbox", cascade="all, delete-orphan")


class SandboxMember(Base):
    """Membership record linking a User to an InstitutionalSandbox."""
    __tablename__ = "sandbox_members"

    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(String(50), ForeignKey("institutional_sandboxes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="participant")    # admin, mentor, participant
    joined_at = Column(DateTime, default=datetime.utcnow)

    sandbox = relationship("InstitutionalSandbox", back_populates="members")
    user = relationship("User", backref="sandbox_memberships")


# ─── Cryptographic Anchoring ──────────────────────────────────────────────────

class DraftAnchor(Base):
    """
    Stores a SHA-256 hash of a private research draft at a specific point in time.
    Provides proof of prior art without exposing content.
    """
    __tablename__ = "draft_anchors"

    id = Column(String(50), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Human-readable label (never revealed until the user chooses to disclose)
    label = Column(String(200), nullable=True)
    # The SHA-256 hex digest of the draft content
    content_hash = Column(String(64), nullable=False, index=True)
    # Optional: external notary confirmation URL / transaction ID
    external_anchor_ref = Column(String(500), nullable=True)
    anchored_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="draft_anchors")


# ─── File Uploads History ─────────────────────────────────────────────────────

class UploadedFile(Base):
    """Tracks every PDF a user uploads to Pinata IPFS."""
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    cid = Column(String(100), nullable=True)            # IPFS CID from Pinata
    file_size = Column(Integer, nullable=True)          # bytes
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="uploaded_files")
