"""Local LLM runtime abstraction and Ollama provider.

Supports swappable local and open-source models without rewriting chatbot logic.
Never logs sensitive conversation contents or reveals internal exception details.
"""
from __future__ import annotations

import abc
import logging
from typing import Any

import httpx

from ..config import get_settings

log = logging.getLogger("haven.chatbot.llm")


class LLMError(Exception):
    """Base error for LLM failures with user-facing explanation and status code."""

    def __init__(self, message: str, status_code: int = 503, recoverable: bool = True) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.recoverable = recoverable


class LLMUnavailableError(LLMError):
    """Raised when Ollama or the local runtime cannot be reached."""

    def __init__(self, message: str = "Local AI runtime is not reachable.") -> None:
        super().__init__(message, status_code=503, recoverable=True)


class LLMModelNotFoundError(LLMError):
    """Raised when the requested model is not downloaded in Ollama."""

    def __init__(self, model: str) -> None:
        msg = (
            f"The model '{model}' is not installed in your local Ollama runtime. "
            f"Please run 'ollama pull {model}' in your terminal to download it."
        )
        super().__init__(msg, status_code=503, recoverable=True)


class LLMTimeoutError(LLMError):
    """Raised when local inference times out."""

    def __init__(self, timeout_sec: float) -> None:
        msg = f"Local model inference timed out after {timeout_sec:.0f} seconds. Please try a shorter message or check system load."
        super().__init__(msg, status_code=504, recoverable=True)


class BaseLLMProvider(abc.ABC):
    """Abstract interface for LLM runtime providers."""

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """Name of the inference runtime provider."""

    @property
    @abc.abstractmethod
    def model_name(self) -> str:
        """Name of the configured model."""

    @abc.abstractmethod
    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int | None = 600,
    ) -> str:
        """Generate a chat completion response from the local model."""

    @abc.abstractmethod
    async def check_health(self) -> dict[str, Any]:
        """Check if runtime is active, reachable, and has the configured model available."""


class OllamaProvider(BaseLLMProvider):
    """Ollama local inference runtime provider."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._model = model or settings.ollama_model
        self._timeout = timeout or settings.ollama_timeout_seconds

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model

    async def check_health(self) -> dict[str, Any]:
        """Verify Ollama connectivity and whether the configured model is installed."""
        url = f"{self._base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url)
            if res.status_code != 200:
                return {
                    "available": False,
                    "provider": self.provider_name,
                    "model": self._model,
                    "installed_models": [],
                    "message": f"Ollama returned HTTP status {res.status_code}.",
                }

            data = res.json()
            models_list = [m.get("name", "") for m in data.get("models", []) if isinstance(m, dict)]
            # Match exact name or prefix (e.g., 'qwen2.5:3b' or 'qwen2.5:3b-instruct-q4_K_M')
            has_model = any(
                m == self._model or m.startswith(f"{self._model}:") or m.startswith(f"{self._model}-")
                for m in models_list
            )

            if not has_model:
                return {
                    "available": False,
                    "provider": self.provider_name,
                    "model": self._model,
                    "installed_models": models_list,
                    "message": (
                        f"Ollama is running, but model '{self._model}' is not downloaded. "
                        f"Run 'ollama pull {self._model}' to install."
                    ),
                }

            return {
                "available": True,
                "provider": self.provider_name,
                "model": self._model,
                "installed_models": models_list,
                "message": f"Local model '{self._model}' is ready for inference.",
            }
        except httpx.ConnectError:
            return {
                "available": False,
                "provider": self.provider_name,
                "model": self._model,
                "installed_models": [],
                "message": (
                    f"Cannot reach Ollama at {self._base_url}. "
                    "Make sure Ollama is installed and running ('ollama serve')."
                ),
            }
        except Exception as exc:
            log.warning("Ollama health check failed: %s", exc)
            return {
                "available": False,
                "provider": self.provider_name,
                "model": self._model,
                "installed_models": [],
                "message": "Local AI runtime is currently unavailable.",
            }

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int | None = 600,
    ) -> str:
        """Call Ollama /api/chat with the conversation history."""
        url = f"{self._base_url}/api/chat"
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
            },
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(url, json=payload)

            if response.status_code == 404:
                raise LLMModelNotFoundError(self._model)
            if response.status_code != 200:
                log.error("Ollama HTTP %d response", response.status_code)
                raise LLMError(
                    f"Local inference failed with HTTP status {response.status_code}.",
                    status_code=502,
                )

            data = response.json()
            message = data.get("message", {})
            content = message.get("content", "").strip()

            if not content:
                raise LLMError("Local model returned an empty response.", status_code=502)

            return content

        except httpx.TimeoutException:
            log.warning("Ollama inference timed out after %.1f s", self._timeout)
            raise LLMTimeoutError(self._timeout) from None
        except httpx.ConnectError:
            log.warning("Ollama connection refused at %s", self._base_url)
            raise LLMUnavailableError(
                f"Cannot connect to local Ollama runtime at {self._base_url}. "
                "Please verify that Ollama is running ('ollama serve')."
            ) from None
        except LLMError:
            raise
        except Exception as exc:
            log.error("Unexpected error during local LLM inference: %s", exc)
            raise LLMError("An unexpected error occurred during local model inference.", status_code=500) from None


class OpenAICompatibleProvider(BaseLLMProvider):
    """Hosted OpenAI-compatible inference runtime provider (OpenRouter, Groq, or OpenAI)."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        model: str = "qwen/qwen-2.5-7b-instruct:free",
        provider_name: str = "hosted",
        timeout: float = 30.0,
    ) -> None:
        self._api_key = api_key.strip()
        self._base_url = base_url.rstrip("/")
        self._model = model.strip()
        self._provider_name = provider_name
        self._timeout = timeout

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def model_name(self) -> str:
        return self._model

    async def check_health(self) -> dict[str, Any]:
        """Check if hosted provider API key is set and endpoint responds."""
        if not self._api_key:
            return {
                "available": False,
                "provider": self.provider_name,
                "model": self._model,
                "installed_models": [],
                "message": (
                    "Hosted AI runtime is selected, but LLM_API_KEY is not configured in environment variables."
                ),
            }

        url = f"{self._base_url}/models"
        headers = {"Authorization": f"Bearer {self._api_key}"}
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url, headers=headers)
            if res.status_code == 401:
                return {
                    "available": False,
                    "provider": self.provider_name,
                    "model": self._model,
                    "installed_models": [],
                    "message": "Hosted AI authentication failed. Please check LLM_API_KEY.",
                }
            if res.status_code in (200, 204):
                return {
                    "available": True,
                    "provider": self.provider_name,
                    "model": self._model,
                    "installed_models": [self._model],
                    "message": f"Hosted model '{self._model}' is ready for inference.",
                }
            return {
                "available": True,
                "provider": self.provider_name,
                "model": self._model,
                "installed_models": [self._model],
                "message": f"Hosted provider reachable (HTTP {res.status_code}).",
            }
        except httpx.ConnectError:
            return {
                "available": False,
                "provider": self.provider_name,
                "model": self._model,
                "installed_models": [],
                "message": f"Cannot connect to hosted AI endpoint at {self._base_url}.",
            }
        except Exception as exc:
            log.warning("Hosted LLM health check probe failed: %s", exc)
            return {
                "available": False,
                "provider": self.provider_name,
                "model": self._model,
                "installed_models": [],
                "message": "Hosted AI service is currently unreachable.",
            }

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int | None = 600,
    ) -> str:
        """Call hosted OpenAI-compatible /chat/completions endpoint."""
        if not self._api_key:
            raise LLMUnavailableError(
                "Hosted AI service is not configured with an API key. "
                "Please configure the LLM_API_KEY environment variable."
            )

        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://haven.checkin",
            "X-Title": "Haven Check-in",
        }
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(url, json=payload, headers=headers)

            if response.status_code == 401:
                raise LLMError("Authentication failed with hosted AI provider. Check your API key.", status_code=502)
            if response.status_code == 429:
                raise LLMError(
                    "Free tier rate limit reached for the AI service. Please wait a moment before trying again.",
                    status_code=429,
                )
            if response.status_code != 200:
                log.error("Hosted LLM HTTP %d response: %s", response.status_code, response.text[:200])
                raise LLMError(
                    f"Hosted inference failed with HTTP status {response.status_code}.",
                    status_code=502,
                )

            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                raise LLMError("Hosted model returned no response choices.", status_code=502)

            choice = choices[0]
            content = choice.get("message", {}).get("content", "").strip()
            if not content:
                raise LLMError("Hosted model returned an empty response.", status_code=502)

            return content

        except httpx.TimeoutException:
            log.warning("Hosted LLM inference timed out after %.1f s", self._timeout)
            raise LLMTimeoutError(self._timeout) from None
        except httpx.ConnectError:
            log.warning("Cannot connect to hosted LLM at %s", self._base_url)
            raise LLMUnavailableError(f"Cannot connect to hosted AI service at {self._base_url}.") from None
        except LLMError:
            raise
        except Exception as exc:
            log.error("Unexpected error during hosted LLM inference: %s", exc)
            raise LLMError("An unexpected error occurred during AI inference.", status_code=500) from None

