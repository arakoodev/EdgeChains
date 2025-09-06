#!/bin/bash
set -e

echo "🔨 Building NexusFlow All-in-One Docker Container..."

# Stop any existing containers
docker stop nexusflow-allinone 2>/dev/null || true
docker rm nexusflow-allinone 2>/dev/null || true

# Build the image
docker build -f Dockerfile.allinone -t nexusflow-allinone .

echo "✅ Build complete! Image: nexusflow-allinone"