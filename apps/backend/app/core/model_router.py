"""
Unified Model Router
====================
Abstracts LLM provider differences into a single interface.
Supports: Groq, OpenAI, Anthropic, Google Gemini, OpenRouter, Nvidia Build
Features: Fallback chain, multimodal, cost tracking, health checks.

Instead of hardcoding Groq everywhere, services call:
    result = await model_router.complete(messages=[...], task="synthesis")

The router picks the best available provider, handles retries,
and falls back to alternatives if one fails.
"""

import time
import json
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("model_router")


class TaskType(str, Enum):
    """Research task types with recommended provider preferences."""
    SYNTHESIS = "synthesis"        # Long-form generation → Gemini or GPT-4
    EXTRACTION = "extraction"     # Structured output → Groq (fast) or GPT-4
    CRITIQUE = "critique"         # Analysis → Groq or Claude
    SEARCH_PLANNING = "search_planning"  # Planning → fast model
    CLAIM_EXTRACTION = "claim_extraction"  # Structured → Groq
    DEPTH_CALIBRATION = "depth_calibration"  # Quick decision → Groq
    MULTIMODAL = "multimodal"     # Image/PDF analysis → Gemini or GPT-4V
    CHAT = "chat"                 # Conversation → any provider


# Provider priority per task type (Research -> Gemini, Critique -> OpenRouter, Others -> Nvidia)
TASK_PROVIDER_PREFERENCES = {
    TaskType.SYNTHESIS: ["gemini", "nvidia", "openrouter"],
    TaskType.MULTIMODAL: ["gemini", "nvidia", "openrouter"],
    TaskType.CRITIQUE: ["openrouter", "nvidia", "gemini"],
    TaskType.EXTRACTION: ["nvidia", "gemini", "openrouter"],
    TaskType.SEARCH_PLANNING: ["nvidia", "gemini", "openrouter"],
    TaskType.CLAIM_EXTRACTION: ["nvidia", "gemini", "openrouter"],
    TaskType.DEPTH_CALIBRATION: ["nvidia", "gemini", "openrouter"],
    TaskType.CHAT: ["nvidia", "gemini", "openrouter"],
}

# Default models per provider
DEFAULT_MODELS = {
    "gemini": "gemini-3.5-pro",
    "nvidia": "deepseek-ai/deepseek-v4-flash-0731",
    "openrouter": "openrouter/free",
    "groq": "llama3-70b-8192",
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-20241022",
}

# Approximate cost per 1M tokens (USD) — for tracking
COST_PER_1M_TOKENS = {
    "gemini:gemini-3.1": 0.10,
    "gemini:gemini-3.5": 0.50,
    "gemini:gemini-3.5-flash": 0.10,
    "gemini:gemini-3.5-pro": 1.25,
    "gemini:gemini-3.6": 1.50,
    "gemini:gemini-3.8": 2.00,
    "nvidia:deepseek-ai/deepseek-v4-flash-0731": 0.15,
    "nvidia:deepseek-ai/deepseek-v4-pro-0813": 0.60,
    "nvidia:moonshotai/kimi-k3": 0.30,
    "nvidia:poolside/laguna-xs-2.1": 0.10,
    "openrouter:openrouter/free": 0.0,
    "openrouter:google/gemma-4-31b-it:free": 0.0,
    "openrouter:google/gemma-4-26b-a4b-it:free": 0.0,
    "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free": 0.0,
    "openrouter:nvidia/nemotron-3.5-lightning:free": 0.0,
    "openrouter:minimax/minimax-m3:free": 0.0,
    "openrouter:meta-llama/llama-3.3-70b-instruct:free": 0.0,
    "openrouter:meta-llama/llama-3.1-8b-instruct:free": 0.0,
    "openrouter:qwen/qwen-2.5-72b-instruct": 0.50,
    "nvidia:nvidia/llama-3.1-nemotron-70b-instruct": 0.80,
    "nvidia:nvidia/llama-3.1-8b-instruct": 0.10,
    "nvidia:meta/llama-3.1-405b-instruct": 2.70,
    "groq:llama3-70b-8192": 0.59,
    "groq:llama-3.3-70b-versatile": 0.59,
    "openai:gpt-4o": 2.50,
    "openai:gpt-4o-mini": 0.15,
    "anthropic:claude-3-5-sonnet-20241022": 3.00,
    "anthropic:claude-3-haiku-20240307": 0.25,
}

# Cost per 1M image tokens (Gemini charges differently for images)
IMAGE_COST_PER_1M_TOKENS = {
    "gemini:gemini-3.5-flash": 0.10,
    "gemini:gemini-3.5-pro": 1.25,
    "gemini:gemini-3.6": 1.50,
    "gemini:gemini-3.8": 2.00,
    "openai:gpt-4o": 10.00,
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
    total_cost_usd: float = 0
    _latencies: list = field(default_factory=list)

    def record_success(self, latency_ms: float, cost: float = 0):
        self.total_calls += 1
        self.consecutive_failures = 0
        self.available = True
        self._latencies.append(latency_ms)
        if len(self._latencies) > 100:
            self._latencies = self._latencies[-50:]
        self.avg_latency_ms = sum(self._latencies) / len(self._latencies)
        self.total_cost_usd += cost
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
            "groq": ProviderHealth(name="groq"),
            "openai": ProviderHealth(name="openai"),
            "gemini": ProviderHealth(name="gemini"),
            "anthropic": ProviderHealth(name="anthropic"),
            "openrouter": ProviderHealth(name="openrouter"),
            "nvidia": ProviderHealth(name="nvidia"),
        }
        self._api_key_map = {
            "groq": lambda: settings.GROQ_API_KEY,
            "openai": lambda: settings.OPENAI_API_KEY,
            "gemini": lambda: settings.gemini_api_key,
            "anthropic": lambda: settings.ANTHROPIC_API_KEY,
            "openrouter": lambda: settings.OPENROUTER_API_KEY,
            "nvidia": lambda: settings.nvidia_api_key,
        }

    def _has_provider(self, provider: str) -> bool:
        """Check if a provider has an API key configured."""
        key_fn = self._api_key_map.get(provider)
        return bool(key_fn and key_fn())

    def _get_available_provider(self, task_type: TaskType) -> str:
        """Select the best available provider for a task type."""
        prefs = TASK_PROVIDER_PREFERENCES.get(task_type, ["groq", "openai", "gemini"])

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
            "groq": settings.DEFAULT_LLM_MODEL,
            "openai": "gpt-4o",
            "gemini": settings.GEMINI_DEFAULT_MODEL,
            "anthropic": "claude-3-5-sonnet-20241022",
            "openrouter": settings.OPENROUTER_DEFAULT_MODEL,
            "nvidia": settings.NVIDIA_DEFAULT_MODEL,
        }
        return provider_model_map.get(provider, DEFAULT_MODELS.get(provider, "gpt-4o"))

    def _calculate_cost(self, provider: str, model: str, input_tokens: int, output_tokens: int, image_tokens: int = 0) -> float:
        """Calculate approximate cost for a request."""
        key = f"{provider}:{model}"
        text_cost_per_1m = COST_PER_1M_TOKENS.get(key, 1.0)
        text_cost = ((input_tokens + output_tokens) / 1_000_000) * text_cost_per_1m

        image_cost = 0
        if image_tokens > 0:
            img_cost_per_1m = IMAGE_COST_PER_1M_TOKENS.get(key, 5.0)
            image_cost = (image_tokens / 1_000_000) * img_cost_per_1m

        return text_cost + image_cost

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
                "cost_usd": float,
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

            # Track cost
            cost = self._calculate_cost(
                provider, model_id,
                result.get("input_tokens", 0), result.get("output_tokens", 0),
                result.get("image_tokens", 0),
            )
            self.providers[provider].record_success(latency_ms, cost)

            logger.info(
                f"llm_complete provider={provider} model={model_id} "
                f"task={task_type.value} latency_ms={latency_ms:.0f} "
                f"cost=${cost:.4f} tokens={result.get('input_tokens', 0) + result.get('output_tokens', 0)}"
            )

            return {
                "content": result.get("content", ""),
                "provider": provider,
                "model": model_id,
                "input_tokens": result.get("input_tokens", 0),
                "output_tokens": result.get("output_tokens", 0),
                "image_tokens": result.get("image_tokens", 0),
                "cost_usd": cost,
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
        prefs = TASK_PROVIDER_PREFERENCES.get(task_type, ["groq", "openai", "gemini"])
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
        if provider == "groq":
            return await self._call_groq(model, messages, temperature, max_tokens, response_format)
        elif provider == "openai":
            return await self._call_openai(model, messages, temperature, max_tokens, response_format)
        elif provider == "gemini":
            return await self._call_gemini(model, messages, temperature, max_tokens)
        elif provider == "anthropic":
            return await self._call_anthropic(model, messages, temperature, max_tokens)
        elif provider == "openrouter":
            return await self._call_openrouter(model, messages, temperature, max_tokens, response_format)
        elif provider == "nvidia":
            return await self._call_nvidia(model, messages, temperature, max_tokens, response_format)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    # ── Groq (via OpenAI-compatible SDK) ──────────────────────────────────

    async def _call_groq(
        self, model: str, messages: list, temperature: float,
        max_tokens: int, response_format: Optional[dict]
    ) -> dict:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        kwargs = dict(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens)
        if response_format:
            kwargs["response_format"] = response_format

        resp = await client.chat.completions.create(**kwargs)
        usage = resp.usage or type("u", (), {"prompt_tokens": 0, "completion_tokens": 0})()

        return {
            "content": resp.choices[0].message.content or "",
            "input_tokens": usage.prompt_tokens,
            "output_tokens": usage.completion_tokens,
        }

    # ── OpenAI ────────────────────────────────────────────────────────────

    async def _call_openai(
        self, model: str, messages: list, temperature: float,
        max_tokens: int, response_format: Optional[dict]
    ) -> dict:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        kwargs = dict(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens)
        if response_format:
            kwargs["response_format"] = response_format

        resp = await client.chat.completions.create(**kwargs)
        usage = resp.usage or type("u", (), {"prompt_tokens": 0, "completion_tokens": 0})()

        return {
            "content": resp.choices[0].message.content or "",
            "input_tokens": usage.prompt_tokens,
            "output_tokens": usage.completion_tokens,
        }

    # ── Google Gemini ─────────────────────────────────────────────────────

    async def _call_gemini(
        self, model: str, messages: list, temperature: float, max_tokens: int
    ) -> dict:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)

        # Convert OpenAI-style messages to Gemini format
        contents = self._convert_to_gemini_messages(messages)

        response = await client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )

        text = response.text or ""
        # Gemini reports usage differently
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
            output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

        return {
            "content": text,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
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
                                import base64
                                header, b64data = url.split(",", 1)
                                mime = header.split(":")[1].split(";")[0]
                                parts.append({"inline_data": {"mime_type": mime, "data": b64data}})
                            else:
                                parts.append({"file_data": {"mime_type": "image/jpeg", "file_uri": url}})
                        elif part.get("type") == "text":
                            parts.append(part.get("text", ""))
                        elif part.get("type") == "file":
                            # PDF or other file — pass as inline data
                            import base64
                            b64data = part.get("data", "")
                            mime = part.get("mime_type", "application/pdf")
                            parts.append({"inline_data": {"mime_type": mime, "data": b64data}})
                    else:
                        parts.append(str(part))
                contents.append({"role": role, "parts": parts})
            else:
                contents.append({"role": role, "parts": [str(content)]})
        return contents

    # ── Anthropic Claude ──────────────────────────────────────────────────

    async def _call_anthropic(
        self, model: str, messages: list, temperature: float, max_tokens: int
    ) -> dict:
        import httpx

        # Anthropic uses a different message format
        system_text = ""
        chat_messages = []
        for msg in messages:
            if msg.get("role") == "system":
                system_text += msg.get("content", "") + "\n"
            else:
                content = msg.get("content", "")
                if isinstance(content, list):
                    # Convert multimodal content for Anthropic
                    parts = []
                    for part in content:
                        if isinstance(part, dict):
                            if part.get("type") == "text":
                                parts.append({"type": "text", "text": part.get("text", "")})
                            elif part.get("type") == "image_url":
                                url = part.get("image_url", {}).get("url", "")
                                if url.startswith("data:"):
                                    import base64
                                    header, b64data = url.split(",", 1)
                                    media_type = header.split(":")[1].split(";")[0]
                                    parts.append({
                                        "type": "image",
                                        "source": {"type": "base64", "media_type": media_type, "data": b64data},
                                    })
                        else:
                            parts.append({"type": "text", "text": str(part)})
                    chat_messages.append({"role": msg["role"], "content": parts})
                else:
                    chat_messages.append({"role": msg["role"], "content": str(content)})

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_text.strip() if system_text else None,
                    "messages": chat_messages,
                },
                timeout=120.0,
            )
            resp.raise_for_status()
            data = resp.json()

        content = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                content += block.get("text", "")

        usage = data.get("usage", {})
        return {
            "content": content,
            "input_tokens": usage.get("input_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
        }

    # ── Nvidia NIM (via OpenAI-compatible integrate.api.nvidia.com) ─────────

    async def _call_nvidia(
        self, model: str, messages: list, temperature: float,
        max_tokens: int, response_format: Optional[dict] = None
    ) -> dict:
        from openai import AsyncOpenAI

        api_key = settings.nvidia_api_key
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=settings.NVIDIA_BASE_URL,
        )

        kwargs = dict(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens or 16384,
        )

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
        choice = resp.choices[0]
        content = choice.message.content or ""
        reasoning = (
            getattr(choice.message, "reasoning", None) or
            getattr(choice.message, "reasoning_content", None)
        )

        usage = resp.usage or type("u", (), {"prompt_tokens": 0, "completion_tokens": 0})()

        return {
            "content": content,
            "reasoning": reasoning,
            "input_tokens": usage.prompt_tokens,
            "output_tokens": usage.completion_tokens,
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
                "total_cost_usd": round(health.total_cost_usd, 4),
                "consecutive_failures": health.consecutive_failures,
            }
        return status

    def get_cost_summary(self) -> dict:
        """Get cost summary across all providers."""
        total_cost = sum(h.total_cost_usd for h in self.providers.values())
        total_calls = sum(h.total_calls for h in self.providers.values())
        return {
            "total_cost_usd": round(total_cost, 4),
            "total_calls": total_calls,
            "avg_cost_per_call": round(total_cost / max(total_calls, 1), 6),
            "by_provider": {
                name: {"cost_usd": round(h.total_cost_usd, 4), "calls": h.total_calls}
                for name, h in self.providers.items()
            },
        }


# ── Singleton ──────────────────────────────────────────────────────────
model_router = ModelRouter()
