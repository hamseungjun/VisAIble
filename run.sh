#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/visaible"
PYTHON_BIN=""

find_python() {
  if command -v python3.12 >/dev/null 2>&1; then
    command -v python3.12
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
  echo "Python not found. Install Python first." >&2
  exit 1
}

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js and npm first." >&2
  exit 1
fi

PYTHON_BIN="$(find_python)"

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  echo "Creating virtual environment at $VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

echo "Installing backend dependencies"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$ROOT_DIR/backend/requirements.txt"

echo "Installing frontend dependencies"
(cd "$ROOT_DIR/frontend" && npm install)

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "Starting backend on http://127.0.0.1:8000"
(
  cd "$ROOT_DIR/backend"
  "$VENV_DIR/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

echo "Starting frontend on http://127.0.0.1:3000"
cd "$ROOT_DIR/frontend"
NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8000" \
npm run dev -- --hostname 127.0.0.1 --port 3000
