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
