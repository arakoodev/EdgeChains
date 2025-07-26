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
