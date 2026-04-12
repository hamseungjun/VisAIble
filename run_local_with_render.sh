#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_URL="${NEXT_PUBLIC_COMPETITION_API_BASE_URL:-http://210.115.229.161:8001}"

find_python() {
  if [[ -x "$ROOT_DIR/visaible/bin/python" ]]; then
    echo "$ROOT_DIR/visaible/bin/python"
    return
  fi
  if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    echo "$ROOT_DIR/.venv/bin/python"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return
  fi
  if command -v python >/dev/null 2>&1; then
    command -v python
    return
  fi
  echo "Python not found." >&2
  exit 1
}

PYTHON_BIN="$(find_python)"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js and npm first." >&2
  exit 1
fi

echo "Starting local backend on http://127.0.0.1:8000"
echo "Using Render competition backend: $RENDER_URL"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

(
  cd "$ROOT_DIR/backend"
  "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

cd "$ROOT_DIR/frontend"
NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8000" \
NEXT_PUBLIC_COMPETITION_API_BASE_URL="$RENDER_URL" \
npm run dev -- --hostname 127.0.0.1 --port 3000
