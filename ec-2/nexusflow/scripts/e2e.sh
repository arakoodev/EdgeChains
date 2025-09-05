#!/usr/bin/env bash
set -euo pipefail

# project root of nexusflow
cd "$(dirname "$0")/.."

# load local env if present
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env.local
  set +a
fi

npm run docker:up
npm run docker:wait
npm run migrate
npm test -- --run
npm run docker:down

