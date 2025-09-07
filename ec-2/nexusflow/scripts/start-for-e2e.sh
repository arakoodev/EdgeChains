#!/bin/bash
set -e

echo "🚀 Starting application and workers for E2E testing..."

# Start background workers
echo "👷 Starting workers..."
npm run workers &
WORKERS_PID=$!

# Start Next.js development server  
echo "⚡ Starting Next.js..."
npm run dev &
NEXTJS_PID=$!

echo "✅ Started processes:"
echo "👷 Workers PID: $WORKERS_PID"
echo "⚡ Next.js PID: $NEXTJS_PID"

# Wait for both processes
wait -n

# If one process exits, kill the other
echo "🛑 One process exited, stopping all..."
kill $WORKERS_PID $NEXTJS_PID 2>/dev/null || true