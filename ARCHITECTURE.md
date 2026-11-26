# TokenLens 3D — Architecture & Project Specification

**TokenLens 3D** is an interactive 3D LLM tokenizer learning studio for AI beginners, crafted with an Apple visionOS dark spatial glass aesthetic.

---

## 1. Design System (Apple visionOS Spatial Dark Glass)

- **Canvas & Ambient Lighting:**
  - Deep obsidian canvas background (`#06070B`) with subtle radial ambient lighting so 3D geometry and glass panels have natural depth without harsh contrast.
- **Translucent Spatial Glass Panels:**
  - Frosted glass surfaces using `backdrop-blur-2xl`, `bg-white/[0.06]`, hairline borders `border-white/[0.12]`, and a subtle inner top specular highlight (`border-t border-white/[0.18]` / top inset highlight) to convey physical material thickness.
  - Material hierarchy: darker/heavier translucency for structural chrome and sidebars; lighter translucency for interactive controls and floating pills. Never stack light translucent surfaces directly on top of one another.
- **Typography:**
  - UI & display: Apple-style system font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif`) with size-specific tracking (tighter negative tracking on large display headings, neutral/positive tracking on small labels) and inverse leading.
  - Technical data (UTF-8 bytes, hex values, token IDs, merge ranks): monospaced font stack (`"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) with tabular numerals.
- **Motion & Accessibility:**
  - Fluid, interruptible spring physics via Motion / Framer Motion (`motion/react`), animating compositor-only properties (`transform` and `opacity`) for 60/120fps performance.
  - Critically damped defaults (`bounce: 0`, `duration: 0.35–0.4`) for UI panels; subtle bounce (`~0.2`) reserved for momentum-driven or 3D-linked physical interactions.
  - Instant pointer-down press feedback (`scale(0.97)`), symmetric enter/exit paths, and trigger-anchored origins.
  - Full support for:
    - `prefers-reduced-motion: reduce` (replaces spatial slides/springs with short opacity cross-fades; disables continuous 3D/parallax motion).
    - `prefers-reduced-transparency: reduce` (increases surface opacity and removes `backdrop-blur` for high legibility).
    - `prefers-contrast: more` (higher-contrast borders and solid/near-solid surfaces).

---

## 2. Core Interactive 3D Scenes (Phases 3 & 4)

Built with **React Three Fiber v9** (`@react-three/fiber` + `@react-three/drei` + `three`) inside a full-viewport `<Canvas>` with `OrbitControls`, tone mapping, and adaptive DPR (`dpr={[1, 2]}`).

1. **3D Assembly Pipeline (Phase 3):**
   - Visualizes the end-to-end tokenization pipeline in 3D space:
     **Text → UTF-8 Bytes → Subwords → Token IDs → 3D Vector Space**
   - Supports **manual adjacent byte-block merging** so learners can interactively combine bytes into subword tokens.
   - Includes a **regex pre-tokenization toggle** (e.g., GPT-style whitespace/punctuation splitting) to show how pre-tokenization constrains which bytes are allowed to merge.
   - Final stage projects token embeddings into an interactive 3D vector space (PCA/UMAP-reduced coordinates).

2. **Explorable 3D Merge Tree (Phase 4):**
   - Renders a **bottom-up binary BPE merge forest** from initial UTF-8 byte leaves up to final subword root nodes.
   - Includes a **timeline scrubber** to step forward/backward through BPE merge ranks.
   - Includes a **live pair-frequency inspector** showing candidate adjacent pairs, merge priority/rank, and frequency counts at the active step.

---

## 3. Ask Gemini Co-Pilot (Phase 5)

- **UI:** Chrome-style collapsible right side panel (`backdrop-blur-2xl` spatial glass) that reads the active workspace state (input text, selected tokenizer, active 3D scene, selected node/token, merge step, pre-tokenization setting).
- **Frontend Actions (Tool Calling):** Executes structured UI actions on the studio, including:
  - Highlighting specific 3D nodes or byte blocks
  - Stepping BPE merges forward/backward or jumping to a merge rank
  - Switching between `3D Assembly Pipeline` and `Explorable 3D Merge Tree`
  - Loading curated beginner examples
- **Backend SDK & Models:**
  - Uses the official **`google-genai`** Python SDK (`>= 3.2.0`, `Interactions API`).
  - Chat & tool-calling model: **`gemini-4-hydrogen`** *(per `gemini-api-dev` skill guidelines; substitutes for `gemini-3.8-flash`)*.
  - Live embeddings model: **`gemini-embedding-2`** via `client.models.embed_content`.
  - **Offline Demo Fallback:** When `GEMINI_API_KEY` is not configured, the backend provides a deterministic, rich offline demo co-pilot fallback so all studio features and tool-calling demos work out of the box.

---

## 4. Monorepo Layout & Local Dev Ports

```text
tokenlens-3d/
├── ARCHITECTURE.md          # Project rules, design system & architecture spec
├── backend/                 # Python FastAPI service (port 8010)
│   ├── .venv/               # Local Python virtual environment
│   ├── .env.example         # Environment variable template
│   ├── requirements.txt     # Backend Python dependencies
│   └── ...
└── frontend/                # Vite + React 19 + TypeScript + Tailwind + R3F v9 (port 5173)
    └── ...                  # Proxies `/api` -> `http://127.0.0.1:8010`
```

- **Backend:** FastAPI + Uvicorn running on `http://127.0.0.1:8010`
- **Frontend:** Vite dev server running on `http://localhost:5173`, configured with `/api` proxy to `http://127.0.0.1:8010`
