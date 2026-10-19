"""Bounded in-memory conversation memory manager.

Maintains sliding-window conversation turns associated with session identifiers.
Enforces strict session isolation to prevent cross-user data leakage.
Does not persist sensitive conversations to database or log file contents.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from ..config import get_settings

log = logging.getLogger("haven.chatbot.memory")


@dataclass
class ChatTurn:
    role: str  # "user" | "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class ConversationSession:
    conversation_id: str
    owner_id: str | None = None  # User ID if authenticated; None if guest
    turns: list[ChatTurn] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_active_at: float = field(default_factory=time.time)
    # Session-isolated derived emotion summaries (in-memory only, never persisted without consent)
    user_message_analyses: list[dict[str, Any]] = field(default_factory=list)
    latest_face_observation: dict[str, Any] | None = None
    face_observations: list[dict[str, Any]] = field(default_factory=list)



class ConversationMemoryManager:
    """Manages active conversational sessions with bounded size and session isolation."""

    def __init__(
        self,
        max_turns: int = 12,
        max_context_chars: int = 8000,
        session_ttl_seconds: float = 86400,  # 24 hours
    ) -> None:
        self.max_turns = max_turns
        self.max_context_chars = max_context_chars
        self.session_ttl_seconds = session_ttl_seconds
        self._sessions: dict[str, ConversationSession] = {}

    def _cleanup_expired(self) -> None:
        """Remove sessions that have been inactive longer than session_ttl_seconds."""
        now = time.time()
        expired = [
            cid
            for cid, session in self._sessions.items()
            if now - session.last_active_at > self.session_ttl_seconds
        ]
        for cid in expired:
            self._sessions.pop(cid, None)

    def get_or_create_session(
        self,
        conversation_id: str,
        owner_id: str | None = None,
    ) -> ConversationSession:
        """Get an existing session or initialize a new one.

        Validates session ownership if owner_id is provided.
        Raises PermissionError if another authenticated user attempts to access this session.
        """
        self._cleanup_expired()
        session = self._sessions.get(conversation_id)

        if session is None:
            session = ConversationSession(
                conversation_id=conversation_id,
                owner_id=owner_id,
            )
            self._sessions[conversation_id] = session
            return session

        # Verify ownership isolation
        if session.owner_id and owner_id and session.owner_id != owner_id:
            log.warning("Ownership mismatch for session prefix %s", conversation_id[:8])
            raise PermissionError("Access denied: This conversation belongs to another user session.")

        # Bind anonymous session to user upon first authenticated request
        if session.owner_id is None and owner_id is not None:
            session.owner_id = owner_id

        session.last_active_at = time.time()
        return session

    def get_history(
        self,
        conversation_id: str,
        owner_id: str | None = None,
    ) -> list[dict[str, str]]:
        """Retrieve bounded history for the session formatted as [{role, content}]."""
        session = self.get_or_create_session(conversation_id, owner_id)
        # Select last max_turns
        recent_turns = session.turns[-self.max_turns :]

        # Enforce character budget across context
        result: list[dict[str, str]] = []
        char_count = 0
        for turn in reversed(recent_turns):
            turn_len = len(turn.content)
            if char_count + turn_len > self.max_context_chars and result:
                break
            result.insert(0, {"role": turn.role, "content": turn.content})
            char_count += turn_len

        return result

    def add_turn(
        self,
        conversation_id: str,
        role: str,
        content: str,
        owner_id: str | None = None,
    ) -> None:
        """Append a turn to the conversation history, enforcing sliding-window bounds."""
        session = self.get_or_create_session(conversation_id, owner_id)
        session.turns.append(ChatTurn(role=role, content=content))
        session.last_active_at = time.time()

        # Enforce bounded capacity
        if len(session.turns) > self.max_turns * 2:
            session.turns = session.turns[-self.max_turns :]

    def add_user_nlp_analysis(
        self,
        conversation_id: str,
        analysis: dict[str, Any],
        owner_id: str | None = None,
    ) -> None:
        """Store NLP analysis of a student message in session memory."""
        session = self.get_or_create_session(conversation_id, owner_id)
        session.user_message_analyses.append(analysis)
        session.last_active_at = time.time()
        # Keep bounded
        if len(session.user_message_analyses) > self.max_turns * 3:
            session.user_message_analyses = session.user_message_analyses[-self.max_turns * 2 :]

    def record_face_observation(
        self,
        conversation_id: str,
        face_obs: dict[str, Any],
        owner_id: str | None = None,
    ) -> None:
        """Store validated face observation for the session."""
        session = self.get_or_create_session(conversation_id, owner_id)
        session.latest_face_observation = face_obs
        session.face_observations.append(face_obs)
        session.last_active_at = time.time()
        if len(session.face_observations) > self.max_turns * 3:
            session.face_observations = session.face_observations[-self.max_turns * 2 :]

    def get_user_nlp_analyses(
        self,
        conversation_id: str,
        owner_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve all user message analyses for the session."""
        session = self.get_or_create_session(conversation_id, owner_id)
        return list(session.user_message_analyses)

    def get_face_summary(
        self,
        conversation_id: str,
        owner_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Retrieve aggregated or latest face observation for the session."""
        session = self.get_or_create_session(conversation_id, owner_id)
        if not session.face_observations and not session.latest_face_observation:
            return None

        # If multiple observations, aggregate them
        obs_list = session.face_observations
        if not obs_list and session.latest_face_observation:
            obs_list = [session.latest_face_observation]

        total_samples = sum(o.get("sample_count", 0) for o in obs_list)
        latest = obs_list[-1]

        # Calculate average breakdown across observations
        all_emotions: dict[str, float] = {}
        counts: dict[str, int] = {}
        for o in obs_list:
            em = o.get("emotions") or {}
            for k, v in em.items():
                all_emotions[k] = all_emotions.get(k, 0.0) + float(v)
                counts[k] = counts.get(k, 0) + 1

        avg_emotions = {
            k: round(all_emotions[k] / counts[k], 3)
            for k in all_emotions
            if counts.get(k, 0) > 0
        }

        dominant = latest.get("dominant_emotion", "neutral")
        if avg_emotions:
            dominant = max(avg_emotions.items(), key=lambda x: x[1])[0]

        return {
            "dominant_emotion": dominant,
            "dominant_score": avg_emotions.get(dominant, latest.get("dominant_score", 0.0)),
            "emotions": avg_emotions or latest.get("emotions", {}),
            "distribution": avg_emotions or latest.get("emotions", {}),
            "sample_count": total_samples or latest.get("sample_count", 0),
            "timestamp": latest.get("timestamp", time.time()),
            "last_updated": latest.get("timestamp", time.time()),
            "is_active": latest.get("is_active", True),
        }

    def clear_derived_analysis(
        self,
        conversation_id: str,
        owner_id: str | None = None,
    ) -> bool:
        """Clear only derived emotion analysis from session memory while preserving chat text."""
        session = self._sessions.get(conversation_id)
        if not session:
            return False

        if session.owner_id and owner_id and session.owner_id != owner_id:
            raise PermissionError("Cannot modify conversation owned by another user.")

        session.user_message_analyses.clear()
        session.latest_face_observation = None
        session.face_observations.clear()
        return True

    def get_session_created_at(
        self,
        conversation_id: str,
        owner_id: str | None = None,
    ) -> float | None:
        session = self.get_or_create_session(conversation_id, owner_id)
        return session.created_at

    def reset_session(self, conversation_id: str, owner_id: str | None = None) -> bool:
        """Clear memory for a conversation (for 'New Conversation' action)."""
        session = self._sessions.get(conversation_id)
        if not session:
            return False

        if session.owner_id and owner_id and session.owner_id != owner_id:
            raise PermissionError("Cannot reset conversation owned by another user.")

        self._sessions.pop(conversation_id, None)
        return True

    def get_turn_count(self, conversation_id: str) -> int:
        session = self._sessions.get(conversation_id)
        return len(session.turns) if session else 0



# Global singleton instance
_memory_manager: ConversationMemoryManager | None = None


def get_memory_manager() -> ConversationMemoryManager:
    global _memory_manager
    if _memory_manager is None:
        settings = get_settings()
        _memory_manager = ConversationMemoryManager(
            max_turns=settings.chat_max_history_turns,
        )
    return _memory_manager
