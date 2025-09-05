#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
FILE="$ROOT/docker-compose.yml"

if docker compose version >/dev/null 2>&1; then
  exec docker compose -f "$FILE" "$@"
elif command -v docker-compose >/dev/null 2>&1; then
  exec docker-compose -f "$FILE" "$@"
else
  echo "Docker Compose is not available. Install either 'docker compose' plugin or 'docker-compose'." >&2
  exit 1
fi

