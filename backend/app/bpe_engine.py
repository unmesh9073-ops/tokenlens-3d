"""From-scratch educational Byte-Level BPE tokenizer engine for TokenLens 3D."""

from __future__ import annotations

from collections import Counter, OrderedDict
from dataclasses import dataclass, field
import uuid

import regex

# Official GPT-4 style pre-tokenization pattern (uses `regex` for \p{L} and \p{N})
GPT4_SPLIT_PATTERN = (
    r"""'(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?+\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]++[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+"""
)
_GPT4_REGEX = regex.compile(GPT4_SPLIT_PATTERN)

SPECIAL_TOKENS: dict[str, int] = {
    "<|endoftext|>": 100257,
    "<|im_start|>": 100258,
    "<|im_end|>": 100259,
}
_SPECIAL_BY_ID: dict[int, str] = {v: k for k, v in SPECIAL_TOKENS.items()}
_SPECIAL_SPLIT_REGEX = regex.compile(
    "(" + "|".join(regex.escape(tok) for tok in SPECIAL_TOKENS) + ")"
)

STARTER_CORPUS = """
Tokenization makes AI read! Large language models do not read characters one by one;
they split text into subword tokens using Byte-Pair Encoding (BPE).
Common words like "the", "and", "token", "model", "learning", "running", "playing",
"unbelievable", "tokenization", "embedding", "attention", "transformer" appear often.
Repeated suffixes like -ing, -tion, -ization, -ed, -er, -ly, -ment, -ness help
compress long words into meaningful subwords.

def tokenize_text(text: str, max_merges: int = 100) -> list[int]:
    # Encode UTF-8 bytes and merge frequent adjacent pairs
    raw_bytes = list(text.encode("utf-8"))
    for step in range(max_merges):
        if len(raw_bytes) < 2:
            break
    return raw_bytes

Numbers like 2026, 1024, 3.14159, and punctuation! Hello, world? Yes: "AI" (LLM).
Multilingual UTF-8 bytes: नमस्ते दुनिया, 안녕하세요, 🚀✨.
"""


def _format_bytes_hex(data: bytes) -> str:
    return " ".join(f"0x{b:02x}" for b in data)


def _bytes_preview(data: bytes) -> str:
    """Human-readable preview for raw UTF-8 byte sequences (handles partial UTF-8 cleanly)."""
    try:
        text = data.decode("utf-8")
        return text.replace(" ", "␣").replace("\n", "↵").replace("\t", "⇥")
    except UnicodeDecodeError:
        return "·".join(f"0x{b:02x}" for b in data)


def _split_special_and_chunks(text: str, use_regex: bool) -> list[dict]:
    """Split text into special-token segments and regular (or regex) chunks."""
    if not text:
        return []

    segments = _SPECIAL_SPLIT_REGEX.split(text)
    chunks: list[dict] = []
    byte_cursor = 0
    chunk_index = 0

    for seg in segments:
        if not seg:
            continue
        if seg in SPECIAL_TOKENS:
            seg_bytes = seg.encode("utf-8")
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "text": seg,
                    "is_special": True,
                    "byte_start": byte_cursor,
                    "byte_end": byte_cursor + len(seg_bytes),
                }
            )
            byte_cursor += len(seg_bytes)
            chunk_index += 1
        elif use_regex:
            for match in _GPT4_REGEX.finditer(seg):
                piece = match.group(0)
                if not piece:
                    continue
                piece_bytes = piece.encode("utf-8")
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "text": piece,
                        "is_special": False,
                        "byte_start": byte_cursor,
                        "byte_end": byte_cursor + len(piece_bytes),
                    }
                )
                byte_cursor += len(piece_bytes)
                chunk_index += 1
        else:
            seg_bytes = seg.encode("utf-8")
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "text": seg,
                    "is_special": False,
                    "byte_start": byte_cursor,
                    "byte_end": byte_cursor + len(seg_bytes),
                }
            )
            byte_cursor += len(seg_bytes)
            chunk_index += 1

    return chunks


def _count_adjacent_pairs(
    sequences: list[list[int]],
) -> Counter[tuple[int, int]]:
    counts: Counter[tuple[int, int]] = Counter()
    for seq in sequences:
        for i in range(len(seq) - 1):
            counts[(seq[i], seq[i + 1])] += 1
    return counts


def _merge_pair_in_sequence(
    seq: list[int], pair: tuple[int, int], new_id: int
) -> list[int]:
    if len(seq) < 2:
        return seq
    merged: list[int] = []
    i = 0
    left, right = pair
    n = len(seq)
    while i < n:
        if i < n - 1 and seq[i] == left and seq[i + 1] == right:
            merged.append(new_id)
            i += 2
        else:
            merged.append(seq[i])
            i += 1
    return merged


@dataclass
class EducationalBPETokenizer:
    """Educational Byte-Level BPE tokenizer with full trace and merge-tree support."""

    tokenizer_id: str = "default"
    name: str = "Educational BPE (Starter)"
    use_regex_default: bool = True
    merges: dict[tuple[int, int], int] = field(default_factory=dict)
    merge_history: list[dict] = field(default_factory=list)
    vocab: dict[int, bytes] = field(
        default_factory=lambda: {i: bytes([i]) for i in range(256)}
    )

    @property
    def vocab_size(self) -> int:
        return len(self.vocab) + len(SPECIAL_TOKENS)

    def _token_bytes(self, token_id: int) -> bytes:
        if token_id in _SPECIAL_BY_ID:
            return _SPECIAL_BY_ID[token_id].encode("utf-8")
        return self.vocab[token_id]

    def _token_preview(self, token_id: int) -> str:
        if token_id in _SPECIAL_BY_ID:
            return _SPECIAL_BY_ID[token_id]
        return _bytes_preview(self.vocab[token_id])

    def train(
        self,
        text: str,
        num_merges: int = 100,
        use_regex: bool = True,
    ) -> list[dict]:
        """Train BPE merges from scratch starting from raw UTF-8 bytes (0..255)."""
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.merges = {}
        self.merge_history = []
        self.use_regex_default = use_regex

        chunks = _split_special_and_chunks(text, use_regex=use_regex)
        sequences: list[list[int]] = [
            list(chunk["text"].encode("utf-8"))
            for chunk in chunks
            if not chunk["is_special"]
        ]
        initial_bytes = sum(len(seq) for seq in sequences)
        if initial_bytes == 0:
            return []

        for step in range(num_merges):
            pair_counts = _count_adjacent_pairs(sequences)
            if not pair_counts:
                break

            top_candidates_raw = pair_counts.most_common(8)
            best_pair, best_count = top_candidates_raw[0]
            if best_count < 2:
                break

            new_id = 256 + step
            merged_bytes = self.vocab[best_pair[0]] + self.vocab[best_pair[1]]
            self.vocab[new_id] = merged_bytes
            self.merges[best_pair] = new_id

            sequences = [
                _merge_pair_in_sequence(seq, best_pair, new_id) for seq in sequences
            ]
            current_tokens = sum(len(seq) for seq in sequences)

            top_candidates = [
                {
                    "pair": [p[0], p[1]],
                    "left_text": self._token_preview(p[0]),
                    "right_text": self._token_preview(p[1]),
                    "count": c,
                }
                for p, c in top_candidates_raw
            ]

            self.merge_history.append(
                {
                    "step": step,
                    "pair": [best_pair[0], best_pair[1]],
                    "new_id": new_id,
                    "count": best_count,
                    "merged_text": _bytes_preview(merged_bytes),
                    "merged_hex": _format_bytes_hex(merged_bytes),
                    "top_candidates": top_candidates,
                    "compression_ratio": round(initial_bytes / max(current_tokens, 1), 4),
                }
            )

        return self.merge_history

    def decode(self, token_ids: list[int]) -> str:
        """Losslessly decode a sequence of token IDs back to a UTF-8 string."""
        out_parts: list[str] = []
        byte_buf = bytearray()

        for tid in token_ids:
            if tid in _SPECIAL_BY_ID:
                if byte_buf:
                    out_parts.append(bytes(byte_buf).decode("utf-8", errors="replace"))
                    byte_buf.clear()
                out_parts.append(_SPECIAL_BY_ID[tid])
            else:
                byte_buf.extend(self.vocab[tid])

        if byte_buf:
            out_parts.append(bytes(byte_buf).decode("utf-8", errors="replace"))

        return "".join(out_parts)

    def _compute_pair_frequencies(
        self,
        active_ids: list[str],
        nodes_by_id: dict[str, dict],
        use_regex: bool,
    ) -> list[dict]:
        """Compute adjacent pair frequencies for the current active node sequence."""
        pair_counts: Counter[tuple[int, int]] = Counter()
        for i in range(len(active_ids) - 1):
            left_node = nodes_by_id[active_ids[i]]
            right_node = nodes_by_id[active_ids[i + 1]]
            if left_node["is_special"] or right_node["is_special"]:
                continue
            if use_regex and left_node["chunk_index"] != right_node["chunk_index"]:
                continue
            pair_counts[(left_node["token_id"], right_node["token_id"])] += 1

        return [
            {
                "pair": [pair[0], pair[1]],
                "left_text": self._token_preview(pair[0]),
                "right_text": self._token_preview(pair[1]),
                "count": count,
            }
            for pair, count in pair_counts.most_common(12)
        ]

    def encode_with_trace(
        self,
        text: str,
        use_regex: bool = True,
        max_merges: int | None = None,
    ) -> dict:
        """Encode text and return full byte, merge-step, merge-tree, and metric traces."""
        chunks = _split_special_and_chunks(text, use_regex=use_regex)

        raw_bytes: list[dict] = []
        nodes: list[dict] = []
        nodes_by_id: dict[str, dict] = {}
        active_node_ids: list[str] = []

        byte_counter = 0
        node_counter = 0

        for chunk in chunks:
            c_idx = chunk["chunk_index"]
            if chunk["is_special"]:
                tid = SPECIAL_TOKENS[chunk["text"]]
                c_bytes = chunk["text"].encode("utf-8")
                node_id = f"n_{node_counter}"
                node_counter += 1
                node = {
                    "node_id": node_id,
                    "token_id": tid,
                    "display_text": chunk["text"],
                    "bytes_hex": _format_bytes_hex(c_bytes),
                    "left_child_id": None,
                    "right_child_id": None,
                    "depth": 0,
                    "merge_step": None,
                    "byte_span": [chunk["byte_start"], chunk["byte_end"]],
                    "chunk_index": c_idx,
                    "is_leaf": True,
                    "is_special": True,
                }
                nodes.append(node)
                nodes_by_id[node_id] = node
                active_node_ids.append(node_id)
                for b in c_bytes:
                    raw_bytes.append(
                        {
                            "byte_index": byte_counter,
                            "value": b,
                            "hex": f"0x{b:02x}",
                            "char_preview": _bytes_preview(bytes([b])),
                            "chunk_index": c_idx,
                        }
                    )
                    byte_counter += 1
            else:
                c_bytes = chunk["text"].encode("utf-8")
                for b in c_bytes:
                    raw_bytes.append(
                        {
                            "byte_index": byte_counter,
                            "value": b,
                            "hex": f"0x{b:02x}",
                            "char_preview": _bytes_preview(bytes([b])),
                            "chunk_index": c_idx,
                        }
                    )
                    node_id = f"n_{node_counter}"
                    node_counter += 1
                    node = {
                        "node_id": node_id,
                        "token_id": b,
                        "display_text": _bytes_preview(bytes([b])),
                        "bytes_hex": f"0x{b:02x}",
                        "left_child_id": None,
                        "right_child_id": None,
                        "depth": 0,
                        "merge_step": None,
                        "byte_span": [byte_counter, byte_counter + 1],
                        "chunk_index": c_idx,
                        "is_leaf": True,
                        "is_special": False,
                    }
                    nodes.append(node)
                    nodes_by_id[node_id] = node
                    active_node_ids.append(node_id)
                    byte_counter += 1

        merge_steps: list[dict] = []
        merges_applied = 0

        while True:
            if max_merges is not None and merges_applied >= max_merges:
                break

            # Find the lowest-rank learned merge pair present in active_node_ids
            best_pair: tuple[int, int] | None = None
            best_new_id: int | None = None
            best_rank = float("inf")

            for i in range(len(active_node_ids) - 1):
                left_node = nodes_by_id[active_node_ids[i]]
                right_node = nodes_by_id[active_node_ids[i + 1]]
                if left_node["is_special"] or right_node["is_special"]:
                    continue
                if use_regex and left_node["chunk_index"] != right_node["chunk_index"]:
                    continue
                pair = (left_node["token_id"], right_node["token_id"])
                if pair in self.merges:
                    candidate_id = self.merges[pair]
                    if candidate_id < best_rank:
                        best_rank = candidate_id
                        best_pair = pair
                        best_new_id = candidate_id

            if best_pair is None or best_new_id is None:
                break

            top_pair_frequencies = self._compute_pair_frequencies(
                active_node_ids, nodes_by_id, use_regex=use_regex
            )

            next_active: list[str] = []
            i = 0
            occurrences = 0
            while i < len(active_node_ids):
                if i < len(active_node_ids) - 1:
                    left_node = nodes_by_id[active_node_ids[i]]
                    right_node = nodes_by_id[active_node_ids[i + 1]]
                    same_scope = (
                        not use_regex
                        or left_node["chunk_index"] == right_node["chunk_index"]
                    )
                    if (
                        not left_node["is_special"]
                        and not right_node["is_special"]
                        and same_scope
                        and (left_node["token_id"], right_node["token_id"]) == best_pair
                    ):
                        merged_bytes = self._token_bytes(best_new_id)
                        parent_id = f"n_{node_counter}"
                        node_counter += 1
                        parent_node = {
                            "node_id": parent_id,
                            "token_id": best_new_id,
                            "display_text": _bytes_preview(merged_bytes),
                            "bytes_hex": _format_bytes_hex(merged_bytes),
                            "left_child_id": left_node["node_id"],
                            "right_child_id": right_node["node_id"],
                            "depth": max(left_node["depth"], right_node["depth"]) + 1,
                            "merge_step": merges_applied,
                            "byte_span": [
                                left_node["byte_span"][0],
                                right_node["byte_span"][1],
                            ],
                            "chunk_index": left_node["chunk_index"],
                            "is_leaf": False,
                            "is_special": False,
                        }
                        nodes.append(parent_node)
                        nodes_by_id[parent_id] = parent_node
                        next_active.append(parent_id)
                        occurrences += 1
                        i += 2
                        continue

                next_active.append(active_node_ids[i])
                i += 1

            active_node_ids = next_active
            merged_bytes = self._token_bytes(best_new_id)
            merge_steps.append(
                {
                    "step_index": merges_applied,
                    "rule_rank": best_new_id - 256,
                    "pair": [best_pair[0], best_pair[1]],
                    "new_id": best_new_id,
                    "merged_text": _bytes_preview(merged_bytes),
                    "merged_hex": _format_bytes_hex(merged_bytes),
                    "occurrences": occurrences,
                    "top_pair_frequencies": top_pair_frequencies,
                    "active_node_ids": list(active_node_ids),
                }
            )
            merges_applied += 1

        final_tokens: list[dict] = []
        final_ids: list[int] = []
        for idx, nid in enumerate(active_node_ids):
            node = nodes_by_id[nid]
            tid = node["token_id"]
            final_ids.append(tid)
            final_tokens.append(
                {
                    "index": idx,
                    "token_id": tid,
                    "root_node_id": nid,
                    "text": node["display_text"],
                    "bytes_hex": node["bytes_hex"],
                    "byte_span": node["byte_span"],
                    "chunk_index": node["chunk_index"],
                    "is_special": node["is_special"],
                }
            )

        decoded_text = self.decode(final_ids)
        byte_count = len(raw_bytes)
        token_count = len(final_tokens)
        word_count = len(text.split())

        return {
            "tokenizer_id": self.tokenizer_id,
            "use_regex": use_regex,
            "chunks": chunks,
            "raw_bytes": raw_bytes,
            "merge_steps": merge_steps,
            "merge_tree": {
                "nodes": nodes,
                "root_node_ids": active_node_ids,
            },
            "final_tokens": final_tokens,
            "decoded_text": decoded_text,
            "is_lossless": decoded_text == text,
            "metrics": {
                "char_count": len(text),
                "byte_count": byte_count,
                "word_count": word_count,
                "token_count": token_count,
                "compression_ratio": round(byte_count / max(token_count, 1), 4),
                "fertility": round(token_count / max(word_count, 1), 4),
            },
        }

    def manual_merge(
        self,
        nodes: list[dict],
        sequence_node_ids: list[str],
        left_token_id: int,
        right_token_id: int,
        use_regex: bool = True,
    ) -> dict:
        """Perform a single user-triggered merge on the current active node sequence."""
        updated_nodes = [dict(n) for n in nodes]
        nodes_by_id = {n["node_id"]: n for n in updated_nodes}

        pair = (left_token_id, right_token_id)
        if pair in self.merges:
            new_token_id = self.merges[pair]
        else:
            max_existing = max(
                [n["token_id"] for n in updated_nodes if not n["is_special"]] + [255]
            )
            new_token_id = max(256 + len(self.merges), max_existing + 1)

        def _bytes_for_node(node: dict) -> bytes:
            hex_parts = node["bytes_hex"].split()
            return bytes(int(h, 16) for h in hex_parts)

        next_sequence: list[str] = []
        merges_applied = 0
        next_step = (
            max(
                [n["merge_step"] for n in updated_nodes if n["merge_step"] is not None]
                + [-1]
            )
            + 1
        )
        node_idx = len(updated_nodes)
        i = 0

        while i < len(sequence_node_ids):
            if i < len(sequence_node_ids) - 1:
                left_node = nodes_by_id[sequence_node_ids[i]]
                right_node = nodes_by_id[sequence_node_ids[i + 1]]
                same_scope = (
                    not use_regex
                    or left_node["chunk_index"] == right_node["chunk_index"]
                )
                if (
                    not left_node["is_special"]
                    and not right_node["is_special"]
                    and same_scope
                    and left_node["token_id"] == left_token_id
                    and right_node["token_id"] == right_token_id
                ):
                    merged_bytes = _bytes_for_node(left_node) + _bytes_for_node(right_node)
                    parent_id = f"n_manual_{node_idx}"
                    node_idx += 1
                    parent_node = {
                        "node_id": parent_id,
                        "token_id": new_token_id,
                        "display_text": _bytes_preview(merged_bytes),
                        "bytes_hex": _format_bytes_hex(merged_bytes),
                        "left_child_id": left_node["node_id"],
                        "right_child_id": right_node["node_id"],
                        "depth": max(left_node["depth"], right_node["depth"]) + 1,
                        "merge_step": next_step,
                        "byte_span": [
                            left_node["byte_span"][0],
                            right_node["byte_span"][1],
                        ],
                        "chunk_index": left_node["chunk_index"],
                        "is_leaf": False,
                        "is_special": False,
                    }
                    updated_nodes.append(parent_node)
                    nodes_by_id[parent_id] = parent_node
                    next_sequence.append(parent_id)
                    merges_applied += 1
                    i += 2
                    continue

            next_sequence.append(sequence_node_ids[i])
            i += 1

        # Compute fresh pair frequencies using node bytes_hex previews
        pair_counts: Counter[tuple[int, int]] = Counter()
        pair_labels: dict[tuple[int, int], tuple[str, str]] = {}
        for j in range(len(next_sequence) - 1):
            ln = nodes_by_id[next_sequence[j]]
            rn = nodes_by_id[next_sequence[j + 1]]
            if ln["is_special"] or rn["is_special"]:
                continue
            if use_regex and ln["chunk_index"] != rn["chunk_index"]:
                continue
            p = (ln["token_id"], rn["token_id"])
            pair_counts[p] += 1
            pair_labels[p] = (ln["display_text"], rn["display_text"])

        pair_frequencies = [
            {
                "pair": [p[0], p[1]],
                "left_text": pair_labels[p][0],
                "right_text": pair_labels[p][1],
                "count": c,
            }
            for p, c in pair_counts.most_common(12)
        ]

        return {
            "sequence_node_ids": next_sequence,
            "merge_tree": {
                "nodes": updated_nodes,
                "root_node_ids": next_sequence,
            },
            "pair_frequencies": pair_frequencies,
            "merges_applied": merges_applied,
            "new_token_id": new_token_id,
        }


class TokenizerRegistry:
    """In-memory registry holding the default starter tokenizer and up to 20 custom ones."""

    def __init__(self, max_custom: int = 20) -> None:
        self._max_custom = max_custom
        self._default = EducationalBPETokenizer(
            tokenizer_id="default",
            name="Educational BPE (Starter)",
        )
        self._default.train(STARTER_CORPUS, num_merges=100, use_regex=True)
        self._custom: OrderedDict[str, EducationalBPETokenizer] = OrderedDict()

    def get(self, tokenizer_id: str | None = None) -> EducationalBPETokenizer:
        if not tokenizer_id or tokenizer_id == "default":
            return self._default
        tok = self._custom.get(tokenizer_id)
        if tok is None:
            raise KeyError(f"Unknown tokenizer_id: {tokenizer_id}")
        self._custom.move_to_end(tokenizer_id)
        return tok

    def create_custom(
        self,
        corpus: str,
        num_merges: int = 100,
        use_regex: bool = True,
        name: str | None = None,
    ) -> EducationalBPETokenizer:
        tid = f"custom_{uuid.uuid4().hex[:8]}"
        tok = EducationalBPETokenizer(
            tokenizer_id=tid,
            name=name or f"Custom BPE ({tid})",
        )
        tok.train(corpus, num_merges=num_merges, use_regex=use_regex)
        self._custom[tid] = tok
        if len(self._custom) > self._max_custom:
            self._custom.popitem(last=False)
        return tok


tokenizer_registry = TokenizerRegistry()
