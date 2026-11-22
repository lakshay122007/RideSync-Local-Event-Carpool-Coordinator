import pg from 'pg';
import 'dotenv/config';

pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(1114, (v) => v);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
