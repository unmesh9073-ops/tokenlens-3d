import importlib.util
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.copilot import router as copilot_router
from app.routes.tokenizer import router as tokenizer_router

# Load backend/.env if present
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


def _get_cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="TokenLens 3D API",
    version="0.1.0",
    description="Backend API for TokenLens 3D — interactive 3D LLM tokenizer learning studio.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tokenizer_router)
app.include_router(copilot_router)


@app.get("/api/health")
def health_check() -> dict[str, object]:
    """Return service health, Gemini configuration status, and tokenizer library readiness."""
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    chat_model = os.getenv("GEMINI_CHAT_MODEL", "gemini-4-hydrogen").strip() or "gemini-4-hydrogen"
    embedding_model = (
        os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2").strip() or "gemini-embedding-2"
    )

    tiktoken_ready = importlib.util.find_spec("tiktoken") is not None
    hf_tokenizers_ready = importlib.util.find_spec("tokenizers") is not None

    return {
        "status": "ok",
        "gemini_configured": bool(gemini_api_key),
        "chat_model": chat_model,
        "embedding_model": embedding_model,
        "tiktoken_ready": tiktoken_ready,
        "hf_tokenizers_ready": hf_tokenizers_ready,
    }
