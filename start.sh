#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]]; then
  echo "Error: backend/.venv/bin/uvicorn not found. Please set up backend/.venv first." >&2
  exit 1
fi

BE_PID=""
FE_PID=""

cleanup() {
  echo ""
  echo "Shutting down TokenLens 3D..."
  if [[ -n "$FE_PID" ]] && kill -0 "$FE_PID" 2>/dev/null; then
    kill "$FE_PID" 2>/dev/null || true
    wait "$FE_PID" 2>/dev/null || true
  fi
  if [[ -n "$BE_PID" ]] && kill -0 "$BE_PID" 2>/dev/null; then
    kill "$BE_PID" 2>/dev/null || true
    wait "$BE_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

echo "Starting FastAPI backend on http://127.0.0.1:8010 ..."
(
  cd "$BACKEND_DIR"
  .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload
) &
BE_PID=$!

echo "Starting Vite frontend on http://127.0.0.1:5173 ..."
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host 127.0.0.1 --port 5173
) &
FE_PID=$!

echo ""
echo "=================================================="
echo "  TokenLens 3D ready at http://127.0.0.1:5173"
echo "  API Docs available at http://127.0.0.1:8010/docs"
echo "  Press Ctrl+C to stop both servers."
echo "=================================================="
echo ""

wait
