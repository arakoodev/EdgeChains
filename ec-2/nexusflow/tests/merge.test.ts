import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newDb } from 'pg-mem';
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';
import { readFile } from 'fs/promises';
import Redis from 'ioredis';
import { runWorkflow } from '../lib/workflow';
let pool: any;
let flowProducer: any;
vi.mock('../lib/db', () => ({ get pool() { return pool; } }));
vi.mock('../lib/queue', () => ({ get flowProducer() { return flowProducer; } }));

describe('merge workflow', () => {
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
    const wfDef = {
      root: 'merge-root',
      nodes: {
        'merge-root': { name: 'merge-root', queue: 'merge', children: ['users', 'scores'] },
        users: { name: 'users', queue: 'merge', data: { parent_job_id: 'merge-root' } },
        scores: { name: 'scores', queue: 'merge', data: { parent_job_id: 'merge-root' } }
      }
    };
    const { rows } = await pool.query(
      'INSERT INTO workflows(name, definition) VALUES($1,$2) RETURNING id',
      ['merge', wfDef]
    );

    const { job } = await runWorkflow(rows[0].id);

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
