"""Strict Pydantic v2 request and response schemas for TokenLens 3D."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=0, max_length=20000)
    tokenizer_id: str | None = Field(default="default")
    use_regex: bool = Field(default=True)
    max_merges: int | None = Field(default=None, ge=0, le=5000)


class ChunkItem(BaseModel):
    chunk_index: int
    text: str
    is_special: bool
    byte_start: int
    byte_end: int


class RawByteItem(BaseModel):
    byte_index: int
    value: int
    hex: str
    char_preview: str
    chunk_index: int


class PairFrequencyItem(BaseModel):
    pair: list[int] = Field(..., min_length=2, max_length=2)
    left_text: str
    right_text: str
    count: int


class MergeStepItem(BaseModel):
    step_index: int
    rule_rank: int
    pair: list[int] = Field(..., min_length=2, max_length=2)
    new_id: int
    merged_text: str
    merged_hex: str
    occurrences: int
    top_pair_frequencies: list[PairFrequencyItem]
    active_node_ids: list[str]


class MergeTreeNode(BaseModel):
    node_id: str
    token_id: int
    display_text: str
    bytes_hex: str
    left_child_id: str | None = None
    right_child_id: str | None = None
    depth: int
    merge_step: int | None = None
    byte_span: list[int] = Field(..., min_length=2, max_length=2)
    chunk_index: int
    is_leaf: bool
    is_special: bool


class MergeTree(BaseModel):
    nodes: list[MergeTreeNode]
    root_node_ids: list[str]


class FinalTokenItem(BaseModel):
    index: int
    token_id: int
    root_node_id: str
    text: str
    bytes_hex: str
    byte_span: list[int] = Field(..., min_length=2, max_length=2)
    chunk_index: int
    is_special: bool


class TokenizerMetrics(BaseModel):
    char_count: int
    byte_count: int
    word_count: int
    token_count: int
    compression_ratio: float
    fertility: float


class AnalyzeResponse(BaseModel):
    tokenizer_id: str
    use_regex: bool
    chunks: list[ChunkItem]
    raw_bytes: list[RawByteItem]
    merge_steps: list[MergeStepItem]
    merge_tree: MergeTree
    final_tokens: list[FinalTokenItem]
    decoded_text: str
    is_lossless: bool
    metrics: TokenizerMetrics


class TrainRequest(BaseModel):
    corpus: str = Field(..., min_length=1, max_length=100000)
    num_merges: int = Field(default=60, ge=1, le=1000)
    use_regex: bool = Field(default=True)
    name: str | None = Field(default=None, max_length=120)


class TrainMergeRecord(BaseModel):
    step: int
    pair: list[int] = Field(..., min_length=2, max_length=2)
    new_id: int
    count: int
    merged_text: str
    merged_hex: str
    top_candidates: list[PairFrequencyItem]
    compression_ratio: float


class TrainResponse(BaseModel):
    tokenizer_id: str
    name: str
    vocab_size: int
    use_regex: bool
    merges_learned: int
    merge_history: list[TrainMergeRecord]


class ManualMergeRequest(BaseModel):
    tokenizer_id: str | None = Field(default="default")
    nodes: list[MergeTreeNode]
    sequence_node_ids: list[str]
    left_token_id: int
    right_token_id: int
    use_regex: bool = Field(default=True)


class ManualMergeResponse(BaseModel):
    sequence_node_ids: list[str]
    merge_tree: MergeTree
    pair_frequencies: list[PairFrequencyItem]
    merges_applied: int
    new_token_id: int


class CompareRequest(BaseModel):
    text: str = Field(..., min_length=0, max_length=20000)
    tokenizer_id: str | None = Field(default="default")
    use_regex: bool = Field(default=True)


class CompareTokenItem(BaseModel):
    token_id: int
    text: str
    bytes_hex: str


class CompareModelResult(BaseModel):
    model_id: str
    display_name: str
    vocab_size: int
    tokens: list[CompareTokenItem]
    token_count: int
    fertility: float
    bytes_per_token: float
    compression_ratio: float
    encode_time_us: float
    is_fallback: bool


class CompareResponse(BaseModel):
    text: str
    byte_count: int
    models: list[CompareModelResult]


class EmbeddingTokenInput(BaseModel):
    index: int | None = None
    token_id: int = 0
    text: str


class EmbeddingProjectRequest(BaseModel):
    tokens: list[EmbeddingTokenInput]


class EmbeddingPoint3D(BaseModel):
    index: int
    token_id: int
    text: str
    x: float
    y: float
    z: float
    category: str


class EmbeddingSimilarity(BaseModel):
    source_index: int
    target_index: int
    similarity: float


class EmbeddingProjectResponse(BaseModel):
    source: Literal["gemini_live", "local_fallback"]
    model: str
    points: list[EmbeddingPoint3D]
    similarities: list[EmbeddingSimilarity]


# --- Phase 5: Ask Gemini Co-Pilot Schemas ---


class CopilotMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class CopilotMetricsContext(BaseModel):
    char_count: int = 0
    byte_count: int = 0
    token_count: int = 0
    compression_ratio: float = 1.0
    fertility: float = 1.0


class CopilotSelectedToken(BaseModel):
    index: int | None = None
    token_id: int | None = None
    text: str
    bytes_hex: str
    byte_span: list[int] | None = None
    is_special: bool = False
    depth: int | None = None


class CopilotTokenPreview(BaseModel):
    index: int
    token_id: int
    text: str
    bytes_hex: str


class WorkspaceContext(BaseModel):
    mode: Literal["playground", "guided"] = "playground"
    active_diagram: Literal["pipeline", "tree"] = "pipeline"
    input_text: str = ""
    use_regex: bool = True
    lab_mode: Literal["auto", "manual"] = "auto"
    active_tokenizer_id: str = "default"
    timeline_step: int = 0
    total_merge_steps: int = 0
    metrics: CopilotMetricsContext | None = None
    selected_token: CopilotSelectedToken | None = None
    tokens_preview: list[CopilotTokenPreview] = Field(default_factory=list)
    guided_chapter: str | None = None


class CopilotAction(BaseModel):
    name: Literal[
        "set_input_text",
        "switch_diagram",
        "set_use_regex",
        "set_lab_mode",
        "highlight_token",
        "focus_camera",
        "set_timeline_step",
        "open_compare_sheet",
        "open_train_modal",
    ]
    args: dict = Field(default_factory=dict)


class CopilotChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[CopilotMessage] = Field(default_factory=list)
    context: WorkspaceContext


class CopilotChatResponse(BaseModel):
    reply: str
    mode: Literal["live", "demo"]
    model: str
    actions: list[CopilotAction] = Field(default_factory=list)
    follow_up_chips: list[str] = Field(default_factory=list)
    warning: str | None = None
