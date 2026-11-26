"""FastAPI route for the Ask Gemini Co-Pilot."""

from __future__ import annotations

from fastapi import APIRouter, Header

from app.copilot import run_copilot_chat
from app.schemas import CopilotChatRequest, CopilotChatResponse

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.post("/chat", response_model=CopilotChatResponse)
def copilot_chat(
    req: CopilotChatRequest,
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
) -> dict:
    return run_copilot_chat(
        message=req.message,
        history=req.history,
        context=req.context,
        api_key_override=x_gemini_api_key,
    )
