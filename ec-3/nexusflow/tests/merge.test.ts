import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newDb } from 'pg-mem';
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';
import { readFile } from 'fs/promises';
import Redis from 'ioredis';
let pool: any;
vi.mock('../lib/db', () => ({ pool }));

describe('merge workflow', () => {
  let flowProducer: any;
  let queueEvents: any;
  let connection: any;

  beforeAll(async () => {
    const db = newDb();
    db.public.registerFunction({
      name: 'gen_random_uuid',
      returns: 'text',
      implementation: uuidv4,
    });
    const pg = db.adapters.createPg();
    pool = new pg.Pool();

    // run migrations
    const migrations = ['001_init.sql', '002_runs_and_merge.sql'];
    for (const file of migrations) {
      const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
      await pool.query(sql);
    }

    const { FlowProducer, QueueEvents } = await import('bullmq');
    connection = new Redis({ maxRetriesPerRequest: null });
    flowProducer = new FlowProducer({ connection });
    queueEvents = new QueueEvents('merge', { connection });
    await queueEvents.waitUntilReady();

    await import('../workers/merge');
  });

  afterAll(async () => {
    await queueEvents.close();
    await flowProducer.close();
    await connection.quit();
  });

  it('merges data from two branches', async () => {
    const runId = uuidv4();
    const { job } = await flowProducer.add({
      name: 'merge-root',
      queueName: 'merge',
      data: { workflow_run_id: runId },
      children: [
        {
          name: 'users',
          queueName: 'merge',
          data: { workflow_run_id: runId, parent_job_id: 'merge-root' }
        },
        {
          name: 'scores',
          queueName: 'merge',
          data: { workflow_run_id: runId, parent_job_id: 'merge-root' }
        }
      ]
    });

    const result = await new Promise<any>((resolve, reject) => {
      queueEvents.on('completed', async ({ jobId, returnvalue }: any) => {
        if (jobId === job.id) {
          resolve(returnvalue);
        }
      });
      queueEvents.on('failed', ({ failedReason }: any) => reject(failedReason));
    });

    expect(result).toEqual([
      { id: 1, name: 'Alice', score: 10 },
      { id: 2, name: 'Bob', score: 20 }
    ]);
  });
});
