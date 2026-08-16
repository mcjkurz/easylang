#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load secrets from .env (never commit this file)
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
else
    echo "Missing .env — copy .env.example to .env and set API_KEY / API_BASE_URL"
    exit 1
fi

if [ -z "${API_KEY:-}${POE_API_KEY:-}" ]; then
    echo "API_KEY is not set in .env"
    exit 1
fi

if [ -z "${API_BASE_URL:-}" ]; then
    echo "Warning: API_BASE_URL is not set; the app will use its default."
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-6353}"

# Kill any existing process on the configured port
lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true

# Activate virtual environment
source venv/bin/activate

# One log file per app start (date/time stamped)
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/easylang_$(date +%Y-%m-%d_%H%M%S).log"
export EASYLANG_LOG="$LOG_FILE"

nohup python app.py >> "$LOG_FILE" 2>&1 &
echo "EasyLang started on http://${HOST}:${PORT}"
echo "Logging to $LOG_FILE"
