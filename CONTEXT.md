# Session Context and Changes

This file summarizes the key decisions and changes made during the last session so you can resume quickly after re‑login.

## High‑Level
- Updated `AGENTS.md` to be exhaustive and self‑contained: architecture, tech stack, hard rules (Next.js only under `ec-2/`), BullMQ Flows control plane, Redis Streams data plane, DB schemas, node patterns, `StreamAwareBullMQWorker` skeleton, n8n mapping, dev workflow, testing, CI, and security.
- Focused troubleshooting and DX improvements for `ec-2/nexusflow` tests and local environment setup.

## NexusFlow Tests
- Added Redis availability check and gated Redis‑dependent suites to auto‑skip when Redis isn’t reachable (they still run in CI):
  - Added: `ec-2/nexusflow/tests/utils/redis.ts` (`canConnectRedis()` helper).
  - Updated to use gated `describe`: `tests/stream.test.ts`, `tests/merge.test.ts`, `tests/nodes.test.ts`.
- Reduced noisy ioredis error events when Redis is down:
  - Updated: `ec-2/nexusflow/workers/streamAwareBullWorker.ts` (attach `redisClient.on('error', () => {})`).
- Current status locally: basic and RLS tests pass; Redis suites run when Redis is available.

## Dockerized Local Dev (Redis + Postgres)
- Added root compose file: `docker-compose.yml` (Redis 7, Postgres 15 with healthchecks).
- NexusFlow scripts and env:
  - `ec-2/nexusflow/.env.local.example` → copy to `.env.local`.
  - `ec-2/nexusflow/scripts/compose.sh` wrapper supports both `docker compose` and `docker-compose`.
  - `ec-2/nexusflow/scripts/wait-services.sh` waits for Redis/Postgres readiness.
  - `ec-2/nexusflow/scripts/e2e.sh` runs full sequence (up → wait → migrate → test → down).
  - `ec-2/nexusflow/package.json` scripts:
    - `docker:up`, `docker:down`, `docker:logs`, `docker:wait`, `e2e`.
  - `ec-2/nexusflow/readme.md` updated with Docker instructions and scripts.

## How to Run Locally
1) From `ec-2/nexusflow`:
   - `cp .env.local.example .env.local`
   - `npm run e2e` (starts services, migrates, runs tests, tears down)
   - Or manual: `npm run docker:up && npm run docker:wait && npm run migrate && npm test -- --run && npm run docker:down`
2) From `ec-2/nextjs-chat-template`:
   - `npm install && npm test -- --run`

## Notes
- If Docker commands fail with permission errors, add your user to the `docker` group and re‑login (or use sudo as a fallback).
- Compose warns that `version` key is obsolete in `docker-compose.yml` (safe to ignore; can be removed later).
- All Next.js code must remain under `ec-2/` (hard rule in `AGENTS.md`).

