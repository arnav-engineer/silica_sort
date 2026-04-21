#!/bin/bash

# Silica Sort Dashboard Launcher
# Starts both the FastAPI backend and the Vite frontend.

# Kill all background processes started by this script on exit
trap "kill 0" EXIT

echo "------------------------------------------------"
echo "🚀 Launching Silica Sort Performance Dashboard"
echo "------------------------------------------------"

# 1. Start Backend
echo "📡 Starting Backend (FastAPI)..."
uv run python dashboard/backend.py &
BACKEND_PID=$!

# 2. Start Frontend
echo "💻 Starting Frontend (Vite)..."
cd dashboard && npm run dev &
FRONTEND_PID=$!

echo "------------------------------------------------"
echo "✅ Dashboard is running!"
echo "   - Backend: http://localhost:8000"
echo "   - Frontend: See output below for URL"
echo "   Press Ctrl+C to stop both services."
echo "------------------------------------------------"

# Wait for processes
wait
