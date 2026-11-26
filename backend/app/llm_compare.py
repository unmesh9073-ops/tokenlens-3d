"""Side-by-side comparison across Educational BPE, OpenAI tiktoken, and HuggingFace tokenizers."""

from __future__ import annotations

from functools import lru_cache
import time

import tiktoken
from tokenizers import Tokenizer
from tokenizers.models import BPE
from tokenizers.pre_tokenizers import ByteLevel as ByteLevelPreTokenizer
from tokenizers.trainers import BpeTrainer

from app.bpe_engine import STARTER_CORPUS, _bytes_preview, _format_bytes_hex, tokenizer_registry


@lru_cache(maxsize=2)
def _get_tiktoken_encoding(name: str) -> tiktoken.Encoding:
    return tiktoken.get_encoding(name)


@lru_cache(maxsize=1)
def _get_hf_tokenizer() -> tuple[Tokenizer, bool]:
    """Load HuggingFace GPT-2 tokenizer, falling back to an offline local Rust BPE model."""
    try:
        tok = Tokenizer.from_pretrained("gpt2")
        return tok, False
    except Exception:
        tok = Tokenizer(BPE(unk_token="<|endoftext|>"))
        tok.pre_tokenizer = ByteLevelPreTokenizer(add_prefix_space=False)
        trainer = BpeTrainer(
            vocab_size=512,
            min_frequency=2,
            special_tokens=["<|endoftext|>", "<|im_start|>", "<|im_end|>"],
        )
        tok.train_from_iterator([STARTER_CORPUS], trainer=trainer)
        return tok, True


def _build_metrics(text: str, tokens: list[dict], encode_time_us: float) -> dict:
    byte_count = len(text.encode("utf-8"))
    token_count = len(tokens)
    word_count = len(text.split())
    return {
        "token_count": token_count,
        "fertility": round(token_count / max(word_count, 1), 4),
        "bytes_per_token": round(byte_count / max(token_count, 1), 4),
        "compression_ratio": round(byte_count / max(token_count, 1), 4),
        "encode_time_us": round(encode_time_us, 2),
    }


def _compare_tiktoken(
    text: str,
    encoding_name: str,
    model_id: str,
    display_name: str,
) -> dict:
    enc = _get_tiktoken_encoding(encoding_name)
    start = time.perf_counter_ns()
    ids = enc.encode(text, allowed_special="all")
    elapsed_us = (time.perf_counter_ns() - start) / 1000.0

    tokens: list[dict] = []
    for tid in ids:
        try:
            raw = enc.decode_single_token_bytes(tid)
        except Exception:
            raw = b""
        tokens.append(
            {
                "token_id": tid,
                "text": _bytes_preview(raw),
                "bytes_hex": _format_bytes_hex(raw),
            }
        )

    metrics = _build_metrics(text, tokens, elapsed_us)
    return {
        "model_id": model_id,
        "display_name": display_name,
        "vocab_size": enc.n_vocab,
        "tokens": tokens,
        **metrics,
        "is_fallback": False,
    }


def _compare_hf(text: str) -> dict:
    tok, is_fallback = _get_hf_tokenizer()
    start = time.perf_counter_ns()
    encoded = tok.encode(text)
    elapsed_us = (time.perf_counter_ns() - start) / 1000.0

    tokens: list[dict] = []
    for tid, piece in zip(encoded.ids, encoded.tokens):
        clean_piece = piece.replace("Ġ", "␣").replace("Ċ", "↵")
        piece_bytes = piece.encode("utf-8")
        tokens.append(
            {
                "token_id": tid,
                "text": clean_piece,
                "bytes_hex": _format_bytes_hex(piece_bytes),
            }
        )

    metrics = _build_metrics(text, tokens, elapsed_us)
    return {
        "model_id": "hf_bpe",
        "display_name": "HuggingFace BPE (GPT-2)" if not is_fallback else "HuggingFace BPE (Offline Local)",
        "vocab_size": tok.get_vocab_size(),
        "tokens": tokens,
        **metrics,
        "is_fallback": is_fallback,
    }


def compare_tokenizers(
    text: str,
    tokenizer_id: str | None = None,
    use_regex: bool = True,
) -> list[dict]:
    """Run side-by-side tokenization comparison across 4 tokenizers."""
    edu_tok = tokenizer_registry.get(tokenizer_id)
    start = time.perf_counter_ns()
    edu_trace = edu_tok.encode_with_trace(text, use_regex=use_regex)
    edu_elapsed_us = (time.perf_counter_ns() - start) / 1000.0

    edu_tokens = [
        {
            "token_id": t["token_id"],
            "text": t["text"],
            "bytes_hex": t["bytes_hex"],
        }
        for t in edu_trace["final_tokens"]
    ]
    edu_metrics = _build_metrics(text, edu_tokens, edu_elapsed_us)

    results = [
        {
            "model_id": "educational_bpe",
            "display_name": edu_tok.name,
            "vocab_size": edu_tok.vocab_size,
            "tokens": edu_tokens,
            **edu_metrics,
            "is_fallback": False,
        },
        _compare_tiktoken(
            text=text,
            encoding_name="o200k_base",
            model_id="gpt4o_o200k",
            display_name="OpenAI GPT-4o (o200k_base)",
        ),
        _compare_tiktoken(
            text=text,
            encoding_name="cl100k_base",
            model_id="gpt4_cl100k",
            display_name="OpenAI GPT-4 (cl100k_base)",
        ),
        _compare_hf(text),
    ]
    return results
