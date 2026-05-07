#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$APP_ROOT/backend"
FRONTEND_DIR="$APP_ROOT/frontend"
RUNTIME_DIR="$APP_ROOT/runtime"
LOG_DIR="$APP_ROOT/logs"
BACKEND_VENV="$RUNTIME_DIR/backend-venv"
BACKEND_ENV="$BACKEND_DIR/.env.local"
FRONTEND_ENV="$FRONTEND_DIR/.env.local"
BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://127.0.0.1:3000"

step() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nVisAIble failed to start:\n%s\n' "$1" >&2
  printf '\nPress Enter to close this window.'
  read -r _ || true
  exit 1
}

read_env_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  local raw_line line name value
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line#$'\xef\xbb\xbf'}"
    line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [[ -n "$line" && "${line:0:1}" != "#" && "$line" == *"="* ]] || continue
    name="${line%%=*}"
    value="${line#*=}"
    name="$(printf '%s' "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [[ "$name" == "$key" ]]; then
      value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^["'\"'"']//;s/["'\"'"']$//')"
      printf '%s' "$value"
      return 0
    fi
  done < "$file"
}

read_required_setting() {
  local prompt="$1"
  local current="${2:-}"
  local value
  if [[ -n "$current" ]]; then
    printf '%s [%s]: ' "$prompt" "$current"
    read -r value
    value="${value:-$current}"
  else
    printf '%s: ' "$prompt"
    read -r value
  fi
  value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -n "$value" ]] || fail "$prompt is required."
  printf '%s' "$value"
}

ensure_command_line_tools() {
  if ! xcode-select -p >/dev/null 2>&1; then
    step "Installing Xcode Command Line Tools"
    xcode-select --install || true
    fail "Xcode Command Line Tools installation was requested. Finish the installer, then run VisAIble again."
  fi
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return
  fi
  fail "Homebrew is not installed. Install it from https://brew.sh, then run VisAIble again."
}

python_ok() {
  local candidate="$1"
  "$candidate" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.version_info >= (3, 12) else 1)
PY
}

get_python_command() {
  if command -v python3.12 >/dev/null 2>&1 && python_ok python3.12; then
    printf 'python3.12'
    return
  fi
  if command -v python3 >/dev/null 2>&1 && python_ok python3; then
    printf 'python3'
    return
  fi
}

ensure_python() {
  local python_cmd
  python_cmd="$(get_python_command || true)"
  if [[ -n "$python_cmd" ]]; then
    printf '%s' "$python_cmd"
    return
  fi

  ensure_homebrew
  step "Installing Python 3.12"
  brew install python@3.12
  python_cmd="$(get_python_command || true)"
  [[ -n "$python_cmd" ]] || fail "Python 3.12 was installed, but python3.12 was not found on PATH."
  printf '%s' "$python_cmd"
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return
  fi
  ensure_homebrew
  step "Installing Node.js"
  brew install node
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 || fail "Node.js was installed, but node/npm was not found on PATH."
}

ensure_configuration() {
  step "Configuration"
  printf 'Press Enter to keep an existing value.\n'

  local current_key current_competition_url gemini_key competition_backend_url
  current_key="$(read_env_value "$BACKEND_ENV" "GOOGLE_API_KEY")"
  if [[ -z "$current_key" ]]; then
    current_key="$(read_env_value "$BACKEND_ENV" "GEMINI_API_KEY")"
  fi
  current_competition_url="$(read_env_value "$FRONTEND_ENV" "NEXT_PUBLIC_COMPETITION_API_BASE_URL")"

  gemini_key="$(read_required_setting "Gemini API Key" "$current_key")"
  competition_backend_url="$(read_required_setting "Competition Backend URL" "$current_competition_url")"
  competition_backend_url="${competition_backend_url%/}"

  cat > "$BACKEND_ENV" <<EOF
GOOGLE_API_KEY=$gemini_key
GEMINI_MODEL=gemini-3-flash-preview
EOF

  cat > "$FRONTEND_ENV" <<EOF
NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL
NEXT_PUBLIC_COMPETITION_API_BASE_URL=$competition_backend_url
EOF
}

ensure_backend_dependencies() {
  mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
  local python_cmd
  python_cmd="$(ensure_python)"

  if [[ ! -x "$BACKEND_VENV/bin/python" ]]; then
    step "Creating backend virtual environment"
    "$python_cmd" -m venv "$BACKEND_VENV"
  fi

  step "Installing backend packages"
  "$BACKEND_VENV/bin/python" -m pip install --upgrade pip
  PIP_PREFER_BINARY=1 "$BACKEND_VENV/bin/python" -m pip install --prefer-binary -r "$BACKEND_DIR/requirements.txt"
}

ensure_frontend_dependencies() {
  ensure_node
  step "Installing frontend packages"
  cd "$FRONTEND_DIR"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
}

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
  fi
}

start_visaible() {
  stop_port 8000
  stop_port 3000

  step "Starting backend on 8000"
  (
    cd "$BACKEND_DIR"
    "$BACKEND_VENV/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  ) > "$LOG_DIR/backend.log" 2> "$LOG_DIR/backend-error.log" &

  step "Starting frontend on 3000"
  (
    cd "$FRONTEND_DIR"
    npm run dev -- --hostname 127.0.0.1 --port 3000
  ) > "$LOG_DIR/frontend.log" 2> "$LOG_DIR/frontend-error.log" &

  sleep 3
  open "$FRONTEND_URL"
}

main() {
  printf 'VisAIble macOS launcher\n'
  printf 'Install path: %s\n' "$APP_ROOT"
  ensure_command_line_tools
  ensure_configuration
  ensure_backend_dependencies
  ensure_frontend_dependencies
  start_visaible
  printf '\nVisAIble is running at %s\n' "$FRONTEND_URL"
  printf 'Logs are saved in %s\n' "$LOG_DIR"
  printf 'You can close this window.\n'
}

main || fail "Unexpected launcher error."
