# TokenLens 3D

An interactive 3D LLM tokenizer learning studio for AI beginners with an Apple visionOS dark spatial glass aesthetic.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design system, 3D scene specifications, and Gemini Co-Pilot architecture.

---

## Features

- **3D Assembly Pipeline:** Trace text through **Pre-Tokenization → UTF-8 Bytes → Subwords → Token IDs → 3D Vector Space**, with cross-stage lineage highlighting and clickable 2-orb **Cosine Similarity Beams**.
- **Hands-On Manual Merge Lab:** Click adjacent 3D byte blocks (or top pairs) to mint your own token IDs (`256+`).
- **Explorable 3D Merge Tree:** Scrub or animate the bottom-up binary BPE merge forest with a **Live Pair-Frequency Inspector** and clickable child-node traversal.
- **Guided Visual Story:** 5-chapter interactive curriculum with auto-completing 3D micro-tasks.
- **Real LLM Comparison & Custom Trainer:** Compare `Educational BPE`, `GPT-4o (o200k)`, `GPT-4 (cl100k)`, and `HuggingFace BPE` side-by-side, or train a custom BPE tokenizer on your own corpus.
- **Ask Gemini Co-Pilot:** Chrome-style collapsible side panel with live workspace awareness and executable 3D scene actions (works offline in **Demo Mode**, or live with `gemini-4-hydrogen` + `gemini-embedding-2`).

---

## Quick Start (One Command)

```bash
./start.sh
```

Then open **http://127.0.0.1:5173** in your browser (API docs at **http://127.0.0.1:8010/docs**).

### Optional: Enable Live Gemini API

- **Option A (In-App):** Click the **Demo Mode** badge in the **Ask Gemini** panel and paste your Gemini API key (stored in `sessionStorage` only).
- **Option B (`.env`):** Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY=...`.

---

## Manual Development & Tests

```bash
# Backend tests
backend/.venv/bin/pytest backend/tests/ -v

# Frontend production build
cd frontend && npm run build
```
