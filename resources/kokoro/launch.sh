#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${1:-${KOKORO_HOST:-127.0.0.1}}"
PORT="${2:-${KOKORO_PORT:-8880}}"
export KOKORO_HOST="$HOST"
export KOKORO_PORT="$PORT"
export HOST="$HOST"
export PORT="$PORT"
cd "$ROOT"
if [ -x "$ROOT/start-cpu.sh" ]; then
  exec "$ROOT/start-cpu.sh" "$HOST" "$PORT"
elif [ -f "$ROOT/start-cpu.sh" ]; then
  exec /bin/bash "$ROOT/start-cpu.sh" "$HOST" "$PORT"
fi
if [ -x "$ROOT/venv/bin/python" ]; then
  PYTHON="$ROOT/venv/bin/python"
elif [ -x "$ROOT/.venv/bin/python" ]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  echo "Kokoro runtime not found. Place start-cpu.sh or a Python venv in this folder. See README.md." >&2
  exit 1
fi
exec "$PYTHON" -m uvicorn api.src.main:app --host "$HOST" --port "$PORT"
