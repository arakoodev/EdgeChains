# NexusFlow

This is a minimal implementation of the NexusFlow concept. It includes:

- Next.js UI with a basic node editor using `reactflow`.
- API routes for managing workflows in PostgreSQL.
- BullMQ setup with a sample `echo` worker.
- Server action to enqueue a workflow.

The Postgres schema expected:

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

To start a worker process run:

```bash
node --loader ts-node/esm runWorker.ts
```

Run the database migrations:

```bash
npm run migrate
```

## Local Dev with Docker

Bring up Redis and Postgres locally:

```bash
npm run docker:up
```

Copy env defaults and update if needed:

```bash
cp .env.local.example .env.local
```

Run migrations against local Postgres:

```bash
npm run migrate
```

Run tests (requires Redis running for stream/merge/node suites):

```bash
npm test -- --run
```

Shut down services and view logs:

```bash
npm run docker:logs   # follow service logs
npm run docker:down   # stop and remove volumes
```

Row level security is enabled per job using the `edgechains.job_id` session
variable. Use the `withJobClient` helper to run queries scoped to a job:

```ts
import { withJobClient } from './lib/db';

await withJobClient(jobId, (client) =>
  client.query('SELECT * FROM workflow_runs WHERE id=$1', [jobId])
);
```
