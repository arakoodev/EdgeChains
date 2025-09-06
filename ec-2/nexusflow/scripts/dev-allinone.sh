#!/bin/bash
set -e

echo "🔧 Starting NexusFlow All-in-One Development Container..."

# Create persistent data directory
mkdir -p /tmp/nexusflow-persistent

# Stop any existing containers
docker stop nexusflow-allinone 2>/dev/null || true
docker rm nexusflow-allinone 2>/dev/null || true

# Run the container interactively with hot reload
docker run -it \
  --name nexusflow-allinone \
  -p 3000:3000 \
  -v /tmp/nexusflow-persistent:/tmp/nexusflow-data \
  -v "$(pwd)":/app \
  --workdir /app \
  nexusflow-allinone

echo "🔄 Development container stopped."