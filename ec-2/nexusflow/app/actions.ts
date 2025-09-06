'use server';
import { flowProducer } from '../lib/queue';
import { pool } from '../lib/db';
import { runWorkflow } from '../lib/workflow';

export async function runEchoWorkflow(message: string) {
  await flowProducer.add({
    name: 'echo',
    queueName: 'echo',
    data: { message },
  });
}

export async function createWorkflow(name: string, definition: any) {
  const result = await pool.query(
    'INSERT INTO workflows(name, definition) VALUES($1, $2) RETURNING *',
    [name, definition]
  );
  return result.rows[0];
}

export async function executeWorkflow(workflowId: string, inputData: any = {}) {
  const { runId, job } = await runWorkflow(workflowId, inputData);
  return { runId, jobId: job.id };
}

export async function getWorkflows() {
  const { rows } = await pool.query('SELECT * FROM workflows ORDER BY created_at DESC');
  return rows;
}

export async function getWorkflowRuns(workflowId?: string) {
  const query = workflowId 
    ? 'SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY start_time DESC'
    : 'SELECT * FROM workflow_runs ORDER BY start_time DESC';
  
  const params = workflowId ? [workflowId] : [];
  const { rows } = await pool.query(query, params);
  return rows;
}
