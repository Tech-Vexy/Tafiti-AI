"""
Unified Model Router
====================
Abstracts LLM provider differences into a single interface.
Supports: OpenAI, Google Gemini, OpenRouter, Nvidia Build
Features: Fallback chain, multimodal, health checks.

Instead of hardcoding models everywhere, services call:
    result = await model_router.complete(messages=[...], task="synthesis")

The router picks the best available provider, handles retries,
and falls back to alternatives if one fails.
"""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Literal

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("model_router")


class TaskType(str, Enum):
    """Research task types with recommended provider preferences."""
    SYNTHESIS = "synthesis"        # Long-form generation → Gemini or Nvidia
    EXTRACTION = "extraction"     # Structured output → Nvidia (fast) or GPT-4
    CRITIQUE = "critique"         # Analysis → OpenRouter or Nvidia
    SEARCH_PLANNING = "search_planning"  # Planning → fast model
    CLAIM_EXTRACTION = "claim_extraction"  # Structured → Nvidia
    DEPTH_CALIBRATION = "depth_calibration"  # Quick decision → Nvidia
    MULTIMODAL = "multimodal"     # Image/PDF analysis → Gemini or GPT-4V
    CHAT = "chat"                 # Conversation → any provider


# Provider priority per task type (Research -> Gemini, Critique -> OpenRouter, Others -> Nvidia)
TASK_PROVIDER_PREFERENCES = {
    TaskType.SYNTHESIS: ["gemini", "nvidia", "openrouter"],
    TaskType.MULTIMODAL: ["gemini", "nvidia", "openrouter"],
    TaskType.CRITIQUE: ["openrouter", "nvidia", "gemini"],
    TaskType.EXTRACTION: ["nvidia", "gemini", "openrouter"],
    TaskType.SEARCH_PLANNING: ["nvidia", "openrouter", "gemini"],
    TaskType.CLAIM_EXTRACTION: ["nvidia", "openrouter", "gemini"],
    TaskType.DEPTH_CALIBRATION: ["nvidia", "openrouter", "gemini"],
    TaskType.CHAT: ["nvidia", "openrouter", "gemini"],
}

# Default models per provider
DEFAULT_MODELS = {
    "gemini": "deep-research-preview-04-2026",
    "nvidia": "deepseek-ai/deepseek-v4-flash-0731",
    "openrouter": "openrouter/free",
    "openai": "gpt-4o-mini",
}


@dataclass
class ProviderHealth:
    """Track provider health and availability."""
    name: str
    available: bool = True
    last_check: float = 0
    consecutive_failures: int = 0
    total_calls: int = 0
    total_errors: int = 0
    avg_latency_ms: float = 0
    _latencies: list = field(default_factory=list)

    def record_success(self, latency_ms: float):
        self.total_calls += 1
        self.consecutive_failures = 0
        self.available = True
        self._latencies.append(latency_ms)
        if len(self._latencies) > 100:
            self._latencies = self._latencies[-50:]
        self.avg_latency_ms = sum(self._latencies) / len(self._latencies)
        self.last_check = time.time()

    def record_failure(self):
        self.total_errors += 1
        self.consecutive_failures += 1
        self.last_check = time.time()
        if self.consecutive_failures >= 3:
            self.available = False
            logger.warning(f"provider_unavailable name={self.name} failures={self.consecutive_failures}")

    def reset_if_stale(self, cooldown_seconds: int = 300):
        """Reset availability after cooldown period."""
        if not self.available and (time.time() - self.last_check) > cooldown_seconds:
            self.available = True
            self.consecutive_failures = 0
            logger.info(f"provider_recovered name={self.name}")


class ModelRouter:
    """
    Unified interface for LLM calls across multiple providers.
    Handles provider selection, fallback, multimodal, and cost tracking.
    """

    def __init__(self):
        self.providers = {
            "gemini": ProviderHealth(name="gemini"),
            "openrouter": ProviderHealth(name="openrouter"),
            "nvidia": ProviderHealth(name="nvidia"),
            "openai": ProviderHealth(name="openai"),
        }
        self._api_key_map = {
            "gemini": lambda: settings.gemini_api_key,
            "openrouter": lambda: settings.OPENROUTER_API_KEY,
            "nvidia": lambda: settings.nvidia_api_key,
            "openai": lambda: settings.OPENAI_API_KEY,
        }

    def _has_provider(self, provider: str) -> bool:
        """Check if a provider has an API key configured."""
        key_fn = self._api_key_map.get(provider)
        return bool(key_fn and key_fn())

    def _get_available_provider(self, task_type: TaskType) -> str:
        """Select the best available provider for a task type."""
        prefs = TASK_PROVIDER_PREFERENCES.get(task_type, ["gemini", "nvidia", "openrouter"])

        # Try user's preferred provider first
        preferred = settings.DEFAULT_LLM_PROVIDER
        if preferred in prefs:
            prefs = [preferred] + [p for p in prefs if p != preferred]

        for provider in prefs:
            health = self.providers.get(provider)
            if health and health.available and self._has_provider(provider):
                health.reset_if_stale()
                return provider

        # Fallback to any available
        for provider, health in self.providers.items():
            if health.available and self._has_provider(provider):
                return provider

        # Last resort: use default even if unhealthy
        return settings.DEFAULT_LLM_PROVIDER

    def _get_model(self, provider: str, model: Optional[str] = None) -> str:
        """Get the model ID for a provider."""
        if model:
            return model

        # Check settings for provider-specific model
        provider_model_map = {
           
            "gemini": settings.GEMINI_DEFAULT_MODEL,
            "openrouter": settings.OPENROUTER_DEFAULT_MODEL,
            "nvidia": settings.NVIDIA_DEFAULT_MODEL,
        }
        return provider_model_map.get(provider, DEFAULT_MODELS.get(provider, "gemini-3.8-flash"))

    async def complete(
        self,
        messages: list,
        task_type: TaskType = TaskType.CHAT,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        response_format: Optional[dict] = None,
    ) -> dict:
        """
        Complete a chat request using the best available provider.

        Returns:
            {
                "content": str,
                "provider": str,
                "model": str,
                "input_tokens": int,
                "output_tokens": int,
                "latency_ms": float,
            }
        """
        provider = self._get_available_provider(task_type)
        model_id = self._get_model(provider, model)
        start = time.time()

        try:
            result = await self._call_provider(
                provider, model_id, messages, temperature, max_tokens, response_format
            )
            latency_ms = (time.time() - start) * 1000

            self.providers[provider].record_success(latency_ms)

            logger.info(
                f"llm_complete provider={provider} model={model_id} "
                f"task={task_type.value} latency_ms={latency_ms:.0f} "
                f"tokens={result.get('input_tokens', 0) + result.get('output_tokens', 0)}"
            )

            return {
                "content": result.get("content", ""),
                "provider": provider,
                "model": model_id,
                "input_tokens": result.get("input_tokens", 0),
                "output_tokens": result.get("output_tokens", 0),
                "image_tokens": result.get("image_tokens", 0),
                "latency_ms": latency_ms,
            }

        except Exception as e:
            latency_ms = (time.time() - start) * 1000
            self.providers[provider].record_failure()
            logger.error(f"llm_error provider={provider} model={model_id} error={e}")

            # Fallback: try next available provider
            fallback = self._get_fallback_provider(provider, task_type)
            if fallback:
                logger.info(f"llm_fallback from={provider} to={fallback}")
                return await self.complete(
                    messages, task_type, self._get_model(fallback), temperature, max_tokens, response_format
                )

            raise

    def _get_fallback_provider(self, failed_provider: str, task_type: TaskType) -> Optional[str]:
        """Get next available provider after a failure."""
        prefs = TASK_PROVIDER_PREFERENCES.get(task_type, ["gemini", "nvidia", "openrouter"])
        for provider in prefs:
            if provider != failed_provider and self._has_provider(provider):
                health = self.providers.get(provider)
                if health and health.available:
                    return provider
        return None

    async def _call_provider(
        self, provider: str, model: str, messages: list,
        temperature: float, max_tokens: int, response_format: Optional[dict]
    ) -> dict:
        """Route to provider-specific implementation."""
        
        if provider == "gemini":
            return await self._call_gemini(model, messages, temperature, max_tokens)
        elif provider == "openrouter":
            return await self._call_openrouter(model, messages, temperature, max_tokens, response_format)
        elif provider == "nvidia":
            return await self._call_nvidia(model, messages, temperature, max_tokens, response_format)
        elif provider == "openai":
            return await self._call_openai(model, messages, temperature, max_tokens, response_format)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    # ── OpenAI ────────────────────────────────────────────────────────────

    async def _call_openai(
        self, model: str, messages: list, temperature: float,
        max_tokens: int, response_format: Optional[dict] = None
    ) -> dict:
        from openai import AsyncOpenAI
        from openai.types.chat import ChatCompletion

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            kwargs["response_format"] = response_format

        resp = await client.chat.completions.create(**kwargs)
        if not isinstance(resp, ChatCompletion):
            raise RuntimeError(f"Expected ChatCompletion from OpenAI, got {type(resp).__name__}")

        input_tokens = resp.usage.prompt_tokens if resp.usage else 0
        output_tokens = resp.usage.completion_tokens if resp.usage else 0

        return {
            "content": resp.choices[0].message.content or "",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }

    # ── OpenRouter ────────────────────────────────────────────────────────

    async def _call_openrouter(
        self, model: str, messages: list, temperature: float,
        max_tokens: int, response_format: Optional[dict] = None
    ) -> dict:
        from openai import AsyncOpenAI
        from openai.types.chat import ChatCompletion

        client = AsyncOpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1",
        )
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            kwargs["response_format"] = response_format

        resp = await client.chat.completions.create(**kwargs)
        if not isinstance(resp, ChatCompletion):
            raise RuntimeError(f"Expected ChatCompletion from OpenRouter, got {type(resp).__name__}")

        input_tokens = resp.usage.prompt_tokens if resp.usage else 0
        output_tokens = resp.usage.completion_tokens if resp.usage else 0

        return {
            "content": resp.choices[0].message.content or "",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }

    # ── Google Gemini ─────────────────────────────────────────────────────

    async def _call_gemini(
        self, model: str, messages: list, temperature: float, max_tokens: int
    ) -> dict:
        """Call Gemini via the Interactions API using Agno's GeminiInteractions model."""
        from agno.agent import Agent
        from agno.models.google import GeminiInteractions

        # Extract primary prompt from messages
        system_instructions = []
        user_query = ""
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    p.get("text", "") if isinstance(p, dict) else str(p)
                    for p in content
                )
            if role == "system":
                system_instructions.append(content)
            elif role == "user":
                user_query = content

        combined_prompt = ""
        if system_instructions:
            combined_prompt += "\n\n".join(system_instructions) + "\n\n"
        combined_prompt += user_query if user_query else (messages[-1].get("content", "") if messages else "")

        # Determine agent ID based on model parameter (strictly deep-research models for Interactions API)
        agent_id = settings.GEMINI_DEEP_RESEARCH_AGENT
        if model and "max" in model.lower():
            agent_id = settings.GEMINI_DEEP_RESEARCH_MAX_AGENT
        elif model and "deep-research" in model.lower():
            agent_id = model
        else:
            agent_id = settings.GEMINI_DEEP_RESEARCH_AGENT

        thinking_summaries: Optional[Literal["auto", "none"]] = (
            "auto" if settings.GEMINI_DEEP_RESEARCH_THINKING_SUMMARIES == "auto" else "none"
        )
        visualization: Optional[Literal["auto", "off"]] = (
            "auto" if settings.GEMINI_DEEP_RESEARCH_VISUALIZATION == "auto" else "off"
        )

        interactions_model = GeminiInteractions(
            agent=agent_id,
            thinking_summaries=thinking_summaries,
            visualization=visualization,
            search=settings.GEMINI_DEEP_RESEARCH_SEARCH,
            url_context=settings.GEMINI_DEEP_RESEARCH_URL_CONTEXT,
        )

        agent = Agent(model=interactions_model, markdown=True)
        response = await agent.arun(combined_prompt)

        raw_content = getattr(response, "content", None)
        text: str = str(raw_content) if raw_content is not None else str(response or "")
        return {
            "content": text,
            "input_tokens": len(combined_prompt.split()),
            "output_tokens": len(text.split()),
        }

    def _convert_to_gemini_messages(self, messages: list) -> list:
        """Convert OpenAI-style messages to Gemini format, including multimodal content."""
        contents = []
        for msg in messages:
            role = "user" if msg.get("role") in ("user", "system") else "model"
            content = msg.get("content", "")

            if isinstance(content, list):
                # Multimodal content — already in Gemini-compatible format
                parts = []
                for part in content:
                    if isinstance(part, dict):
                        if part.get("type") == "image_url":
                            # Convert base64 image to Gemini inline_data
                            url = part.get("image_url", {}).get("url", "")
                            if url.startswith("data:"):
                                header, b64data = url.split(",", 1)
                                mime = header.split(":")[1].split(";")[0]
                                parts.append({"inline_data": {"mime_type": mime, "data": b64data}})
                            else:
                                parts.append({"file_data": {"mime_type": "image/jpeg", "file_uri": url}})
                        elif part.get("type") == "text":
                            parts.append(part.get("text", ""))
                        elif part.get("type") == "file":
                            # PDF or other file — pass as inline data
                            b64data = part.get("data", "")
                            mime = part.get("mime_type", "application/pdf")
                            parts.append({"inline_data": {"mime_type": mime, "data": b64data}})
                    else:
                        parts.append(str(part))
                contents.append({"role": role, "parts": parts})
            else:
                contents.append({"role": role, "parts": [str(content)]})
        return contents


    # ── Nvidia NIM (via OpenAI-compatible integrate.api.nvidia.com) ─────────

    async def _call_nvidia(
        self, model: str, messages: list, temperature: float,
        max_tokens: int, response_format: Optional[dict] = None
    ) -> dict:
        from openai import AsyncOpenAI
        from openai.types.chat import ChatCompletion

        api_key = settings.nvidia_api_key
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=settings.NVIDIA_BASE_URL,
        )

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens or 16384,
        }

        # DeepSeek and reasoning models support chat_template_kwargs
        if "deepseek" in model.lower():
            kwargs["extra_body"] = {
                "chat_template_kwargs": {
                    "thinking": True,
                    "reasoning_effort": "high",
                }
            }
        elif "kimi" in model.lower():
            kwargs["reasoning_effort"] = "max"

        if response_format:
            kwargs["response_format"] = response_format

        resp = await client.chat.completions.create(**kwargs)
        if not isinstance(resp, ChatCompletion):
            raise RuntimeError(f"Expected ChatCompletion from NVIDIA NIM, got {type(resp).__name__}")

        choice = resp.choices[0]
        content = choice.message.content or ""
        reasoning = (
            getattr(choice.message, "reasoning", None) or
            getattr(choice.message, "reasoning_content", None)
        )

        input_tokens = resp.usage.prompt_tokens if resp.usage else 0
        output_tokens = resp.usage.completion_tokens if resp.usage else 0

        return {
            "content": content,
            "reasoning": reasoning,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }

    # ── Multimodal Helpers ────────────────────────────────────────────────

    @staticmethod
    def image_to_messages(
        image_base64: str, mime_type: str = "image/png",
        prompt: str = "Analyze this image.",
        model_hint: Optional[str] = None,
    ) -> list:
        """Create a multimodal message list for image analysis."""
        return [
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}},
                {"type": "text", "text": prompt},
            ]},
        ]

    @staticmethod
    def pdf_to_messages(
        pdf_base64: str, prompt: str = "Analyze this PDF document.",
    ) -> list:
        """Create a multimodal message list for PDF analysis (Gemini preferred)."""
        return [
            {"role": "user", "content": [
                {"type": "file", "mime_type": "application/pdf", "data": pdf_base64},
                {"type": "text", "text": prompt},
            ]},
        ]

    @staticmethod
    def table_to_messages(
        table_text: str, prompt: str = "Analyze this data table.",
    ) -> list:
        """Create a message for table analysis."""
        return [
            {"role": "user", "content": f"{prompt}\n\n```\n{table_text}\n```"},
        ]

    # ── Health & Status ───────────────────────────────────────────────────

    def get_health_status(self) -> dict:
        """Get health status of all providers."""
        status = {}
        for name, health in self.providers.items():
            status[name] = {
                "available": health.available,
                "has_key": self._has_provider(name),
                "total_calls": health.total_calls,
                "total_errors": health.total_errors,
                "avg_latency_ms": round(health.avg_latency_ms, 1),
                "consecutive_failures": health.consecutive_failures,
            }
        return status


# ── Singleton ──────────────────────────────────────────────────────────
model_router = ModelRouter()

