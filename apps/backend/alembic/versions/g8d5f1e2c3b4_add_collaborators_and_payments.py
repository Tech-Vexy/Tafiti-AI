"""Add thesis collaborator and payment transaction records.

Revision ID: g8d5f1e2c3b4
Revises: f7c4a8d2e5b3
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "g8d5f1e2c3b4"
down_revision = "f7c4a8d2e5b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "thesis_collaborators",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("thesis_id", sa.String(50), sa.ForeignKey("theses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(50), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="editor"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("thesis_id", "user_id", name="uq_thesis_collaborator"),
    )
    op.create_index("ix_thesis_collaborators_id", "thesis_collaborators", ["id"])
    op.create_index("ix_thesis_collaborators_thesis_id", "thesis_collaborators", ["thesis_id"])
    op.create_index("ix_thesis_collaborators_user_id", "thesis_collaborators", ["user_id"])

    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(50), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference", sa.String(100), nullable=False, unique=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="initialized"),
        sa.Column("webhook_event", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_payment_transactions_id", "payment_transactions", ["id"])
    op.create_index("ix_payment_transactions_reference", "payment_transactions", ["reference"])


def downgrade() -> None:
    op.drop_table("payment_transactions")
    op.drop_table("thesis_collaborators")
