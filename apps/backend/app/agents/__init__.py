"""
Tafiti AI Research Agents
=========================
- DeepResearchAgent: Single production autonomous deep research agent built on Agno
  and Gemini Interactions API (deep-research-preview-04-2026) for initial literature research.
- ResearchAgent: Interactive follow-up agent maintaining conversation history,
  plus analytical gap analysis and paper impact evaluation.
"""

from app.agents.deep_research_agent import DeepResearchAgent, get_deep_research_agent
from app.agents.research_agent import ResearchAgent, get_research_agent

__all__ = [
    "DeepResearchAgent",
    "get_deep_research_agent",
    "ResearchAgent",
    "get_research_agent",
]
