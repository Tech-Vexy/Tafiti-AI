"""Remove simulator, sandboxes, collaboration, bounties, and anchors features.

Drops the tables and columns that exclusively backed the removed
non-research features:

- bounties / bounty_submissions
- institutional_sandboxes / sandbox_members
- draft_anchors
- research_projects / project_members / project_activities (collaboration)
- notes.project_id, saved_queries.project_id, research_questions.project_id

Revision ID: f7c4a8d2e5b3
Revises: e6b3a9d4f1c2
Create Date: 2026-09-07

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f7c4a8d2e5b3'
down_revision = 'e6b3a9d4f1c2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop FK-coupled columns before dropping research_projects.
    op.drop_column('notes', 'project_id')
    op.drop_column('saved_queries', 'project_id')
    op.drop_column('research_questions', 'project_id')

    # Collaboration
    op.drop_table('project_activities')
    op.drop_table('project_members')
    op.drop_table('research_projects')

    # Micro-bounties
    op.drop_table('bounty_submissions')
    op.drop_table('bounties')

    # Institutional sandboxes
    op.drop_table('sandbox_members')
    op.drop_table('institutional_sandboxes')

    # Cryptographic anchoring
    op.drop_table('draft_anchors')


def downgrade() -> None:
    # Draft anchors
    op.create_table('draft_anchors',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('label', sa.String(length=200), nullable=True),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('external_anchor_ref', sa.String(length=500), nullable=True),
        sa.Column('anchored_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_draft_anchors_id'), 'draft_anchors', ['id'], unique=False)
    op.create_index(op.f('ix_draft_anchors_content_hash'), 'draft_anchors', ['content_hash'], unique=False)

    # Institutional sandboxes
    op.create_table('institutional_sandboxes',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('institution', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        sa.Column('admin_user_id', sa.String(length=50), nullable=False),
        sa.Column('invite_code', sa.String(length=20), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('event_start', sa.DateTime(), nullable=True),
        sa.Column('event_end', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['admin_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_institutional_sandboxes_id'), 'institutional_sandboxes', ['id'], unique=False)
    op.create_index(op.f('ix_institutional_sandboxes_invite_code'), 'institutional_sandboxes', ['invite_code'], unique=True)

    op.create_table('sandbox_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sandbox_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=True),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['sandbox_id'], ['institutional_sandboxes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sandbox_members_sandbox_user', 'sandbox_members', ['sandbox_id', 'user_id'], unique=True)
    op.create_index(op.f('ix_sandbox_members_id'), 'sandbox_members', ['id'], unique=False)

    # Micro-bounties
    op.create_table('bounties',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('creator_id', sa.String(length=50), nullable=False),
        sa.Column('paper_id', sa.String(length=100), nullable=True),
        sa.Column('paper_title', sa.String(length=500), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('amount_kes', sa.Integer(), nullable=True),
        sa.Column('reputation_points', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('paystack_reference', sa.String(length=100), nullable=True),
        sa.Column('funded', sa.Boolean(), nullable=True),
        sa.Column('awarded_to_user_id', sa.String(length=50), nullable=True),
        sa.Column('awarded_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['awarded_to_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_bounties_id'), 'bounties', ['id'], unique=False)
    op.create_index('ix_bounties_status_funded', 'bounties', ['status', 'funded'], unique=False)

    op.create_table('bounty_submissions',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('bounty_id', sa.String(length=50), nullable=False),
        sa.Column('submitter_id', sa.String(length=50), nullable=False),
        sa.Column('review_text', sa.Text(), nullable=False),
        sa.Column('is_winner', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['bounty_id'], ['bounties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submitter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_bounty_submissions_id'), 'bounty_submissions', ['id'], unique=False)
    op.create_index('ix_bounty_submissions_bounty_id', 'bounty_submissions', ['bounty_id'], unique=False)

    # Collaboration
    op.create_table('research_projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner_id', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_research_projects_id'), 'research_projects', ['id'], unique=False)

    op.create_table('project_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['research_projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_project_members_id'), 'project_members', ['id'], unique=False)

    op.create_table('project_activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=True),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['research_projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_project_activities_id'), 'project_activities', ['id'], unique=False)

    # Restore FK-backed columns
    op.add_column('notes', sa.Column('project_id', sa.Integer(), nullable=True))
    op.create_foreign_key('notes_project_id_fkey', 'notes', 'research_projects',
                          ['project_id'], ['id'], ondelete='SET NULL')
    op.add_column('saved_queries', sa.Column('project_id', sa.Integer(), nullable=True))
    op.create_foreign_key('saved_queries_project_id_fkey', 'saved_queries',
                          'research_projects', ['project_id'], ['id'], ondelete='SET NULL')
    op.add_column('research_questions', sa.Column('project_id', sa.Integer(), nullable=True))
    op.create_foreign_key('research_questions_project_id_fkey', 'research_questions',
                          'research_projects', ['project_id'], ['id'], ondelete='SET NULL')