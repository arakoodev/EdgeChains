#!/bin/bash
set -e

echo "🚀 Starting NexusFlow All-in-One Container..."

# Create persistent data directory
mkdir -p /tmp/nexusflow-persistent

# Stop any existing containers
docker stop nexusflow-allinone 2>/dev/null || true
docker rm nexusflow-allinone 2>/dev/null || true

# Run the container with persistent data
docker run -d \
  --name nexusflow-allinone \
  -p 3000:3000 \
  -v /tmp/nexusflow-persistent:/tmp/nexusflow-data \
  -v "$(pwd)":/app \
  nexusflow-allinone

echo "✅ Container started!"
echo "📊 PostgreSQL data: /tmp/nexusflow-persistent/postgres"  
echo "🔴 Redis data: /tmp/nexusflow-persistent/redis"
echo "📝 Logs: /tmp/nexusflow-persistent/logs"
echo "🌐 Frontend: http://localhost:3000"
echo ""
echo "📋 Useful commands:"
echo "  docker logs -f nexusflow-allinone  # View logs"
echo "  docker exec -it nexusflow-allinone sh  # Shell access"  
echo "  docker stop nexusflow-allinone  # Stop container"