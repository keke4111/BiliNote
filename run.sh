#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_URL="http://127.0.0.1:8483"
FRONTEND_URL="http://localhost:3015"

cd "$ROOT"

log() {
  printf '[BiliNote] %s\n' "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[BiliNote] Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd python3
require_cmd ffmpeg

if ! command -v pnpm >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
  printf '[BiliNote] Missing pnpm or npm. Install Node.js first, then run: npm install -g pnpm\n' >&2
  exit 1
fi

if [ ! -f "$ROOT/.env" ]; then
  if [ ! -f "$ROOT/.env.example" ]; then
    printf '[BiliNote] Missing .env and .env.example\n' >&2
    exit 1
  fi
  cp "$ROOT/.env.example" "$ROOT/.env"
  log "Created .env from .env.example"
fi

if [ ! -f "$ROOT/backend/main.py" ]; then
  printf '[BiliNote] Missing backend/main.py\n' >&2
  exit 1
fi

if [ ! -f "$ROOT/BillNote_frontend/package.json" ]; then
  printf '[BiliNote] Missing BillNote_frontend/package.json\n' >&2
  exit 1
fi

cleanup() {
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

log "Starting backend on $BACKEND_URL ..."
(
  cd "$ROOT/backend"
  python3 main.py
) &
BACKEND_PID=$!

log "Waiting for backend health check ..."
BACKEND_READY=0
for _ in $(seq 1 60); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$BACKEND_URL/api/sys_check" >/dev/null 2>&1; then
      BACKEND_READY=1
      break
    fi
  else
    if python3 - "$BACKEND_URL/api/sys_check" >/dev/null 2>&1 <<'PY'
import sys
from urllib.request import urlopen
urlopen(sys.argv[1], timeout=2).read()
PY
    then
      BACKEND_READY=1
      break
    fi
  fi

  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    printf '[BiliNote] Backend exited before becoming ready. Check backend logs above.\n' >&2
    exit 1
  fi
  sleep 1
done

if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
  printf '[BiliNote] Backend is not running.\n' >&2
  exit 1
fi

if [ "$BACKEND_READY" != "1" ]; then
  printf '[BiliNote] Backend did not become ready within 60 seconds.\n' >&2
  exit 1
fi

log "Starting frontend. Open $FRONTEND_URL after Vite is ready."
cd "$ROOT/BillNote_frontend"
if command -v pnpm >/dev/null 2>&1; then
  pnpm dev
else
  npm run dev
fi
