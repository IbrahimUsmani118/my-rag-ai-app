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

# ChromaDB does not support Python 3.14+ (Pydantic v1). Use 3.12 or 3.11.
pick_python() {
  for cmd in python3.12 python3.11 python3; do
    if command -v "$cmd" >/dev/null 2>&1; then
      if "$cmd" -c "import sys; exit(0 if sys.version_info < (3, 14) else 1)" 2>/dev/null; then
        echo "$cmd"
        return
      fi
    fi
  done
  echo "python3"
}

# If existing venv is Python 3.14+, remove it so we can recreate with compatible Python
if [ -d "$VENV" ] && [ -x "$VENV/bin/python" ]; then
  if "$VENV/bin/python" -c "import sys; exit(0 if sys.version_info < (3, 14) else 1)" 2>/dev/null; then
    true
  else
    echo "Removing existing venv (Python 3.14+ is not compatible with ChromaDB)."
    rm -rf "$VENV"
  fi
fi

# 1. Create venv if missing (with Python < 3.14), then install/update dependencies
PYTHON=$(pick_python)
if ! "$PYTHON" -c "import sys; exit(0 if sys.version_info < (3, 14) else 1)" 2>/dev/null; then
  echo "ChromaDB does not support Python 3.14+. Install Python 3.12 or 3.11:"
  echo "  macOS: brew install python@3.12"
  echo "Then remove the old venv and re-run: rm -rf backend/.venv && npm run start"
  exit 1
fi
if [ ! -d "$VENV" ]; then
  echo "Creating backend venv with $PYTHON..."
  "$PYTHON" -m venv "$VENV" || { echo "Failed to create venv."; exit 1; }
fi
echo "Installing backend dependencies..."
"$VENV/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
echo "Backend venv ready."

# 2. Free port 8000 if something is still bound from a previous run
if command -v lsof >/dev/null 2>&1; then
  (lsof -ti :8000 | xargs kill -9 2>/dev/null) || true
fi

# 3. Start backend in background (must run from backend dir so main:app resolves)
echo "Starting backend on http://localhost:8000 ..."
(cd "$BACKEND_DIR" && "$VENV/bin/python" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for backend to be ready (or exit if it crashes)
echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ 2>/dev/null | grep -q 200; then
    echo "Backend is up."
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "Backend failed to start (process exited). Check the output above for Python errors."
    echo "Common fix: run from project root:  cd backend && .venv/bin/pip install -r requirements.txt"
    exit 1
  fi
  sleep 1
done
if ! curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ 2>/dev/null | grep -q 200; then
  echo "Backend did not respond in time. Check the output above for errors."
  exit 1
fi

# 4. Frontend deps (if needed) and build
echo "Installing frontend dependencies..."
npm install
echo "Building frontend..."
npm run build

# 5. Frontend dev server (foreground)
echo "Starting frontend on http://localhost:5173 ..."
npm run dev
