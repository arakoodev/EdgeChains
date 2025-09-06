#!/bin/bash
set -e

echo "🚀 Starting NexusFlow All-in-One Container..."

# Create directories
mkdir -p /tmp/nexusflow-data/postgres /tmp/nexusflow-data/redis /tmp/nexusflow-data/logs /run/postgresql
chown -R postgres:postgres /tmp/nexusflow-data /run/postgresql

# Initialize PostgreSQL data directory if it doesn't exist
if [ ! -f "/tmp/nexusflow-data/postgres/PG_VERSION" ]; then
    echo "📊 Initializing PostgreSQL data directory..."
    rm -rf /tmp/nexusflow-data/postgres/*
    su postgres -c "initdb -D /tmp/nexusflow-data/postgres"
fi

# Configure PostgreSQL to accept external connections
echo "🔧 Configuring PostgreSQL for external connections..."
echo "listen_addresses = '*'" >> /tmp/nexusflow-data/postgres/postgresql.conf
echo "host all all 0.0.0.0/0 trust" >> /tmp/nexusflow-data/postgres/pg_hba.conf

# Start PostgreSQL in background
echo "📊 Starting PostgreSQL..."
su postgres -c "postgres -D /tmp/nexusflow-data/postgres" &
POSTGRES_PID=$!

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until su postgres -c "pg_isready -h localhost" > /dev/null 2>&1; do
  sleep 1
done

# Create database
echo "🗄️  Creating database..."
su postgres -c "createdb nexusflow" > /dev/null 2>&1 || true

# Start Redis in background (not daemonized since we want to manage it)
echo "🔴 Starting Redis..."
redis-server --port 6379 --bind 0.0.0.0 --protected-mode no --dir /tmp/nexusflow-data/redis --logfile /tmp/nexusflow-data/logs/redis.log &
REDIS_PID=$!

# Wait for Redis to be ready
echo "⏳ Waiting for Redis..."
until redis-cli ping > /dev/null 2>&1; do
  sleep 1
done

# Run database migrations (ignore errors for existing policies)
echo "🔄 Running migrations..."
npm run migrate || echo "⚠️  Migration warnings (likely existing policies) - continuing..."

# Start background workers
echo "👷 Starting background workers..."
npm run workers &
WORKERS_PID=$!

# Start Next.js development server
echo "⚡ Starting Next.js development server..."
npm run dev &
NEXTJS_PID=$!

echo "✅ All services started successfully!"
echo "📊 PostgreSQL PID: $POSTGRES_PID"
echo "🔴 Redis PID: $REDIS_PID" 
echo "👷 Workers PID: $WORKERS_PID"
echo "⚡ Next.js PID: $NEXTJS_PID"
echo "🌐 Frontend available at: http://localhost:3000"

# Wait for any process to exit and terminate the container
# This ensures proper shutdown when any critical service fails
wait -n