import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pool } from '../lib/db';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

async function stageItems(job: any, items: any[], input: string) {
  const { workflow_run_id, parent_job_id } = job.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < items.length; i++) {
      await client.query(
        'INSERT INTO workflow_merge_staging (workflow_run_id, parent_job_id, input_name, item_index, item_data) VALUES ($1,$2,$3,$4,$5)',
        [workflow_run_id, parent_job_id, input, i, items[i]]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

new Worker(
  'merge',
  async job => {
    if (job.name === 'users') {
      const items = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      await stageItems(job, items, 'input1');
      return items;
    }

    if (job.name === 'scores') {
      const items = [
        { userId: 1, score: 10 },
        { userId: 2, score: 20 },
      ];
      await stageItems(job, items, 'input2');
      return items;
    }

    if (job.name === 'merge-root') {
      const { workflow_run_id } = job.data;
      const { rows } = await pool.query(
        `SELECT (u.item_data->>'id')::int as id, u.item_data->>'name' as name, (s.item_data->>'score')::int as score
         FROM workflow_merge_staging u
         JOIN workflow_merge_staging s ON (u.item_data->>'id')::int = (s.item_data->>'userId')::int
        WHERE u.workflow_run_id=$1 AND s.workflow_run_id=$1
          AND u.input_name='input1' AND s.input_name='input2'
        ORDER BY u.item_index`,
        [workflow_run_id]
      );
      await pool.query('DELETE FROM workflow_merge_staging WHERE workflow_run_id=$1', [workflow_run_id]);
      return rows;
    }
  },
  { connection }
);
