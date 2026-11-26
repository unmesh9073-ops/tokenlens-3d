"""Live Gemini embeddings & deterministic offline fallback projected to 3D via PCA."""

from __future__ import annotations

import hashlib
import os
import re

from google import genai
import numpy as np

_EMBEDDING_CACHE: dict[str, list[float]] = {}
_FALLBACK_DIM = 48


def _classify_token(text: str) -> str:
    """Assign an educational semantic category tag to a token string."""
    stripped = text.replace("␣", " ").strip()
    if not stripped:
        return "whitespace"
    if stripped.startswith("<|") and stripped.endswith("|>"):
        return "special"
    if any(0x0900 <= ord(ch) <= 0x097F for ch in stripped):
        return "indic"
    if any(0xAC00 <= ord(ch) <= 0xD7AF or 0x4E00 <= ord(ch) <= 0x9FFF for ch in stripped):
        return "cjk"
    if any(ord(ch) > 0x1F000 for ch in stripped):
        return "emoji"
    if re.fullmatch(r"\d+(\.\d+)?", stripped):
        return "number"
    if re.fullmatch(r"[^\w\s]+", stripped):
        return "punctuation"
    if stripped in {"def", "return", "for", "if", "else", "import", "class", "int", "str", "list"}:
        return "code"
    return "word"


def _local_deterministic_vector(text: str) -> np.ndarray:
    """Build a deterministic 48-d dense feature vector combining category & char n-grams."""
    vec = np.zeros(_FALLBACK_DIM, dtype=np.float64)
    category = _classify_token(text)
    cat_slots = {
        "word": 0,
        "code": 1,
        "number": 2,
        "punctuation": 3,
        "whitespace": 4,
        "emoji": 5,
        "indic": 6,
        "cjk": 7,
        "special": 8,
    }
    vec[cat_slots.get(category, 0)] = 2.5

    normalized = text.lower().replace("␣", " ")
    grams = [normalized[i : i + n] for n in (1, 2, 3) for i in range(max(0, len(normalized) - n + 1))]
    if not grams:
        grams = [normalized or " "]

    for gram in grams:
        digest = hashlib.sha256(gram.encode("utf-8")).digest()
        idx = 10 + (int.from_bytes(digest[:2], "little") % (_FALLBACK_DIM - 10))
        sign = 1.0 if (digest[2] & 1) == 0 else -1.0
        vec[idx] += sign * (1.0 + (digest[3] / 255.0) * 0.25)

    # Length signal
    vec[9] = min(len(normalized) / 10.0, 1.5)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


def _fetch_gemini_embeddings(unique_texts: list[str], model: str, api_key: str) -> dict[str, np.ndarray]:
    """Fetch embeddings from Gemini API using google-genai with an in-memory cache."""
    missing = [t for t in unique_texts if t not in _EMBEDDING_CACHE]
    if missing:
        client = genai.Client(api_key=api_key)
        response = client.models.embed_content(model=model, contents=missing)
        if not response.embeddings or len(response.embeddings) != len(missing):
            raise RuntimeError("Unexpected Gemini embed_content response length")
        for txt, emb in zip(missing, response.embeddings):
            _EMBEDDING_CACHE[txt] = list(emb.values)

    return {txt: np.array(_EMBEDDING_CACHE[txt], dtype=np.float64) for txt in unique_texts}


def _project_to_3d_coords(matrix: np.ndarray) -> np.ndarray:
    """Project an (N, D) matrix down to (N, 3) normalized to [-1, 1] safely for any N >= 1."""
    n_samples, n_features = matrix.shape
    if n_samples == 0:
        return np.zeros((0, 3), dtype=np.float64)
    if n_samples == 1:
        return np.zeros((1, 3), dtype=np.float64)

    n_components = min(3, n_samples, n_features)
    centered = matrix - matrix.mean(axis=0, keepdims=True)
    if np.allclose(centered, 0.0):
        coords = np.zeros((n_samples, 3), dtype=np.float64)
    else:
        u, s, _ = np.linalg.svd(centered, full_matrices=False)
        reduced = u[:, :n_components] * s[:n_components]
        coords = np.zeros((n_samples, 3), dtype=np.float64)
        coords[:, :n_components] = reduced

    max_abs = float(np.max(np.abs(coords)))
    if max_abs > 1e-8:
        coords = coords / max_abs
    return np.clip(coords, -1.0, 1.0)


def project_tokens_to_3d(tokens: list[dict], api_key_override: str | None = None) -> dict:
    """Embed tokens (Gemini live or deterministic fallback) and project to 3D space."""
    if not tokens:
        return {
            "source": "local_fallback",
            "model": "local-feature-v1",
            "points": [],
            "similarities": [],
        }

    unique_texts = list(dict.fromkeys(str(t.get("text", "")) for t in tokens))
    api_key = (api_key_override or os.getenv("GEMINI_API_KEY", "")).strip()
    embed_model = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2").strip() or "gemini-embedding-2"

    source = "local_fallback"
    used_model = "local-feature-v1"
    vec_map: dict[str, np.ndarray]

    if api_key:
        try:
            vec_map = _fetch_gemini_embeddings(unique_texts, embed_model, api_key)
            source = "gemini_live"
            used_model = embed_model
        except Exception:
            vec_map = {t: _local_deterministic_vector(t) for t in unique_texts}
    else:
        vec_map = {t: _local_deterministic_vector(t) for t in unique_texts}

    matrix = np.vstack([vec_map[str(t.get("text", ""))] for t in tokens])
    coords = _project_to_3d_coords(matrix)

    points = [
        {
            "index": int(tok.get("index", idx)),
            "token_id": int(tok.get("token_id", 0)),
            "text": str(tok.get("text", "")),
            "x": round(float(coords[idx, 0]), 5),
            "y": round(float(coords[idx, 1]), 5),
            "z": round(float(coords[idx, 2]), 5),
            "category": _classify_token(str(tok.get("text", ""))),
        }
        for idx, tok in enumerate(tokens)
    ]

    # Pairwise cosine similarities
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    unit_matrix = matrix / norms
    sim_matrix = unit_matrix @ unit_matrix.T

    similarities: list[dict] = []
    n = len(tokens)
    for i in range(n):
        for j in range(i + 1, n):
            similarities.append(
                {
                    "source_index": i,
                    "target_index": j,
                    "similarity": round(float(np.clip(sim_matrix[i, j], -1.0, 1.0)), 4),
                }
            )

    return {
        "source": source,
        "model": used_model,
        "points": points,
        "similarities": similarities,
    }
