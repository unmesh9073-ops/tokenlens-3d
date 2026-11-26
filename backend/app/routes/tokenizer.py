"""FastAPI routes for BPE analysis, training, manual merges, LLM comparison, and 3D embeddings."""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.bpe_engine import tokenizer_registry
from app.embeddings import project_tokens_to_3d
from app.llm_compare import compare_tokenizers
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    CompareRequest,
    CompareResponse,
    EmbeddingProjectRequest,
    EmbeddingProjectResponse,
    ManualMergeRequest,
    ManualMergeResponse,
    TrainRequest,
    TrainResponse,
)

router = APIRouter(prefix="/api", tags=["tokenizer"])


@router.post("/bpe/analyze", response_model=AnalyzeResponse)
def analyze_bpe(req: AnalyzeRequest) -> dict:
    try:
        tok = tokenizer_registry.get(req.tokenizer_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return tok.encode_with_trace(
        text=req.text,
        use_regex=req.use_regex,
        max_merges=req.max_merges,
    )


@router.post("/bpe/train", response_model=TrainResponse)
def train_bpe(req: TrainRequest) -> dict:
    tok = tokenizer_registry.create_custom(
        corpus=req.corpus,
        num_merges=req.num_merges,
        use_regex=req.use_regex,
        name=req.name,
    )
    return {
        "tokenizer_id": tok.tokenizer_id,
        "name": tok.name,
        "vocab_size": tok.vocab_size,
        "use_regex": tok.use_regex_default,
        "merges_learned": len(tok.merge_history),
        "merge_history": tok.merge_history,
    }


@router.post("/bpe/manual-merge", response_model=ManualMergeResponse)
def manual_merge_bpe(req: ManualMergeRequest) -> dict:
    try:
        tok = tokenizer_registry.get(req.tokenizer_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    node_dicts = [n.model_dump() for n in req.nodes]
    return tok.manual_merge(
        nodes=node_dicts,
        sequence_node_ids=req.sequence_node_ids,
        left_token_id=req.left_token_id,
        right_token_id=req.right_token_id,
        use_regex=req.use_regex,
    )


@router.post("/compare", response_model=CompareResponse)
def compare_models(req: CompareRequest) -> dict:
    try:
        models = compare_tokenizers(
            text=req.text,
            tokenizer_id=req.tokenizer_id,
            use_regex=req.use_regex,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "text": req.text,
        "byte_count": len(req.text.encode("utf-8")),
        "models": models,
    }


@router.post("/embeddings/project", response_model=EmbeddingProjectResponse)
def project_embeddings(
    req: EmbeddingProjectRequest,
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
) -> dict:
    token_dicts = [t.model_dump() for t in req.tokens]
    return project_tokens_to_3d(token_dicts, api_key_override=x_gemini_api_key)
