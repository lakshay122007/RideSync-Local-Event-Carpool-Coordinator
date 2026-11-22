import cron from 'node-cron';
import { query } from '../db.js';
import { sql } from '../sql.js';

export function startJobs() {
  cron.schedule('*/15 * * * *', async () => {
    const result = await query(sql.W19);
    if (result.rowCount > 0) console.log(`Sent ${result.rowCount} departure reminders`);
  });

  cron.schedule('0 2 * * *', async () => {
    const result = await query(sql.W20);
    if (result.rowCount > 0) console.log(`Created ${result.rowCount} recurring events`);
  });
}
