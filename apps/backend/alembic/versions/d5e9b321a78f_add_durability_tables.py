"""Add durability tables: session_states, task_execution_logs

Revision ID: d5e9b321a78f
Revises: c4d8e921f56a
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d5e9b321a78f"
down_revision = "c4d8e921f56a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── research_session_states ──
    op.create_table(
        "research_session_states",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("question_id", sa.String(50), sa.ForeignKey("research_questions.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("status", sa.String(20), server_default="idle"),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("paused_at", sa.DateTime(), nullable=True),
        sa.Column("total_tasks", sa.Integer(), server_default="0"),
        sa.Column("completed_tasks", sa.Integer(), server_default="0"),
        sa.Column("failed_tasks", sa.Integer(), server_default="0"),
        sa.Column("batches_run", sa.Integer(), server_default="0"),
        sa.Column("current_batch", postgresql.JSONB(), server_default="[]"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("max_retries", sa.Integer(), server_default="3"),
        sa.Column("heartbeat_at", sa.DateTime(), nullable=True),
        sa.Column("heartbeat_interval", sa.Integer(), server_default="30"),
        sa.Column("last_checkpoint_id", sa.String(50), sa.ForeignKey("research_checkpoints.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_session_state_question", "research_session_states", ["question_id"])
    op.create_index("ix_session_state_status", "research_session_states", ["status"])
    op.create_index("ix_session_state_heartbeat", "research_session_states", ["heartbeat_at"])

    # ── task_execution_logs ──
    op.create_table(
        "task_execution_logs",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("task_id", sa.String(50), sa.ForeignKey("research_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.String(50), sa.ForeignKey("research_session_states.id", ondelete="SET NULL"), nullable=True),
        sa.Column("agent_id", sa.String(50), sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), server_default="planned"),
        sa.Column("planned_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(100), nullable=True),
        sa.Column("attempt_number", sa.Integer(), server_default="1"),
        sa.Column("timeout_seconds", sa.Integer(), server_default="300"),
        sa.Column("timeout_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_exec_log_task_id", "task_execution_logs", ["task_id"])
    op.create_index("ix_exec_log_session_id", "task_execution_logs", ["session_id"])
    op.create_index("ix_exec_log_status", "task_execution_logs", ["status"])
    op.create_index("ix_exec_log_idempotency", "task_execution_logs", ["idempotency_key"])


def downgrade() -> None:
    op.drop_table("task_execution_logs")
    op.drop_table("research_session_states")
