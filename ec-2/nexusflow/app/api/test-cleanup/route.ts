import { NextResponse } from 'next/server';
import { pool } from '../../../lib/db';

export async function DELETE() {
  try {
    // Clean up test workflows and related data
    await pool.query('TRUNCATE workflows RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE workflow_runs RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE trigger_state RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE action_logs RESTART IDENTITY CASCADE');
    
    return NextResponse.json({ message: 'Test data cleaned up successfully' });
  } catch (error) {
    console.error('Test cleanup error:', error);
    return NextResponse.json({ error: 'Failed to clean up test data' }, { status: 500 });
  }
}