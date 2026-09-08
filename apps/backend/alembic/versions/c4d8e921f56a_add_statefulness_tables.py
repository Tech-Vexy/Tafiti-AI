"""Add statefulness tables: audit_log, agent_memory, checkpoints, task_schedules

Revision ID: c4d8e921f56a
Revises: b3f7a921c45d
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c4d8e921f56a"
down_revision = "b3f7a921c45d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── research_audit_log ──
    op.create_table(
        "research_audit_log",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("question_id", sa.String(50), sa.ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=True),
        sa.Column("task_id", sa.String(50), sa.ForeignKey("research_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("team_id", sa.String(50), sa.ForeignKey("agent_teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("agent_id", sa.String(50), sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.String(50), nullable=False),
        sa.Column("from_status", sa.String(30), nullable=True),
        sa.Column("to_status", sa.String(30), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("actor", sa.String(100), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_log_question", "research_audit_log", ["question_id"])
    op.create_index("ix_audit_log_entity", "research_audit_log", ["entity_type", "entity_id"])
    op.create_index("ix_audit_log_created", "research_audit_log", ["created_at"])

    # ── agent_memory ──
    op.create_table(
        "agent_memory",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("agent_id", sa.String(50), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("memory_type", sa.String(30), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Integer(), server_default="80"),
        sa.Column("access_count", sa.Integer(), server_default="0"),
        sa.Column("source_task_id", sa.String(50), sa.ForeignKey("research_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_claim_id", sa.String(50), sa.ForeignKey("research_claims.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_agent_memory_agent_id", "agent_memory", ["agent_id"])
    op.create_index("ix_agent_memory_type", "agent_memory", ["memory_type"])

    # ── research_checkpoints ──
    op.create_table(
        "research_checkpoints",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("question_id", sa.String(50), sa.ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", sa.String(50), sa.ForeignKey("agent_teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("trigger", sa.String(50), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("task_count", sa.Integer(), server_default="0"),
        sa.Column("source_count", sa.Integer(), server_default="0"),
        sa.Column("claim_count", sa.Integer(), server_default="0"),
        sa.Column("agent_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_checkpoint_question_id", "research_checkpoints", ["question_id"])

    # ── research_task_schedules ──
    op.create_table(
        "research_task_schedules",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("question_id", sa.String(50), sa.ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.String(50), sa.ForeignKey("research_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_ready", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_blocked", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("blocked_by", postgresql.JSONB(), server_default="[]"),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("max_retries", sa.Integer(), server_default="3"),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("timeout_seconds", sa.Integer(), server_default="300"),
    )
    op.create_index("ix_task_schedule_question", "research_task_schedules", ["question_id"])
    op.create_index("ix_task_schedule_ready", "research_task_schedules", ["question_id", "is_ready"])
    op.create_index("ix_task_schedule_task", "research_task_schedules", ["task_id"])


def downgrade() -> None:
    op.drop_table("research_task_schedules")
    op.drop_table("research_checkpoints")
    op.drop_table("agent_memory")
    op.drop_table("research_audit_log")
