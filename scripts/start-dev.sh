#!/usr/bin/env bash
set -e

# Run from project root (parent of scripts/)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

BACKEND_DIR="$PROJECT_ROOT/backend"
VENV="$BACKEND_DIR/.venv"
BACKEND_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Stopping backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup EXIT INT TERM

# 1. Ensure backend venv exists and install dependencies
echo "Setting up backend venv..."
if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
  echo "Created $VENV"
fi
"$VENV/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
echo "Backend dependencies OK."

# 2. Start backend in background (must run from backend dir so main:app resolves)
echo "Starting backend on http://localhost:8000 ..."
(cd "$BACKEND_DIR" && "$VENV/bin/python" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Give backend a moment to bind
sleep 2

# 3. Frontend build
echo "Building frontend..."
npm run build

# 4. Frontend dev server (foreground)
echo "Starting frontend on http://localhost:5173 ..."
npm run dev
