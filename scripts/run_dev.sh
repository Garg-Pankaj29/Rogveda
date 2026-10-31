#!/usr/bin/env bash
# ==============================================================================
# ROGVEDA — Local Development Startup Script
# Starts both FastAPI backend (127.0.0.1:8000) and Vite frontend (127.0.0.1:5173).
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "=================================================="
echo " Starting ROGVEDA Local Development Environment"
echo "=================================================="

# Function to clean up child processes on exit
cleanup() {
    echo ""
    echo "Stopping Rogveda dev servers..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Backend API
echo "Starting FastAPI backend on http://127.0.0.1:8000..."
cd "$BACKEND_DIR"

if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
    source "$PROJECT_ROOT/.venv/bin/activate"
fi

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Wait briefly for backend to come up
for i in {1..15}; do
    if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
        echo "Backend is healthy!"
        break
    fi
    sleep 0.5
done

# 2. Start Frontend Dev Server
echo "Starting Vite frontend on http://127.0.0.1:5173..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo " Rogveda is running!"
echo " Backend:  http://127.0.0.1:8000"
echo " Frontend: http://127.0.0.1:5173"
echo " LM Studio: http://127.0.0.1:1234"
echo " Press Ctrl+C to stop both servers."
echo "=================================================="

wait

