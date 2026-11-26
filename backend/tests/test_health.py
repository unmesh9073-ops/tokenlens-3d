from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_expected_schema() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "ok"
    assert isinstance(payload["gemini_configured"], bool)
    assert isinstance(payload["chat_model"], str) and len(payload["chat_model"]) > 0
    assert isinstance(payload["embedding_model"], str) and len(payload["embedding_model"]) > 0
    assert isinstance(payload["tiktoken_ready"], bool)
    assert isinstance(payload["hf_tokenizers_ready"], bool)
    assert payload["tiktoken_ready"] is True
    assert payload["hf_tokenizers_ready"] is True
