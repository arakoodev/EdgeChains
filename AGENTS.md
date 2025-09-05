# Repository Guidelines

This repository treats Generative AI as configuration. Keep dependencies minimal and place all Next.js work under `ec-2/`.

## Project Structure & Module Organization
- `ec-2/` (Next.js only): new templates and examples (e.g., `nexusflow`, `nextjs-chat-template`). Each example includes `jsonnet/` for prompts and Vitest tests under `tests/`.
- `JS/edgechains/arakoodev`: main Node package (AI, vector DB, loaders, server utils).
- `JS/edgechains/examples`: legacy Hono/HTMX examples (keep as-is).
- `JS/jsonnet`, `JS/wasm`: legacy/experimental; ignore for routine work.
- Rust crates + `Makefile`: CLI and WASM runtime.

## Build, Test, and Development Commands
- Next.js apps (from `ec-2/<project>`):
  - `npm install` — install deps
  - `npm run dev` | `npm run build` | `npm start`
  - `npm test -- --run` — run Vitest (Redis required for `nexusflow`)
- Rust/WASM (top level): `make build-cli`, `make build-engine`, `make build-shims`.
- CI: `.github/workflows/ec2-tests.yml` runs Vitest for both Next.js projects with Redis.

## Coding Style & Naming Conventions
- Prettier formatting; TypeScript-first. Run `npm run format` where available.
- Keep examples compact: one TypeScript script + one Jsonnet file for prompts.
- Strict rule: Next.js code must live in `ec-2/` only.

## Testing Guidelines
- Framework: Vitest. Tests belong under `ec-2/<project>/tests` and use `*.test.ts`.
- `nexusflow` uses Redis and `pg-mem`; ensure Redis is running locally or rely on CI.
- Aim for fast, deterministic unit/integration tests; mock external calls.

## Commit & Pull Request Guidelines
- Commits: concise, imperative, scoped to one change (e.g., "nexusflow: add webhook trigger tests").
- PRs: include summary, motivation, screenshots for UI, and linked issues. All checks must pass.
- Verify: Prettier formatting, Vitest green, and Next.js files confined to `ec-2/`.

## Architecture Overview (NexusFlow)
- Separation of concerns:
  - Triggers (server-side, stateful): long‑running listeners/producers managed by Next.js. Webhook triggers accept HTTP and enqueue the first job via BullMQ `FlowProducer`; polling triggers run on a schedule and persist position in `trigger_state` (PostgreSQL).
  - Actions (workers, stateless): BullMQ `Worker` processors that execute tasks and can scale horizontally. Keep no cross‑request state; use PostgreSQL for persistence.

### Streams Data Plane (Redis)
- Control vs. data: BullMQ Flows remain the control plane; Redis Streams carry data between jobs.
- Base class: `StreamAwareBullMQWorker` extends `Worker` and adds helpers:
  - `produce(stream, data)` → `XADD`
  - `createConsumerGroup(stream, group)` → `XGROUP CREATE ... MKSTREAM`
  - Conventions: `stream:<runId>:<node>`, `group:<runId>`, `consumer:<jobId>`
- Action nodes: consume with `XREADGROUP ... '>'` from `inputStream`, process, `XADD` to `outputStream`, then `XACK`. Pass stream names in `job.data`.
- Merge nodes: consume multiple `inputStreams`, aggregate to `HSET merge-state:<runId>:<jobId>` keyed by `mergeKey`, publish merged items to `outputStream`, then `DEL` the hash.
- Notes: ensure idempotency, always `XACK`, and configure ioredis with `maxRetriesPerRequest: null` for streams.

## Database & Components
- Tables:
  - `workflows(id, name, definition, timestamps)` — stores workflow JSON definitions.
  - `workflow_runs(id, workflow_id, status, start/end, final_output, error_details)` — authoritative run history.
  - Optional: `workflow_merge_staging` for SQL-based merges (not needed with Streams).
- Services:
  - Interpreter Service — loads definition, inserts `workflow_runs`, builds Flow with `FlowProducer`.
  - Worker Pool — distributed BullMQ `Worker`s executing node logic.
  - State Sync Service — `QueueEvents` listener updating `workflow_runs` on completed/failed.

## Workflow Lifecycle (Example)
- Trigger/Start → fetch data (standalone job) → enqueue parallel branches (e.g., geo + purchases) → merge → report.
- With Streams: children publish to per-branch streams; Merge drains, aggregates, publishes to next node.
- With SQL staging (legacy/alt): children `INSERT` rows; Merge `JOIN`s by key, returns merged payload, then cleans up.

## Failure Handling
- Retries/backoff: configure `attempts` + exponential backoff; transient failures re-run automatically.
- Permanent failure: child failure marks `workflow_runs.status = failed` via State Sync; parent waits forever (by design) until operator action.
- Stalled jobs: BullMQ reclaims after lock expiry; workers must be idempotent (e.g., `INSERT ... ON CONFLICT DO UPDATE`).

## n8n Mapping (Key Primitives)
- Items as arrays: model item-by-item processing with fan-out (child jobs per item) and fan-in aggregation via `getChildrenValues()` or Streams.
- IF/Switch: use a Router Job that evaluates conditions and enqueues the next branch via `FlowProducer` (ensure idempotency to avoid duplicate branches).
- Merge modes: implement via PostgreSQL staging (append, position, match/joins with custom SQL) or via Redis Streams + hash aggregation.
- Loops: implicit loops = fan-out/fan-in; explicit loops = long-running job or sub-flows per item.
- Sub-workflows: interpreter nests FlowJob trees as children; parent reads child result via `getChildrenValues()`.
- Error workflows: global `QueueEvents` failed-listener enqueues a dedicated error-handler job with rich context.

## Security & Configuration
- Store secrets outside VCS (env vars or `secrets.jsonnet`).
- Prefer Jsonnet for prompts/config so changes remain reviewable and diffable.
# Repository Guidelines

This document is the single, self‑contained guide for contributors and code‑generation. It defines the architecture, conventions, and required files so new projects can be scaffolded without prior context.

## Mission & Scope
- Build compact, auditable AI apps where prompts and logic live in Jsonnet and UI/APIs live in Next.js.
- Orchestrate workflows with BullMQ over Redis; persist definitions and run history in PostgreSQL.
- All new Next.js code MUST live under `ec-2/` (hard rule).

## Tech Stack
- UI/API: Next.js 14 (App Router, Server Actions) in `ec-2/<project>`.
- Orchestration: BullMQ (`Queue`, `Worker`, `FlowProducer`, `QueueEvents`).
- Data plane: Redis Streams for inter‑job data when streaming is needed.
- Persistence: PostgreSQL for workflow definitions and runs.
- Prompts/Config: Jsonnet files checked into source control.
- Tests: Vitest; CI runs with Redis (see `.github/workflows/ec2-tests.yml`).

## Repository Structure
- `ec-2/` — all Next.js examples/templates
  - `nexusflow/` — reference workflow app (BullMQ + Redis + PG)
  - `nextjs-chat-template/` — chat starter using EdgeChains packages
- `JS/edgechains/arakoodev` — main Node package (AI, vector DB, loaders, server utils)
- `JS/edgechains/examples` — legacy Hono/HTMX examples (read‑only)
- `JS/jsonnet`, `JS/wasm` — legacy/experimental; not used for new work
- Rust crates + `Makefile` — CLI and WASM runtime

## Architecture Overview
- Control plane (BullMQ Flows): FlowProducer creates DAGs; a parent runs only after all children complete.
- Data plane (Redis Streams): jobs exchange items via Streams instead of `getChildrenValues()` when high‑throughput or decoupling is needed.
- Services:
  - Interpreter Service: loads a workflow JSON, writes a `workflow_runs` row, builds Flow jobs.
  - Worker Pool: distributed `Worker` processes for Action/Merge logic.
  - State Sync Service: `QueueEvents` listener updates `workflow_runs` on job completed/failed.
- Triggers vs. Actions:
  - Triggers (server‑side, stateful) start runs: webhook or polling; enqueue first job via `FlowProducer`.
  - Actions (workers, stateless) execute steps; no cross‑job state; persist via PG if needed.
- Error workflows: a global failed‑event listener can enqueue a dedicated error handler with rich context.

## Database Schemas (minimum)
```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  final_output JSONB,
  error_details JSONB
);

-- Optional when using SQL staging for merges
CREATE TABLE workflow_merge_staging (
  id SERIAL PRIMARY KEY,
  workflow_run_id UUID NOT NULL,
  parent_job_id VARCHAR(255) NOT NULL,
  input_name VARCHAR(50) NOT NULL,
  item_index INTEGER NOT NULL,
  item_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_workflow_merge_staging_run_parent
  ON workflow_merge_staging (workflow_run_id, parent_job_id);
```

## Node Patterns
- Action Node (stateless worker): consumes input, performs work, and produces output. Scales horizontally.
- Trigger Node (server‑side):
  - Webhook: HTTP entrypoint; on request, enqueue first job via `FlowProducer`.
  - Polling: repeatable job; persists position in `trigger_state` (PG) and enqueues new items.
- Merge Node:
  - SQL staging: children `INSERT` into `workflow_merge_staging`; parent worker runs JOIN/merge and cleans up.
  - Streams: parent drains multiple input Streams, aggregates into a Redis hash, then emits merged items.

### StreamAwareBullMQWorker (base class)
Design: extend BullMQ `Worker` with Redis Streams helpers and conventions.

Conventions
- Streams: `stream:<workflowRunId>:<nodeName>`
- Groups: `group:<workflowRunId>`
- Consumers: `consumer:<jobId>`

Helpers (required)
- `produce(stream, data)` → `XADD`
- `createConsumerGroup(stream, group)` → `XGROUP CREATE ... MKSTREAM`
- Consumers use `XREADGROUP GROUP <group> <consumer> COUNT 1 BLOCK 2000 STREAMS <stream> >`
- Always `XACK` after processing; ensure idempotency. Configure ioredis with `maxRetriesPerRequest: null`.

Minimal skeleton (illustrative)
```ts
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
const redis = new IORedis({ maxRetriesPerRequest: null });

export abstract class StreamAwareBullMQWorker extends Worker {
  constructor(queueName: string, processor: (job: Job) => Promise<any>, opts?: any) {
    super(queueName, processor, opts);
  }
  protected async produce(stream: string, data: Record<string, any>) {
    const flat: string[] = [];
    for (const [k, v] of Object.entries(data)) flat.push(k, JSON.stringify(v));
    return redis.xadd(stream, '*', ...flat);
  }
  protected async createConsumerGroup(stream: string, group: string) {
    try { await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM'); }
    catch (e: any) { if (!String(e?.message).includes('BUSYGROUP')) throw e; }
  }
}
```

## n8n Mapping (design guidance)
- Items as arrays: model item‑level parallelism via fan‑out (child jobs per item) and fan‑in aggregation (`getChildrenValues()` or Streams).
- IF/Switch: Router Job evaluates conditions and enqueues the chosen branch as a new Flow (ensure idempotent branch creation).
- Merge modes: implement Append/Position/Matching via SQL; or aggregate via Streams + Redis Hash keyed by join key.
- Loops: implicit loops = fan‑out/fan‑in; explicit loops = long‑running job or per‑item sub‑flows.
- Sub‑workflows: interpreter nests Flow trees; parent reads child result with `getChildrenValues()`.
- Error workflows: global failed‑event listener enqueues a dedicated error‑handler job with rich context.

## Development Workflow
Setup
- Node 18+, Redis 7+, PostgreSQL 14+.
- Each Next.js app lives in `ec-2/<project>` with its own `package.json`.

Common Commands
- Next.js app (from `ec-2/<project>`):
  - `npm install`
  - `npm run dev` | `npm run build` | `npm start`
  - `npm test -- --run` (Vitest; `nexusflow` requires a running Redis)
- Rust/WASM (root): `make build-cli`, `make build-engine`, `make build-shims`

Environment
- Put secrets in env vars or `jsonnet/secrets.jsonnet` (never commit real secrets).
- For tests that require Redis/PG, prefer ephemeral containers locally and CI services in GitHub Actions.

Testing
- Framework: Vitest. Tests under `ec-2/<project>/tests` with `*.test.ts` pattern.
- Mock external APIs; for DB logic use `pg-mem` where feasible; `nexusflow` tests expect Redis.
- CI: `.github/workflows/ec2-tests.yml` installs Redis and runs Vitest for `ec-2` projects.

## Coding Style & Conventions
- TypeScript‑first; Prettier formatting. Keep examples compact.
- File/Dir naming: `kebab-case` for files, `camelCase` for variables, `PascalCase` for React components.
- Next.js code only in `ec-2/`. Each example includes `jsonnet/` with `main.jsonnet` and `secrets.jsonnet`.
- Streams naming per conventions above; queues per responsibility (e.g., `action-queue`, `merge-queue`).

## Commit & Pull Requests
- Commits: imperative and scoped (e.g., `nexusflow: add stream merge worker`).
- PRs: include summary, linked issues, screenshots for UI; ensure tests/formatting pass.
- Required checks: Vitest green, Prettier clean, Next.js code confined to `ec-2/`.

## Failure Handling
- Retries/backoff at job level; use exponential backoff for transient failures.
- Permanent failure: State Sync marks `workflow_runs.status = failed` and records `error_details`.
- Stalled jobs: allow BullMQ to reclaim; write idempotent workers (e.g., `INSERT ... ON CONFLICT DO UPDATE`).

## Security & Configuration
- Keep secrets out of VCS; prefer env vars and CI secrets. Jsonnet captures prompts/config for reviewability.
- Validate inputs at boundaries (Zod or equivalent) in Next.js routes/actions and workers.

## Quickstart (NexusFlow)
1) From `ec-2/nexusflow` run `npm install` and `npm test -- --run` (ensure Redis is running).
2) Implement new Actions under `workers/` and Triggers under `nodes/triggers/` following patterns above.
3) Add migrations to `migrations/` and update the interpreter to register new node types.

## Hard Rules
- All new Next.js projects and code live strictly under `ec-2/`.
- Jsonnet is the source of truth for prompts/config; avoid inline prompt strings in TS/JS.
- Do not modify legacy folders for new work (`JS/jsonnet`, `JS/wasm`, legacy examples).
