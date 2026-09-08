"""dynamic agent teams

Revision ID: b3f7a921c45d
Revises: 6ad3a855090b
Create Date: 2026-09-02 00:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models.database import FlexibleJSONB

revision: str = 'b3f7a921c45d'
down_revision: Union[str, None] = 'a1c2e3f4b5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # agent_teams
    op.create_table('agent_teams',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('question_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('team_plan', FlexibleJSONB(), nullable=True),
        sa.Column('shared_context', sa.Text(), nullable=True),
        sa.Column('max_agents', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['research_questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ateam_question_id', 'agent_teams', ['question_id'], unique=False)
    op.create_index('ix_ateam_status', 'agent_teams', ['status'], unique=False)
    op.create_index(op.f('ix_agent_teams_id'), 'agent_teams', ['id'], unique=False)

    # agents
    op.create_table('agents',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('team_id', sa.String(length=50), nullable=False),
        sa.Column('parent_agent_id', sa.String(length=50), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('agent_model', sa.String(length=100), nullable=True),
        sa.Column('capabilities', FlexibleJSONB(), nullable=True),
        sa.Column('current_task_id', sa.String(length=50), nullable=True),
        sa.Column('tasks_completed', sa.Integer(), nullable=True),
        sa.Column('tasks_failed', sa.Integer(), nullable=True),
        sa.Column('output_summary', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('spawned_at', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('retired_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['agent_teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_agent_id'], ['agents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['current_task_id'], ['research_tasks.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_agent_team_id', 'agents', ['team_id'], unique=False)
    op.create_index('ix_agent_parent_id', 'agents', ['parent_agent_id'], unique=False)
    op.create_index('ix_agent_status', 'agents', ['status'], unique=False)
    op.create_index('ix_agent_role', 'agents', ['role'], unique=False)
    op.create_index(op.f('ix_agents_id'), 'agents', ['id'], unique=False)

    # agent_messages
    op.create_table('agent_messages',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('team_id', sa.String(length=50), nullable=False),
        sa.Column('sender_agent_id', sa.String(length=50), nullable=True),
        sa.Column('receiver_agent_id', sa.String(length=50), nullable=True),
        sa.Column('message_type', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata', FlexibleJSONB(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['agent_teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['receiver_agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_amsg_team_id', 'agent_messages', ['team_id'], unique=False)
    op.create_index('ix_amsg_sender', 'agent_messages', ['sender_agent_id'], unique=False)
    op.create_index('ix_amsg_receiver', 'agent_messages', ['receiver_agent_id'], unique=False)
    op.create_index('ix_amsg_type', 'agent_messages', ['message_type'], unique=False)
    op.create_index(op.f('ix_agent_messages_id'), 'agent_messages', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_agent_messages_id'), table_name='agent_messages')
    op.drop_index('ix_amsg_type', table_name='agent_messages')
    op.drop_index('ix_amsg_receiver', table_name='agent_messages')
    op.drop_index('ix_amsg_sender', table_name='agent_messages')
    op.drop_index('ix_amsg_team_id', table_name='agent_messages')
    op.drop_table('agent_messages')

    op.drop_index(op.f('ix_agents_id'), table_name='agents')
    op.drop_index('ix_agent_role', table_name='agents')
    op.drop_index('ix_agent_status', table_name='agents')
    op.drop_index('ix_agent_parent_id', table_name='agents')
    op.drop_index('ix_agent_team_id', table_name='agents')
    op.drop_table('agents')

    op.drop_index(op.f('ix_agent_teams_id'), table_name='agent_teams')
    op.drop_index('ix_ateam_status', table_name='agent_teams')
    op.drop_index('ix_ateam_question_id', table_name='agent_teams')
    op.drop_table('agent_teams')
