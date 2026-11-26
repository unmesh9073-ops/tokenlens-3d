"""Context-aware Ask Gemini Co-Pilot with live google-genai tool-calling and rich Demo Mode."""

from __future__ import annotations

import json
import os
from typing import Any

from google import genai
from google.genai import types

from app.schemas import CopilotAction, CopilotMessage, WorkspaceContext

_ALLOWED_DIAGRAMS = {"pipeline", "tree"}
_ALLOWED_LAB_MODES = {"auto", "manual"}
_ALLOWED_CAMERA_PRESETS = {
    "overview",
    "bytes",
    "subwords",
    "ids",
    "vectors",
    "forest",
    "leaves",
    "roots",
    "focus",
}

_SYSTEM_INSTRUCTION = """You are the TokenLens 3D Co-Pilot, a warm, crystal-clear AI tokenizer tutor for beginners.
Rules:
1. Lead directly with the answer—never use filler like "Great question!" or "Sure!".
2. Use short, scannable paragraphs, concrete analogies, and inline monospace formatting (`#256`, `0x54`) referencing the learner's exact live text, tokens, and metrics from WorkspaceContext.
3. Proactively call 1 to 3 frontend 3D scene tools whenever showing something visually helps (e.g. zooming to `bytes` for emojis, switching to `tree` and playing merges for BPE, or toggling `set_use_regex` to show punctuation boundaries).
4. Keep explanations beginner-friendly with zero unnecessary jargon."""


def _build_gemini_tools() -> list[types.Tool]:
    """Declare the 9 validated frontend 3D scene tools for Gemini function calling."""
    decls = [
        types.FunctionDeclaration(
            name="set_input_text",
            description="Load an example sentence into the studio input box.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to tokenize in 3D."}
                },
                "required": ["text"],
            },
        ),
        types.FunctionDeclaration(
            name="switch_diagram",
            description="Switch between the 3D Assembly Pipeline and the 3D Merge Tree.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "diagram": {"type": "string", "enum": ["pipeline", "tree"]}
                },
                "required": ["diagram"],
            },
        ),
        types.FunctionDeclaration(
            name="set_use_regex",
            description="Toggle GPT-4 regex pre-tokenization ON or OFF.",
            parameters_json_schema={
                "type": "object",
                "properties": {"enabled": {"type": "boolean"}},
                "required": ["enabled"],
            },
        ),
        types.FunctionDeclaration(
            name="set_lab_mode",
            description="Switch between automatic BPE and manual byte-merging lab.",
            parameters_json_schema={
                "type": "object",
                "properties": {"mode": {"type": "string", "enum": ["auto", "manual"]}},
                "required": ["mode"],
            },
        ),
        types.FunctionDeclaration(
            name="highlight_token",
            description="Select and highlight a specific token or merge-tree node across stages.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "token_index": {"type": "integer"},
                    "node_id": {"type": "string"},
                },
            },
        ),
        types.FunctionDeclaration(
            name="focus_camera",
            description="Smoothly glide the 3D camera to a preset angle.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "preset": {
                        "type": "string",
                        "enum": [
                            "overview",
                            "bytes",
                            "subwords",
                            "ids",
                            "vectors",
                            "forest",
                            "leaves",
                            "roots",
                            "focus",
                        ],
                    }
                },
                "required": ["preset"],
            },
        ),
        types.FunctionDeclaration(
            name="set_timeline_step",
            description="Jump to a BPE merge step or play/pause the 3D Merge Tree animation.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "step": {"type": "integer"},
                    "play": {"type": "boolean"},
                },
            },
        ),
        types.FunctionDeclaration(
            name="open_compare_sheet",
            description="Open or close the Real LLM Comparison drawer (GPT-4o, GPT-4, HF, Educational BPE).",
            parameters_json_schema={
                "type": "object",
                "properties": {"open": {"type": "boolean"}},
                "required": ["open"],
            },
        ),
        types.FunctionDeclaration(
            name="open_train_modal",
            description="Open or close the Custom BPE Tokenizer Trainer modal.",
            parameters_json_schema={
                "type": "object",
                "properties": {"open": {"type": "boolean"}},
                "required": ["open"],
            },
        ),
    ]
    return [types.Tool(function_declarations=decls)]


def _sanitize_action(name: str, raw_args: dict[str, Any] | None) -> CopilotAction | None:
    """Validate and normalize a tool call into a safe CopilotAction."""
    args = dict(raw_args or {})
    if name == "set_input_text" and isinstance(args.get("text"), str):
        return CopilotAction(name="set_input_text", args={"text": args["text"][:500]})
    if name == "switch_diagram" and args.get("diagram") in _ALLOWED_DIAGRAMS:
        return CopilotAction(name="switch_diagram", args={"diagram": args["diagram"]})
    if name == "set_use_regex" and isinstance(args.get("enabled"), bool):
        return CopilotAction(name="set_use_regex", args={"enabled": args["enabled"]})
    if name == "set_lab_mode" and args.get("mode") in _ALLOWED_LAB_MODES:
        return CopilotAction(name="set_lab_mode", args={"mode": args["mode"]})
    if name == "highlight_token":
        clean: dict[str, Any] = {}
        if isinstance(args.get("token_index"), int):
            clean["token_index"] = args["token_index"]
        if isinstance(args.get("node_id"), str):
            clean["node_id"] = args["node_id"]
        if clean:
            return CopilotAction(name="highlight_token", args=clean)
    if name == "focus_camera" and args.get("preset") in _ALLOWED_CAMERA_PRESETS:
        return CopilotAction(name="focus_camera", args={"preset": args["preset"]})
    if name == "set_timeline_step":
        clean_tl: dict[str, Any] = {}
        if isinstance(args.get("step"), int):
            clean_tl["step"] = max(0, args["step"])
        if isinstance(args.get("play"), bool):
            clean_tl["play"] = args["play"]
        if clean_tl:
            return CopilotAction(name="set_timeline_step", args=clean_tl)
    if name == "open_compare_sheet" and isinstance(args.get("open"), bool):
        return CopilotAction(name="open_compare_sheet", args={"open": args["open"]})
    if name == "open_train_modal" and isinstance(args.get("open"), bool):
        return CopilotAction(name="open_train_modal", args={"open": args["open"]})
    return None


def _default_follow_ups(context: WorkspaceContext) -> list[str]:
    chips: list[str] = []
    if context.selected_token:
        chips.append(f'Why is "{context.selected_token.text}" token #{context.selected_token.token_id}?')
    if context.active_diagram == "pipeline":
        chips.extend([
            "Animate how BPE merged this",
            "Show why emojis cost extra tokens",
            "Compare with GPT-4o",
        ])
    else:
        chips.extend([
            "Walk me through these 5 stages",
            "Show what happens with Regex OFF",
            "Let me merge bytes manually",
        ])
    return chips[:3]


def _run_demo_copilot(message: str, context: WorkspaceContext) -> dict:
    """Rich context-aware offline educational tutor returning real executable 3D actions."""
    q = message.lower().strip()
    metrics = context.metrics
    byte_count = metrics.byte_count if metrics else len(context.input_text.encode("utf-8"))
    token_count = metrics.token_count if metrics else len(context.tokens_preview)
    ratio = metrics.compression_ratio if metrics else round(byte_count / max(token_count, 1), 2)

    actions: list[CopilotAction] = []
    follow_ups = _default_follow_ups(context)

    # 1. Explain selected token
    if context.selected_token and any(
        kw in q for kw in ("selected", "why is", "this token", "token #", f"#{context.selected_token.token_id}")
    ):
        sel = context.selected_token
        if sel.is_special:
            reply = (
                f"**`{sel.text}`** (`#{sel.token_id}`) is a **special control token**. "
                f"It is matched intact before any byte-splitting or BPE merges happen, so it never fuses with neighboring words.\n\n"
                f"- Raw UTF-8 bytes: `{sel.bytes_hex}`"
            )
        elif sel.token_id is not None and sel.token_id < 256:
            reply = (
                f"**`{sel.text}`** (`#{sel.token_id}`) is an **unmerged UTF-8 byte leaf** (`{sel.bytes_hex}`). "
                f"Because its token ID is below `256`, no learned BPE rule merged it with a neighbor in this context."
            )
        else:
            reply = (
                f"**`{sel.text}`** (`#{sel.token_id}`) is a **merged subword token** built bottom-up from UTF-8 bytes (`{sel.bytes_hex}`). "
                f"Instead of reading letter-by-letter, the model treats this whole chunk as one unit."
            )
        actions = [
            CopilotAction(
                name="focus_camera",
                args={"preset": "focus" if context.active_diagram == "tree" else "subwords"},
            )
        ]
        return {
            "reply": reply,
            "mode": "demo",
            "model": "demo-tutor-v1",
            "actions": [a.model_dump() for a in actions],
            "follow_up_chips": [
                "Animate how BPE merged this",
                "Compare with GPT-4o",
                "Zoom into 3D Vectors",
            ],
        }

    # 2. Emojis / Hindi / non-English UTF-8 bytes
    if any(kw in q for kw in ("emoji", "rocket", "hindi", "non-english", "unicode", "utf-8", "byte", "hex")):
        reply = (
            "Computers store text as **UTF-8 bytes** (`0–255`), not letters. While an English letter like `A` takes **1 byte**, "
            "an emoji like `🚀` takes **4 UTF-8 bytes** (`0xf0 0x9f 0x9a 0x80`) and Hindi characters take **3 bytes each**.\n\n"
            "I've loaded `AI loves rockets 🚀✨` and zoomed into **Stage 2 (UTF-8 Bytes)** so you can see multi-byte characters expand into multiple blocks!"
        )
        actions = [
            CopilotAction(name="set_input_text", args={"text": "AI loves rockets 🚀✨"}),
            CopilotAction(name="switch_diagram", args={"diagram": "pipeline"}),
            CopilotAction(name="focus_camera", args={"preset": "bytes"}),
        ]
        follow_ups = ["Compare with GPT-4o", "Animate how BPE merged this", "Walk me through these 5 stages"]

    # 3. Animate BPE merges in 3D Merge Tree
    elif any(kw in q for kw in ("animate", "merge", "tree", "how does bpe", "step", "forest")):
        reply = (
            f"Byte-Pair Encoding (BPE) starts at **Depth 0** with raw UTF-8 bytes and repeatedly merges the most frequent adjacent pair into a new token ID (`256+`).\n\n"
            f"I've switched to the **3D Merge Tree** and started the timeline from **Step 0** so you can watch `{context.input_text}` assemble bottom-up!"
        )
        actions = [
            CopilotAction(name="switch_diagram", args={"diagram": "tree"}),
            CopilotAction(name="set_lab_mode", args={"mode": "auto"}),
            CopilotAction(name="set_timeline_step", args={"step": 0, "play": True}),
            CopilotAction(name="focus_camera", args={"preset": "forest"}),
        ]
        follow_ups = ["Show what happens with Regex OFF", "Let me merge bytes manually", "Walk me through these 5 stages"]

    # 4. Regex pre-tokenization toggle
    elif any(kw in q for kw in ("regex", "trap", "punctuation", "boundary", "space")):
        target_regex = False if context.use_regex else True
        state_word = "OFF" if not target_regex else "ON"
        reply = (
            f"Without regex pre-tokenization, BPE would happily merge `dog.` and `dog!` into **different** tokens just because of punctuation.\n\n"
            f"I've loaded `dog. dog! dog? <|endoftext|>` and toggled **Regex Split {state_word}** so you can see how chunk boundaries protect word roots while keeping `<|endoftext|>` intact."
        )
        actions = [
            CopilotAction(name="set_input_text", args={"text": "dog. dog! dog? <|endoftext|>"}),
            CopilotAction(name="set_use_regex", args={"enabled": target_regex}),
            CopilotAction(name="focus_camera", args={"preset": "overview" if context.active_diagram == "pipeline" else "forest"}),
        ]
        follow_ups = ["Compare with GPT-4o", "Let me merge bytes manually", "Animate how BPE merged this"]

    # 5. Compare real LLMs
    elif any(kw in q for kw in ("compare", "gpt-4", "gpt4", "huggingface", "o200k", "cl100k")):
        reply = (
            f"Different LLMs have different vocabulary sizes—GPT-4o (`o200k_base`, 200k tokens) compresses text much more aggressively than older or smaller vocabularies.\n\n"
            f"I've opened the **Real LLM Comparison** drawer for `{context.input_text}` so you can compare token counts and fertility side-by-side."
        )
        actions = [CopilotAction(name="open_compare_sheet", args={"open": True})]
        follow_ups = ["Show why emojis cost extra tokens", "Train my own custom tokenizer", "Zoom into 3D Vectors"]

    # 6. Manual merge lab
    elif any(kw in q for kw in ("manual", "myself", "hand", "build", "break")):
        reply = (
            "In **Manual Merge Mode**, you act as the BPE algorithm! Click any two adjacent green-highlighted blocks in Stage 3 (or click a top pair in the Live Adjacent Pairs card) to mint a brand-new token ID."
        )
        actions = [
            CopilotAction(name="set_lab_mode", args={"mode": "manual"}),
            CopilotAction(name="focus_camera", args={"preset": "subwords" if context.active_diagram == "pipeline" else "leaves"}),
        ]
        follow_ups = ["Animate how BPE merged this", "Train my own custom tokenizer", "Walk me through these 5 stages"]

    # 7. Vector space / embeddings
    elif any(kw in q for kw in ("vector", "embedding", "pca", "cosine", "similarity", "stage 5")):
        reply = (
            "Once text becomes integer **Token IDs** (Stage 4), the LLM looks up a high-dimensional vector for each ID. "
            "Stage 5 projects those vectors into **3D space** using PCA.\n\n"
            "Click any two glowing orbs inside the cube to draw a **Cosine Similarity Beam**!"
        )
        actions = [
            CopilotAction(name="switch_diagram", args={"diagram": "pipeline"}),
            CopilotAction(name="focus_camera", args={"preset": "vectors"}),
        ]
        follow_ups = ["Compare with GPT-4o", "Walk me through these 5 stages", "Animate how BPE merged this"]

    # 8. Custom training
    elif any(kw in q for kw in ("train", "custom", "corpus")):
        reply = (
            "You can train your own mini BPE tokenizer on any text! I've opened the **Train Custom BPE** modal—paste a paragraph or code snippet and watch it learn custom merge rules."
        )
        actions = [CopilotAction(name="open_train_modal", args={"open": True})]
        follow_ups = ["Walk me through these 5 stages", "Compare with GPT-4o"]

    # 9. Default: Walk through current workspace state
    else:
        preview_str = ", ".join(
            f"`{t.text}` (`#{t.token_id}`)" for t in context.tokens_preview[:6]
        )
        if len(context.tokens_preview) > 6:
            preview_str += f", … (+{len(context.tokens_preview) - 6} more)"
        reply = (
            f"Right now **`{context.input_text}`** encodes into **{byte_count} UTF-8 bytes** and compresses into **{token_count} tokens** "
            f"(**{ratio:.2f}×** compression).\n\n"
            f"- **Active tokens:** {preview_str or 'none'}\n"
            f"- **Regex Pre-Tokenization:** `{'ON' if context.use_regex else 'OFF'}`\n\n"
            f"Click any block in the 3D scene to trace its lineage from raw bytes to 3D vectors!"
        )
        actions = [
            CopilotAction(
                name="focus_camera",
                args={"preset": "overview" if context.active_diagram == "pipeline" else "forest"},
            )
        ]

    return {
        "reply": reply,
        "mode": "demo",
        "model": "demo-tutor-v1",
        "actions": [a.model_dump() for a in actions],
        "follow_up_chips": follow_ups,
    }


def _serialize_context(context: WorkspaceContext) -> str:
    return json.dumps(context.model_dump(), ensure_ascii=False)


def run_copilot_chat(
    message: str,
    history: list[CopilotMessage],
    context: WorkspaceContext,
    api_key_override: str | None = None,
) -> dict:
    """Run Ask Gemini Co-Pilot (live google-genai with tool calling, or rich Demo Mode)."""
    api_key = (api_key_override or os.getenv("GEMINI_API_KEY", "")).strip()
    chat_model = os.getenv("GEMINI_CHAT_MODEL", "gemini-4-hydrogen").strip() or "gemini-4-hydrogen"

    if not api_key:
        return _run_demo_copilot(message, context)

    try:
        client = genai.Client(api_key=api_key)
        tools = _build_gemini_tools()
        config = types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            tools=tools,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            temperature=0.4,
        )

        contents: list[types.Content] = []
        for msg in history[-8:]:
            role = "user" if msg.role == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg.content)])
            )

        user_prompt = (
            f"Active WorkspaceContext JSON:\n```json\n{_serialize_context(context)}\n```\n\n"
            f"Learner question: {message}"
        )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
        )

        response = client.models.generate_content(
            model=chat_model,
            contents=contents,
            config=config,
        )

        actions: list[CopilotAction] = []
        if response.function_calls:
            for fc in response.function_calls:
                sanitized = _sanitize_action(fc.name, dict(fc.args or {}))
                if sanitized:
                    actions.append(sanitized)

        reply_text = (response.text or "").strip()

        # If Gemini emitted only function calls with no text, send tool acks to get a crisp explanation
        if not reply_text and response.function_calls:
            model_content = response.candidates[0].content if response.candidates else None
            if model_content:
                ack_parts = [
                    types.Part.from_function_response(
                        name=fc.name,
                        response={"status": "executed_on_frontend", "args": dict(fc.args or {})},
                    )
                    for fc in response.function_calls
                ]
                follow_contents = [
                    *contents,
                    model_content,
                    types.Content(role="user", parts=ack_parts),
                ]
                follow_resp = client.models.generate_content(
                    model=chat_model,
                    contents=follow_contents,
                    config=config,
                )
                reply_text = (follow_resp.text or "").strip()

        if not reply_text:
            reply_text = "I've updated the 3D studio view for you—inspect the highlighted elements on stage."

        return {
            "reply": reply_text,
            "mode": "live",
            "model": chat_model,
            "actions": [a.model_dump() for a in actions],
            "follow_up_chips": _default_follow_ups(context),
            "warning": None,
        }
    except Exception as exc:
        demo = _run_demo_copilot(message, context)
        demo["warning"] = f"Live Gemini unavailable ({type(exc).__name__}); using Demo Mode."
        return demo
