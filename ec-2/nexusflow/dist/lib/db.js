import { Pool } from 'pg';
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
export async function withJobClient(jobId, fn) {
    const client = await pool.connect();
    try {
        await client.query('SET edgechains.job_id = $1', [jobId]);
        return await fn(client);
    }
    finally {
        client.release();
    }
}
