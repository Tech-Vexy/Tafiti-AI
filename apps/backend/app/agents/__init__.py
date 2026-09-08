"""
Agno 2.x Agent Infrastructure
==============================
Multi-agent research platform built on Agno 2.8.x SDK.

Primitives:
- Agent: Core unit with model, tools, memory, knowledge
- Team: Supervisor mode with dynamic delegation
- Workflow: Sequential/parallel/conditional research pipeline
- Memory: User + agent level persistence via Supabase
- Knowledge: RAG with Qdrant vector database

Architecture:
    User → Research Team (Supervisor) → Agents → Workflow → Knowledge/Memory
"""

from app.agents.research_agent import get_research_agent
from app.agents.critic_agent import get_drafter, get_critic, validated_synthesis
from app.agents.validation_agent import get_validation_agent
from app.agents.research_team import get_research_team, research_team_run

__all__ = [
    "get_research_agent",

    "get_drafter",
    "get_critic",
    "validated_synthesis",
    "get_validation_agent",
    "get_research_team",
    "research_team_run",
]
