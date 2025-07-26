import { flowProducer } from './queue';
import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

interface NodeDef {
  name: string;
  queue: string;
  children?: string[];
  data?: Record<string, any>;
}

interface WorkflowDef {
  root: string;
  nodes: Record<string, NodeDef>;
}

export async function runWorkflow(workflowId: string) {
  const { rows } = await pool.query('SELECT definition FROM workflows WHERE id=$1', [workflowId]);
  if (rows.length === 0) throw new Error('workflow not found');
  const def = rows[0].definition as WorkflowDef;
  const runId = uuidv4();

  const tree = buildTree(def.root, def.nodes, runId);
  const result = await flowProducer.add(tree);
  return { runId, job: result.job };
}

function buildTree(id: string, nodes: Record<string, NodeDef>, runId: string): any {
  const node = nodes[id];
  if (!node) throw new Error(`node ${id} missing`);
  return {
    name: node.name,
    queueName: node.queue,
    data: { ...node.data, workflow_run_id: runId },
    children: (node.children || []).map(child => buildTree(child, nodes, runId)),
  };
}
