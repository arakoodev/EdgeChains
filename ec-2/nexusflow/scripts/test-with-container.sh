#!/bin/bash
set -e

echo "🧪 Running tests with all-in-one container..."

# Build the container first
echo "🔨 Building all-in-one container..."
npm run allinone:build

# Create a test-specific persistent directory  
TEST_DATA_DIR="/tmp/nexusflow-test-$(date +%s)"
mkdir -p "$TEST_DATA_DIR"

echo "📊 Starting test container..."
# Start the container in background for testing
CONTAINER_ID=$(docker run -d \
  --name nexusflow-test \
  -p 3001:3000 \
  -v "$TEST_DATA_DIR":/tmp/nexusflow-data \
  --health-cmd="curl -f http://localhost:3000/api/workflows || exit 1" \
  --health-interval=5s \
  --health-timeout=3s \
  --health-retries=10 \
  nexusflow-allinone)

echo "⏳ Waiting for container to be healthy..."
# Wait for container to be healthy
timeout 60 bash -c '
  while [ "$(docker inspect --format "{{.State.Health.Status}}" nexusflow-test)" != "healthy" ]; do
    echo "Waiting for container to be healthy..."
    sleep 2
  done
'

# Set environment variables for tests to connect to container
export DATABASE_URL="postgresql://postgres@localhost:5433/nexusflow" 
export REDIS_URL="redis://localhost:6380"

# Container is already running with ports 3001:3000, need to expose PostgreSQL and Redis
echo "🔄 Restarting container with database ports exposed..."
docker stop nexusflow-test
docker rm nexusflow-test

CONTAINER_ID=$(docker run -d \
  --name nexusflow-test \
  -p 5433:5432 \
  -p 6380:6379 \
  -p 3001:3000 \
  -v "$TEST_DATA_DIR":/tmp/nexusflow-data \
  --health-cmd="curl -f http://localhost:3000/api/workflows || exit 1" \
  --health-interval=5s \
  --health-timeout=3s \
  --health-retries=10 \
  nexusflow-allinone)

echo "⏳ Waiting for container to be healthy..."
timeout 60 bash -c '
  while [ "$(docker inspect --format "{{.State.Health.Status}}" nexusflow-test)" != "healthy" ]; do
    echo "Waiting for container to be healthy..."
    sleep 2
  done
'

echo "✅ Container is healthy, running tests..."

# Run tests with container services
export DATABASE_URL="postgresql://postgres@localhost:5433/nexusflow"
export REDIS_URL="redis://localhost:6380"

# Run the tests
npm run test:ci

TEST_EXIT_CODE=$?

# Cleanup
echo "🧹 Cleaning up test container..."
docker stop nexusflow-test || true
docker rm nexusflow-test || true
rm -rf "$TEST_DATA_DIR"

# Show results
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Tests failed with exit code $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE