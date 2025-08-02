import { Worker } from 'bullmq';
import { redisClient } from '../../workers/streamAwareBullWorker';
import { withJobClient } from '../../lib/db';

export function startLogWorker(conn = redisClient) {
  return new Worker(
    'log',
    async job => {
      const { workflow_run_id, message } = job.data;
      if (!workflow_run_id) throw new Error('missing workflow_run_id');
      await withJobClient(workflow_run_id, async client => {
        await client.query(
          'INSERT INTO action_logs (workflow_run_id, message) VALUES ($1, $2)',
          [workflow_run_id, message],
        );
      });
      return { logged: true };
    },
    { connection: conn },
  );
}
