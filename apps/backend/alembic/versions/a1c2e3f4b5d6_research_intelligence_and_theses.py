"""research intelligence, theses, and embeddings

Revision ID: a1c2e3f4b5d6
Revises: 6ad3a855090b
Create Date: 2026-09-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models.database import FlexibleJSONB

try:
    from pgvector.sqlalchemy import Vector
    VectorType = Vector(384)
except ImportError:
    VectorType = FlexibleJSONB

revision: str = 'a1c2e3f4b5d6'
down_revision: Union[str, None] = '6ad3a855090b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Ensure pgvector extension if available ──
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # ── research_questions ──
    op.create_table(
        'research_questions',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['research_projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_questions_id'), 'research_questions', ['id'], unique=False)
    op.create_index('ix_rql_user_id', 'research_questions', ['user_id'], unique=False)

    # ── research_tasks ──
    op.create_table(
        'research_tasks',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('question_id', sa.String(length=50), nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=True),
        sa.Column('depends_on', FlexibleJSONB(), nullable=True),
        sa.Column('result_summary', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('agent_model', sa.String(length=100), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['research_questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_tasks_id'), 'research_tasks', ['id'], unique=False)
    op.create_index('ix_rtask_question_id', 'research_tasks', ['question_id'], unique=False)
    op.create_index('ix_rtask_status', 'research_tasks', ['status'], unique=False)

    # ── research_sources ──
    op.create_table(
        'research_sources',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('task_id', sa.String(length=50), nullable=False),
        sa.Column('external_id', sa.String(length=200), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('authors', FlexibleJSONB(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('journal', sa.String(length=300), nullable=True),
        sa.Column('doi', sa.String(length=200), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('abstract', sa.Text(), nullable=True),
        sa.Column('citation_count', sa.Integer(), nullable=True),
        sa.Column('relevance_score', sa.Integer(), server_default='0', nullable=True),
        sa.Column('metadata', FlexibleJSONB(), nullable=True),
        sa.Column('discovered_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['research_tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_sources_id'), 'research_sources', ['id'], unique=False)
    op.create_index(op.f('ix_research_sources_external_id'), 'research_sources', ['external_id'], unique=False)
    op.create_index(op.f('ix_research_sources_doi'), 'research_sources', ['doi'], unique=False)
    op.create_index('ix_rsource_task_id', 'research_sources', ['task_id'], unique=False)
    op.create_index('ix_rsource_doi', 'research_sources', ['doi'], unique=False)

    # ── research_passages ──
    op.create_table(
        'research_passages',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('source_id', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('section', sa.String(length=200), nullable=True),
        sa.Column('position', sa.Integer(), server_default='0', nullable=True),
        sa.Column('embedding_id', sa.String(length=100), nullable=True),
        sa.Column('extracted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['source_id'], ['research_sources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_passages_id'), 'research_passages', ['id'], unique=False)
    op.create_index('ix_rpassage_source_id', 'research_passages', ['source_id'], unique=False)

    # ── research_claims ──
    op.create_table(
        'research_claims',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('question_id', sa.String(length=50), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('claim_type', sa.String(length=50), server_default='finding', nullable=True),
        sa.Column('confidence', sa.Integer(), server_default='50', nullable=True),
        sa.Column('supporting_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('contradicting_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('verification_status', sa.String(length=20), server_default='unverified', nullable=True),
        sa.Column('parent_claim_id', sa.String(length=50), nullable=True),
        sa.Column('reviewed_by_user', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('user_verdict', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['parent_claim_id'], ['research_claims.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['question_id'], ['research_questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_claims_id'), 'research_claims', ['id'], unique=False)
    op.create_index('ix_rclaim_question_id', 'research_claims', ['question_id'], unique=False)
    op.create_index('ix_rclaim_parent_id', 'research_claims', ['parent_claim_id'], unique=False)
    op.create_index('ix_rclaim_verification', 'research_claims', ['verification_status'], unique=False)

    # ── research_evidence ──
    op.create_table(
        'research_evidence',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('passage_id', sa.String(length=50), nullable=False),
        sa.Column('claim_id', sa.String(length=50), nullable=True),
        sa.Column('relation', sa.String(length=20), nullable=False),
        sa.Column('confidence', sa.Integer(), server_default='80', nullable=True),
        sa.Column('extracted_by', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('extracted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['claim_id'], ['research_claims.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['passage_id'], ['research_passages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_evidence_id'), 'research_evidence', ['id'], unique=False)
    op.create_index('ix_revidence_passage_id', 'research_evidence', ['passage_id'], unique=False)
    op.create_index('ix_revidence_claim_id', 'research_evidence', ['claim_id'], unique=False)

    # ── theses ──
    op.create_table(
        'theses',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=500), server_default='Untitled Thesis', nullable=False),
        sa.Column('content', sa.Text(), server_default='{}', nullable=False),
        sa.Column('plain_text', sa.Text(), nullable=True),
        sa.Column('word_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('page_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('format_version', sa.String(length=20), server_default='25', nullable=True),
        sa.Column('status', sa.String(length=30), server_default='draft', nullable=True),
        sa.Column('last_auto_save_at', sa.DateTime(), nullable=True),
        sa.Column('yjs_state', sa.LargeBinary(), nullable=True),
        sa.Column('yjs_state_vector', sa.LargeBinary(), nullable=True),
        sa.Column('version_history', FlexibleJSONB(), nullable=True),
        sa.Column('question_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['research_questions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_theses_id'), 'theses', ['id'], unique=False)
    op.create_index('ix_theses_user_id', 'theses', ['user_id'], unique=False)
    op.create_index('ix_theses_status', 'theses', ['user_id', 'status'], unique=False)

    # ── query_embeddings ──
    op.create_table(
        'query_embeddings',
        sa.Column('id', sa.String(length=100), nullable=False),
        sa.Column('query_id', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.String(length=100), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('metadata', FlexibleJSONB(), nullable=True),
        sa.Column('embedding', VectorType, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_query_embeddings_id'), 'query_embeddings', ['id'], unique=False)
    op.create_index(op.f('ix_query_embeddings_query_id'), 'query_embeddings', ['query_id'], unique=False)
    op.create_index(op.f('ix_query_embeddings_user_id'), 'query_embeddings', ['user_id'], unique=False)

    # ── paper_embeddings ──
    op.create_table(
        'paper_embeddings',
        sa.Column('id', sa.String(length=100), nullable=False),
        sa.Column('paper_id', sa.String(length=100), nullable=False),
        sa.Column('collection_name', sa.String(length=100), server_default='research_queries', nullable=True),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('abstract', sa.Text(), nullable=True),
        sa.Column('authors', FlexibleJSONB(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('citations', sa.Integer(), server_default='0', nullable=True),
        sa.Column('embedding', VectorType, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_paper_embeddings_id'), 'paper_embeddings', ['id'], unique=False)
    op.create_index(op.f('ix_paper_embeddings_paper_id'), 'paper_embeddings', ['paper_id'], unique=False)
    op.create_index(op.f('ix_paper_embeddings_collection_name'), 'paper_embeddings', ['collection_name'], unique=False)


def downgrade() -> None:
    op.drop_table('paper_embeddings')
    op.drop_table('query_embeddings')
    op.drop_table('theses')
    op.drop_table('research_evidence')
    op.drop_table('research_claims')
    op.drop_table('research_passages')
    op.drop_table('research_sources')
    op.drop_table('research_tasks')
    op.drop_table('research_questions')
