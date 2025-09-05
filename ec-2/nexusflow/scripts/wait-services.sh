#!/usr/bin/env bash
set -euo pipefail

COMPOSE="bash ./scripts/compose.sh"

echo "Waiting for Redis to be ready..."
for i in {1..60}; do
  if $COMPOSE exec -T redis redis-cli ping >/dev/null 2>&1; then
    echo "Redis is ready"
    break
  fi
  sleep 1
  if [[ $i -eq 60 ]]; then
    echo "Timed out waiting for Redis" >&2
    exit 1
  fi
done

echo "Waiting for Postgres to be ready..."
for i in {1..60}; do
  if $COMPOSE exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "Postgres is ready"
    break
  fi
  sleep 1
  if [[ $i -eq 60 ]]; then
    echo "Timed out waiting for Postgres" >&2
    exit 1
  fi
done

echo "All services are ready."
