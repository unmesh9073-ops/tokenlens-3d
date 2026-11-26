from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_lossless_utf8_roundtrip_across_scripts_and_code() -> None:
    samples = [
        "Tokenization makes AI read! Large language models split subwords.",
        "def fib(n: int) -> int:\n    if n <= 1:\n        return n\n    return fib(n - 1) + fib(n - 2)\n",
        "🚀👨\u200d👩\u200d👧\u200d👦✨",
        "नमस्ते दुनिया! AI टोकनाइज़ेशन",
        "안녕하세요 세계! 토큰화 테스트",
    ]
    for sample in samples:
        res = client.post(
            "/api/bpe/analyze",
            json={"text": sample, "use_regex": True},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_lossless"] is True
        assert data["decoded_text"] == sample
        assert data["metrics"]["byte_count"] == len(sample.encode("utf-8"))
        assert len(data["final_tokens"]) >= 1
        assert len(data["merge_tree"]["root_node_ids"]) == len(data["final_tokens"])


def test_regex_pretokenization_toggle_changes_chunking() -> None:
    text = "dog. dog! dog? the cat"
    res_on = client.post("/api/bpe/analyze", json={"text": text, "use_regex": True})
    res_off = client.post("/api/bpe/analyze", json={"text": text, "use_regex": False})

    assert res_on.status_code == 200
    assert res_off.status_code == 200

    data_on = res_on.json()
    data_off = res_off.json()

    # Regex ON produces multiple word/punctuation chunks; Regex OFF keeps one raw stream
    assert len(data_on["chunks"]) > 1
    assert len(data_off["chunks"]) == 1
    assert data_on["is_lossless"] is True
    assert data_off["is_lossless"] is True


def test_special_tokens_stay_intact() -> None:
    text = "Hello <|endoftext|> world <|im_start|>user"
    res = client.post("/api/bpe/analyze", json={"text": text, "use_regex": True})
    assert res.status_code == 200
    data = res.json()

    special_tokens = [t for t in data["final_tokens"] if t["is_special"]]
    special_texts = [t["text"] for t in special_tokens]
    assert "<|endoftext|>" in special_texts
    assert "<|im_start|>" in special_texts
    assert data["is_lossless"] is True


def test_train_custom_tokenizer_and_analyze() -> None:
    corpus = ("banana bandana banana cabana " * 10).strip()
    train_res = client.post(
        "/api/bpe/train",
        json={"corpus": corpus, "num_merges": 15, "use_regex": True, "name": "Banana BPE"},
    )
    assert train_res.status_code == 200
    train_data = train_res.json()
    tid = train_data["tokenizer_id"]
    assert tid.startswith("custom_")
    assert train_data["merges_learned"] > 0

    analyze_res = client.post(
        "/api/bpe/analyze",
        json={"text": "banana bandana", "tokenizer_id": tid, "use_regex": True},
    )
    assert analyze_res.status_code == 200
    analyze_data = analyze_res.json()
    assert analyze_data["tokenizer_id"] == tid
    assert analyze_data["is_lossless"] is True
    # Trained merges should compress "banana bandana" well below its raw 14 bytes
    assert analyze_data["metrics"]["token_count"] < analyze_data["metrics"]["byte_count"]


def test_manual_merge_creates_parent_node_and_reduces_tokens() -> None:
    # Start with 0 merges so we have raw byte leaves
    init_res = client.post(
        "/api/bpe/analyze",
        json={"text": "ababab", "use_regex": True, "max_merges": 0},
    )
    assert init_res.status_code == 200
    init_data = init_res.json()
    seq_ids = init_data["merge_tree"]["root_node_ids"]
    assert len(seq_ids) == 6  # 'a', 'b', 'a', 'b', 'a', 'b'

    merge_res = client.post(
        "/api/bpe/manual-merge",
        json={
            "tokenizer_id": "default",
            "nodes": init_data["merge_tree"]["nodes"],
            "sequence_node_ids": seq_ids,
            "left_token_id": ord("a"),
            "right_token_id": ord("b"),
            "use_regex": True,
        },
    )
    assert merge_res.status_code == 200
    merge_data = merge_res.json()
    assert merge_data["merges_applied"] == 3
    assert len(merge_data["sequence_node_ids"]) == 3
    assert len(merge_data["merge_tree"]["nodes"]) == 6 + 3


def test_compare_real_llms() -> None:
    res = client.post(
        "/api/compare",
        json={"text": "Tokenization makes AI read! 🚀", "tokenizer_id": "default", "use_regex": True},
    )
    assert res.status_code == 200
    data = res.json()
    model_ids = {m["model_id"] for m in data["models"]}
    assert model_ids == {"educational_bpe", "gpt4o_o200k", "gpt4_cl100k", "hf_bpe"}
    for m in data["models"]:
        assert m["token_count"] >= 1
        assert m["vocab_size"] > 0
        assert len(m["tokens"]) == m["token_count"]


def test_embeddings_project_edge_cases(monkeypatch) -> None:
    # Ensure deterministic local_fallback mode for unit tests
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    # 1 token
    res1 = client.post(
        "/api/embeddings/project",
        json={"tokens": [{"index": 0, "token_id": 100, "text": "AI"}]},
    )
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["source"] == "local_fallback"
    assert len(d1["points"]) == 1
    assert d1["similarities"] == []

    # 2 tokens
    res2 = client.post(
        "/api/embeddings/project",
        json={
            "tokens": [
                {"index": 0, "token_id": 1, "text": "token"},
                {"index": 1, "token_id": 2, "text": "2026"},
            ]
        },
    )
    assert res2.status_code == 200
    d2 = res2.json()
    assert len(d2["points"]) == 2
    assert len(d2["similarities"]) == 1

    # 8+ tokens across diverse categories
    tokens_8 = [
        {"index": i, "token_id": 100 + i, "text": txt}
        for i, txt in enumerate(
            ["Token", "ization", "def", "return", "2026", "!", "🚀", "नमस्ते"]
        )
    ]
    res8 = client.post("/api/embeddings/project", json={"tokens": tokens_8})
    assert res8.status_code == 200
    d8 = res8.json()
    assert len(d8["points"]) == 8
    assert len(d8["similarities"]) == 28  # 8 * 7 / 2
    for pt in d8["points"]:
        assert -1.0 <= pt["x"] <= 1.0
        assert -1.0 <= pt["y"] <= 1.0
        assert -1.0 <= pt["z"] <= 1.0
