"""Chat endpoints for Haven AI Mental Wellness Companion.

Connects to local Ollama runtime via FastAPI.
Frontend never talks to Ollama directly.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from ..chatbot.llm import LLMError
from ..chatbot.service import get_chatbot_service
from ..deps import get_optional_current_user
from ..nlp_analysis import get_nlp_service
from ..schemas import (
    ChatRequest,
    ChatResetIn,
    ChatResponse,
    ChatStatusResponse,
    ClearAnalysisResponse,
    MessageAnalysisIn,
    MessageAnalysisOut,
    ReportRequestIn,
)


log = logging.getLogger("haven.routers.chat")

router = APIRouter(tags=["chat"])


async def _handle_chat(
    body: ChatRequest,
    request: Request,
    user: dict | None,
) -> ChatResponse:
    service = get_chatbot_service()
    owner_id = user["id"] if user else None
    client_ip = request.client.host if request.client else "127.0.0.1"

    try:
        result = await service.process_message(
            message=body.message,
            conversation_id=body.conversation_id,
            owner_id=owner_id,
            client_ip=client_ip,
            emotion_context=body.emotion_context,
        )
        return ChatResponse(**result)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LLMError as exc:
        # User-friendly explanation without internal traces
        raise HTTPException(exc.status_code, detail=exc.message) from exc
    except Exception as exc:
        log.error("Unhandled exception during chat: %s", exc)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The wellness assistant encountered an internal error. Please try again shortly.",
        ) from None


async def _handle_status() -> ChatStatusResponse:
    service = get_chatbot_service()
    res = await service.check_runtime_status()
    return ChatStatusResponse(**res)


async def _handle_reset(
    body: ChatResetIn,
    user: dict | None,
) -> dict:
    service = get_chatbot_service()
    owner_id = user["id"] if user else None
    try:
        service.reset_conversation(body.conversation_id, owner_id=owner_id)
        return {"ok": True, "conversation_id": body.conversation_id, "message": "Conversation memory reset."}
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


# Both /api/chat and /chat paths supported
@router.post("/api/chat", response_model=ChatResponse)
@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    body: ChatRequest,
    request: Request,
    user: Annotated[dict | None, Depends(get_optional_current_user)] = None,
):
    """Send a message to the local Haven Wellness Chatbot."""
    return await _handle_chat(body, request, user)


@router.get("/api/chat/status", response_model=ChatStatusResponse)
@router.get("/chat/status", response_model=ChatStatusResponse)
async def chat_status_endpoint():
    """Check local Ollama runtime and model availability."""
    return await _handle_status()


@router.post("/api/chat/reset")
@router.post("/chat/reset")
async def chat_reset_endpoint(
    body: ChatResetIn,
    user: Annotated[dict | None, Depends(get_optional_current_user)] = None,
):
    """Reset the bounded conversation history for a given conversation session."""
    return await _handle_reset(body, user)


@router.post("/api/chat/analyze-message", response_model=MessageAnalysisOut)
@router.post("/chat/analyze-message", response_model=MessageAnalysisOut)
async def analyze_message_endpoint(
    body: MessageAnalysisIn,
):
    """Analyze the emotional tone of a single message with the separate NLP service."""
    nlp_service = get_nlp_service()
    return await nlp_service.analyze_single_message(body.message)


@router.get("/api/chat/{conversation_id}/report")
@router.get("/chat/{conversation_id}/report")
async def get_chat_report_endpoint(
    conversation_id: str,
    user: Annotated[dict | None, Depends(get_optional_current_user)] = None,
):
    """Generate the combined emotional insights report for a conversation session."""
    service = get_chatbot_service()
    owner_id = user["id"] if user else None
    try:
        return await service.get_emotional_report(conversation_id, owner_id=owner_id)
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post("/api/chat/report")
@router.post("/chat/report")
async def post_chat_report_endpoint(
    body: ReportRequestIn,
    user: Annotated[dict | None, Depends(get_optional_current_user)] = None,
):
    """Generate the combined emotional insights report with optional client facial summary."""
    service = get_chatbot_service()
    owner_id = user["id"] if user else None
    client_face = body.face_summary.model_dump() if body.face_summary else None
    try:
        return await service.get_emotional_report(
            body.conversation_id,
            owner_id=owner_id,
            client_face_summary=client_face,
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post("/api/chat/{conversation_id}/clear-analysis", response_model=ClearAnalysisResponse)
@router.post("/chat/{conversation_id}/clear-analysis", response_model=ClearAnalysisResponse)
async def clear_analysis_endpoint(
    conversation_id: str,
    user: Annotated[dict | None, Depends(get_optional_current_user)] = None,
):
    """Clear derived emotional summaries for a session without clearing chat history."""
    service = get_chatbot_service()
    owner_id = user["id"] if user else None
    try:
        cleared = service.clear_conversation_analysis(conversation_id, owner_id=owner_id)
        if not cleared:
            return ClearAnalysisResponse(
                ok=False,
                conversation_id=conversation_id,
                message="No active session found to clear.",
            )
        return ClearAnalysisResponse(
            ok=True,
            conversation_id=conversation_id,
            message="Derived emotion analyses have been removed for this session.",
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

