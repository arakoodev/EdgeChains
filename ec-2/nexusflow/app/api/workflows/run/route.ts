import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../../lib/db';
import { runWorkflow } from '../../../../lib/workflow';

export async function POST(req: NextRequest) {
  try {
    const { name, nodes, edges } = await req.json();
    
    // Find existing workflow by name
    const { rows: existingRows } = await pool.query(
      'SELECT id FROM workflows WHERE name = $1',
      [name]
    );
    
    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: 'Workflow not found. Please save the workflow first.' },
        { status: 404 }
      );
    }
    
    const workflowId = existingRows[0].id;
    
    // Run the workflow
    const { runId, job } = await runWorkflow(workflowId);
    
    return NextResponse.json({
      runId,
      jobId: job.id,
      message: 'Workflow started successfully'
    });
    
  } catch (error) {
    console.error('Error running workflow:', error);
    return NextResponse.json(
      { error: 'Failed to run workflow', details: (error as Error).message },
      { status: 500 }
    );
  }
}