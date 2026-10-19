"""Chatbot orchestration service.

Combines deterministic crisis screening, bounded conversational memory,
system prompts, and local LLM inference into a cohesive, privacy-preserving pipeline.
Never logs sensitive conversation text or returns fabricated replies on failure.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from ..config import get_settings
from ..emotion_fusion import get_fusion_service
from ..nlp_analysis import get_nlp_service
from ..security import new_id
from .llm import BaseLLMProvider, OllamaProvider, OpenAICompatibleProvider
from .memory import ConversationMemoryManager, get_memory_manager
from .prompts import format_chat_messages, format_emotion_prompt_note
from .safety import (
    contains_prompt_injection,
    evaluate_crisis_risk,
    sanitize_student_input,
    validate_chat_emotion_context,
)


log = logging.getLogger("haven.chatbot.service")


def create_default_llm_provider() -> BaseLLMProvider:
    """Create default LLM provider based on environment settings.

    If hosted LLM settings or an API key are provided, uses OpenAICompatibleProvider.
    Otherwise defaults to local OllamaProvider.
    """
    settings = get_settings()
    is_hosted = (
        bool(settings.llm_api_key.strip())
        or settings.llm_provider.lower() in ("openrouter", "groq", "openai", "hosted")
    )
    if is_hosted:
        provider = settings.llm_provider.lower()
        base_url = settings.llm_base_url.strip()
        model = settings.llm_model.strip()

        if provider == "groq":
            base_url = base_url or "https://api.groq.com/openai/v1"
            model = model or "llama-3.1-8b-instant"
            provider_name = "groq"
        else:
            base_url = base_url or "https://openrouter.ai/api/v1"
            model = model or "qwen/qwen-2.5-7b-instruct:free"
            provider_name = "openrouter"

        return OpenAICompatibleProvider(
            api_key=settings.llm_api_key,
            base_url=base_url,
            model=model,
            provider_name=provider_name,
            timeout=settings.ollama_timeout_seconds,
        )

    return OllamaProvider(
        base_url=settings.ollama_base_url,
        model=settings.ollama_model,
        timeout=settings.ollama_timeout_seconds,
    )


class ChatbotService:
    """Orchestrates mental wellness chat interactions."""

    def __init__(
        self,
        llm_provider: BaseLLMProvider | None = None,
        memory_manager: ConversationMemoryManager | None = None,
    ) -> None:
        self.llm = llm_provider or create_default_llm_provider()
        self.memory = memory_manager or get_memory_manager()
        self._rate_limits: dict[str, list[float]] = {}

    def _check_rate_limit(self, client_key: str, max_per_minute: int) -> bool:
        """Simple in-memory token bucket/sliding window rate limiter."""
        now = time.time()
        window_start = now - 60.0
        timestamps = [t for t in self._rate_limits.get(client_key, []) if t > window_start]
        if len(timestamps) >= max_per_minute:
            return False
        timestamps.append(now)
        self._rate_limits[client_key] = timestamps
        return True

    async def check_runtime_status(self) -> dict[str, Any]:
        """Check whether the local LLM runtime (Ollama) is active and model is pulled."""
        return await self.llm.check_health()

    async def process_message(
        self,
        message: str,
        conversation_id: str | None = None,
        owner_id: str | None = None,
        client_ip: str = "127.0.0.1",
        emotion_context: Any = None,
    ) -> dict[str, Any]:
        """Process a student message with safety checks and bounded conversation memory."""
        settings = get_settings()

        # Enforce rate limiting per conversation or IP
        rate_key = conversation_id or client_ip
        if not self._check_rate_limit(rate_key, settings.chat_rate_limit_per_minute):
            log.warning("Rate limit exceeded for client prefix %s", rate_key[:8])
            raise ValueError(
                "You are sending messages too quickly. Please pause for a few seconds before trying again."
            )

        # 1. Sanitize incoming input
        cleaned = sanitize_student_input(message, max_chars=settings.chat_max_message_chars)
        if not cleaned:
            raise ValueError("Message cannot be empty or only whitespace.")

        # Ensure active conversation ID
        cid = conversation_id.strip() if conversation_id and conversation_id.strip() else new_id("conv_")

        # 2. Independent Deterministic Crisis Evaluation
        crisis_result = evaluate_crisis_risk(cleaned)
        if crisis_result.is_crisis:
            # Crisis detected: bypass LLM, preserve immediate de-escalation response and verified resources
            self.memory.add_turn(cid, "user", cleaned, owner_id=owner_id)
            self.memory.add_turn(cid, "assistant", crisis_result.deescalation_reply or "", owner_id=owner_id)

            log.info("Deterministic crisis safety triggered for conversation prefix %s", cid[:8])
            return {
                "conversation_id": cid,
                "reply": crisis_result.deescalation_reply,
                "provider": self.llm.provider_name,
                "model": self.llm.model_name,
                "safety_status": "crisis_intercepted",
                "crisis_resources": crisis_result.resources,
            }

        # 3. Check for prompt injection or system instruction override attempts
        if contains_prompt_injection(cleaned):
            warning_reply = (
                "I am here to support your daily wellness, stress management, and self-care routines. "
                "I cannot override safety guidelines or provide psychiatric diagnoses, but we can talk about "
                "how you have been feeling lately."
            )
            self.memory.add_turn(cid, "user", cleaned, owner_id=owner_id)
            self.memory.add_turn(cid, "assistant", warning_reply, owner_id=owner_id)
            return {
                "conversation_id": cid,
                "reply": warning_reply,
                "provider": self.llm.provider_name,
                "model": self.llm.model_name,
                "safety_status": "ok",
                "crisis_resources": None,
            }

        # 4. Fetch bounded conversation history
        history = self.memory.get_history(cid, owner_id=owner_id)

        # 5. Perform NLP analysis on the student's message (never on assistant replies)
        nlp_service = get_nlp_service()
        try:
            nlp_result = await nlp_service.analyze_single_message(cleaned)
            self.memory.add_user_nlp_analysis(cid, nlp_result, owner_id=owner_id)
        except Exception as exc:
            log.warning("NLP message analysis failed: %s", exc)
            nlp_result = None

        # 6. Validate optional camera emotion context and record observation
        valid_emotion = validate_chat_emotion_context(emotion_context)
        if valid_emotion:
            self.memory.record_face_observation(cid, valid_emotion, owner_id=owner_id)

        # Build compact, non-clinical prompt note for Ollama
        emotion_note = format_emotion_prompt_note(emotion_data=valid_emotion, nlp_data=nlp_result)
        messages = format_chat_messages(history, cleaned, emotion_note=emotion_note)

        # 7. Perform local LLM inference
        start_time = time.time()
        reply = await self.llm.chat(messages)
        duration = time.time() - start_time
        log.info(
            "Local inference completed in %.2fs (turns=%d, chars=%d)",
            duration,
            len(history) + 1,
            len(reply),
        )

        # 8. Record turn into in-memory bounded store
        self.memory.add_turn(cid, "user", cleaned, owner_id=owner_id)
        self.memory.add_turn(cid, "assistant", reply, owner_id=owner_id)

        return {
            "conversation_id": cid,
            "reply": reply,
            "provider": self.llm.provider_name,
            "model": self.llm.model_name,
            "safety_status": "ok",
            "crisis_resources": None,
        }

    async def get_emotional_report(
        self,
        conversation_id: str,
        owner_id: str | None = None,
        client_face_summary: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate combined emotional insights report across NLP message history and facial tracking."""
        nlp_service = get_nlp_service()
        fusion_service = get_fusion_service()

        user_analyses = self.memory.get_user_nlp_analyses(conversation_id, owner_id=owner_id)
        session_created_at = self.memory.get_session_created_at(conversation_id, owner_id=owner_id)
        nlp_insights = nlp_service.aggregate_conversation_insights(
            user_analyses,
            start_time=session_created_at,
        )

        face_data = client_face_summary or self.memory.get_face_summary(conversation_id, owner_id=owner_id)
        if client_face_summary and (client_face_summary.get("sample_count", 0) > 0 or client_face_summary.get("sampleCount", 0) > 0):
            self.memory.record_face_observation(conversation_id, client_face_summary, owner_id=owner_id)

        return fusion_service.generate_combined_report(
            nlp_data=nlp_insights,
            face_data=face_data,
            conversation_id=conversation_id,
            session_created_at=session_created_at,
        )

    def clear_conversation_analysis(
        self,
        conversation_id: str,
        owner_id: str | None = None,
    ) -> bool:
        """Clear derived emotion summaries while preserving chat history."""
        return self.memory.clear_derived_analysis(conversation_id, owner_id=owner_id)

    def reset_conversation(self, conversation_id: str, owner_id: str | None = None) -> bool:
        """Clear memory for a conversation."""
        return self.memory.reset_session(conversation_id, owner_id=owner_id)



# Global service instance
_service: ChatbotService | None = None


def get_chatbot_service() -> ChatbotService:
    global _service
    if _service is None:
        _service = ChatbotService()
    return _service
