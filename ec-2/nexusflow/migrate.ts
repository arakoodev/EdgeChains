import { Pool } from 'pg';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dir = path.join(__dirname, 'migrations');
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    await pool.query(sql);
  }
  await pool.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
