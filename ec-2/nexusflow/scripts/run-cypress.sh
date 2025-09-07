#!/bin/bash
set -e

echo "🧪 Running Cypress E2E Tests in Docker..."

# Build Cypress Docker image
echo "🔨 Building Cypress Docker image..."
docker build -f Dockerfile.cypress -t nexusflow-cypress .

# Run Cypress tests
echo "🚀 Running Cypress tests..."
docker run --rm \
  --name nexusflow-cypress-test \
  --network host \
  -v $(pwd)/cypress/screenshots:/app/cypress/screenshots \
  -v $(pwd)/cypress/videos:/app/cypress/videos \
  -e CYPRESS_BASE_URL=http://localhost:3000 \
  nexusflow-cypress

echo "✅ Cypress tests completed!"