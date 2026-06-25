#!/usr/bin/env bash
# Start nekarc — FastAPI backend (:3333) + React/Vite frontend (:2222).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$ROOT/.run"; mkdir -p "$RUN"
BACKEND="$ROOT/nekarc-backend-api"
FRONTEND="$ROOT/nekarc-frontend"

# ── Backend ──────────────────────────────────────────────
echo "▶ Backend setup…"
cd "$BACKEND"
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env
echo "▶ Starting backend → http://localhost:3333"
uvicorn app.main:app --reload --port 3333 --host 0.0.0.0 > "$RUN/backend.log" 2>&1 &
echo $! > "$RUN/backend.pid"
deactivate

# ── Frontend ─────────────────────────────────────────────
echo "▶ Frontend setup…"
cd "$FRONTEND"
[ -f .env ] || cp .env.example .env
[ -d node_modules ] || npm install
echo "▶ Starting frontend → http://localhost:2222"
npm run dev > "$RUN/frontend.log" 2>&1 &
echo $! > "$RUN/frontend.pid"

echo ""
echo "✅ nekarc is running"
echo "   Frontend   http://localhost:2222"
echo "   API docs   http://localhost:3333/docs"
echo "   Logs       .run/backend.log · .run/frontend.log"
echo "   Stop       ./stop.sh"
