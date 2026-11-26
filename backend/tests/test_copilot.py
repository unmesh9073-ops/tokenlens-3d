from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _sample_context(**overrides) -> dict:
    base = {
        "mode": "playground",
        "active_diagram": "pipeline",
        "input_text": "Tokenization makes AI read!",
        "use_regex": True,
        "lab_mode": "auto",
        "active_tokenizer_id": "default",
        "timeline_step": 16,
        "total_merge_steps": 16,
        "metrics": {
            "char_count": 26,
            "byte_count": 26,
            "token_count": 11,
            "compression_ratio": 2.36,
            "fertility": 2.75,
        },
        "tokens_preview": [
            {"index": 0, "token_id": 298, "text": "Token", "bytes_hex": "0x54 0x6f 0x6b 0x65 0x6e"},
            {"index": 1, "token_id": 312, "text": "ization", "bytes_hex": "0x69 0x7a 0x61 0x74 0x69 0x6f 0x6e"},
        ],
    }
    base.update(overrides)
    return base


def test_copilot_demo_mode_grounded_in_context(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    res = client.post(
        "/api/copilot/chat",
        json={
            "message": "Walk me through what is on screen",
            "history": [],
            "context": _sample_context(),
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "demo"
    assert "26 UTF-8 bytes" in data["reply"]
    assert "11 tokens" in data["reply"]
    assert len(data["follow_up_chips"]) >= 2


def test_copilot_emoji_question_returns_actions(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    res = client.post(
        "/api/copilot/chat",
        json={
            "message": "Show why emojis cost extra tokens",
            "history": [],
            "context": _sample_context(),
        },
    )
    assert res.status_code == 200
    data = res.json()
    action_names = [a["name"] for a in data["actions"]]
    assert "set_input_text" in action_names
    assert "focus_camera" in action_names


def test_copilot_animate_merges_returns_tree_actions(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    res = client.post(
        "/api/copilot/chat",
        json={
            "message": "Animate how BPE merged this",
            "history": [],
            "context": _sample_context(),
        },
    )
    assert res.status_code == 200
    data = res.json()
    action_names = [a["name"] for a in data["actions"]]
    assert "switch_diagram" in action_names
    assert "set_timeline_step" in action_names
    tree_action = next(a for a in data["actions"] if a["name"] == "switch_diagram")
    assert tree_action["args"]["diagram"] == "tree"


def test_copilot_selected_token_references_token_and_id(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    ctx = _sample_context(
        selected_token={
            "index": 1,
            "token_id": 312,
            "text": "ization",
            "bytes_hex": "0x69 0x7a 0x61 0x74 0x69 0x6f 0x6e",
            "byte_span": [5, 12],
            "is_special": False,
        }
    )
    res = client.post(
        "/api/copilot/chat",
        json={
            "message": "Why is this selected token #312?",
            "history": [],
            "context": ctx,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "ization" in data["reply"]
    assert "#312" in data["reply"]


def test_copilot_live_failure_gracefully_falls_back_to_demo(monkeypatch) -> None:
    def _boom(*args, **kwargs):
        raise RuntimeError("Simulated API outage")

    monkeypatch.setattr("app.copilot.genai.Client", _boom)
    res = client.post(
        "/api/copilot/chat",
        headers={"X-Gemini-Api-Key": "fake-key-123"},
        json={
            "message": "Walk me through what is on screen",
            "history": [],
            "context": _sample_context(),
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "demo"
    assert data["warning"] is not None
    assert "Demo Mode" in data["warning"]
