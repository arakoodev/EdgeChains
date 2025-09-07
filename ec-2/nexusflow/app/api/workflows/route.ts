import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  
  if (name) {
    const { rows } = await pool.query('SELECT id, name, definition FROM workflows WHERE name = $1', [name]);
    return NextResponse.json(rows);
  } else {
    const { rows } = await pool.query('SELECT id, name FROM workflows');
    return NextResponse.json(rows);
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const result = await pool.query(
    'INSERT INTO workflows(name, definition) VALUES($1, $2) RETURNING *',
    [data.name, data.definition]
  );
  return NextResponse.json(result.rows[0]);
}
