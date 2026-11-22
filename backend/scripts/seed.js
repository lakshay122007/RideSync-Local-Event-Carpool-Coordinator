import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db.js';

const big = process.argv.includes('--big');

async function clearTables() {
  await query('TRUNCATE users, events, rides, ride_requests, ratings, notifications RESTART IDENTITY CASCADE');
}

async function seedDemo(hash) {
  const names = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Sana', 'Vikram', 'Isha'];
  for (const name of names) {
    await query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [
      name, `${name.toLowerCase()}@demo.com`, hash,
    ]);
  }

  const zones = {};
  for (const row of (await query('SELECT id, name FROM zones')).rows) zones[row.name] = row.id;

  const addEvent = async (name, days, location, category, recurring, parent, creator) => {
    const result = await query(
      `INSERT INTO events (name, event_date, location, category, is_recurring, parent_event_id, created_by)
       VALUES ($1, NOW() + $2 * INTERVAL '1 day', $3, $4, $5, $6, $7) RETURNING id`,
      [name, days, location, category, recurring, parent, creator]
    );
    return result.rows[0].id;
  };
  const gymPast = await addEvent('Weekly Gym Session', -2, 'FitZone, Sector 14', 'gym', true, null, 1);
  const gymNext = await addEvent('Weekly Gym Session', 5, 'FitZone, Sector 14', 'gym', true, gymPast, 1);
  const fest = await addEvent('Annual College Fest', 10, 'Main Auditorium', 'college_fest', false, null, 2);
  const market = await addEvent('Sunday Farmers Market', 3, 'City Ground', 'market', true, null, 3);
  const exam = await addEvent('Entrance Exam Centre Trip', 6, 'Exam Centre, Sector 21', 'exam', false, null, 4);
  const concert = await addEvent('Rock Concert', 14, 'Open Air Arena', 'concert', false, null, 5);

  const addRide = async (eventId, driver, zone, hoursBeforeEvent, seats, cost, status) => {
    const result = await query(
      `INSERT INTO rides (event_id, driver_id, zone_id, departure_time, total_seats, cost_split, total_cost, status)
       SELECT e.id, $2, $3, e.event_date - $4 * INTERVAL '1 hour', $5, $6, $7, $8 FROM events e WHERE e.id = $1
       RETURNING id`,
      [eventId, driver, zones[zone], hoursBeforeEvent, seats, cost !== null, cost, status]
    );
    return result.rows[0].id;
  };
  const addRequest = (rideId, rider, status) =>
    query('INSERT INTO ride_requests (ride_id, rider_id, status) VALUES ($1, $2, $3)', [rideId, rider, status]);

  const pastRide = await addRide(gymPast, 1, 'North Campus', 1, 3, null, 'completed');
  await addRequest(pastRide, 2, 'approved');
  await addRequest(pastRide, 3, 'approved');
  await query('UPDATE rides SET departure_time = NOW() - INTERVAL \'3 days\' WHERE id = $1', [pastRide]);

  const r1 = await addRide(gymNext, 1, 'North Campus', 1, 4, null, 'open');
  const r2 = await addRide(gymNext, 3, 'Sector 14', 1, 3, 200, 'open');
  const r3 = await addRide(fest, 2, 'South Campus', 3, 4, null, 'open');
  const r4 = await addRide(fest, 4, 'Near Metro Station', 2, 3, 300, 'open');
  const r5 = await addRide(fest, 6, 'Sector 21', 2, 2, null, 'open');
  const r6 = await addRide(market, 3, 'City Center', 1, 3, null, 'open');
  const r7 = await addRide(exam, 5, 'North Campus', 2, 4, null, 'open');
  const r8 = await addRide(concert, 1, 'Sector 14', 4, 4, 400, 'open');

  await addRequest(r1, 2, 'approved');
  await addRequest(r1, 4, 'pending');
  await addRequest(r2, 5, 'approved');
  await addRequest(r3, 7, 'approved');
  await addRequest(r3, 8, 'pending');
  await addRequest(r4, 1, 'approved');
  await addRequest(r4, 5, 'approved');
  await addRequest(r5, 3, 'approved');
  await addRequest(r5, 7, 'approved');
  await addRequest(r6, 2, 'pending');
  await addRequest(r8, 6, 'pending');
  await query(`UPDATE rides r SET seats_available = r.total_seats -
     (SELECT COUNT(*) FROM ride_requests q WHERE q.ride_id = r.id AND q.status = 'approved')`);
  await query(`UPDATE rides SET status = 'full' WHERE seats_available = 0 AND status = 'open'`);

  const addRating = (ride, rater, rated, stars, comment) =>
    query('INSERT INTO ratings (ride_id, rater_id, rated_id, stars, comment) VALUES ($1, $2, $3, $4, $5)',
      [ride, rater, rated, stars, comment]);
  await addRating(pastRide, 2, 1, 5, 'Punctual and friendly');
  await addRating(pastRide, 3, 1, 4, 'Good ride');
  await addRating(pastRide, 1, 2, 5, 'Ready on time');

  await query(`INSERT INTO notifications (user_id, message) VALUES
    (1, 'Diya requested a seat on your ride to Weekly Gym Session'),
    (2, 'Your seat request was approved'),
    (1, 'Reminder: your ride leaves within the hour.')`);
  console.log('Demo data ready. Log in with aarav@demo.com / password123 (also diya, kabir, meera, rohan, sana, vikram, isha).');
}

async function seedBig(hash) {
  await query(`INSERT INTO users (name, email, password_hash)
    SELECT 'User ' || g, 'user' || g || '@bench.com', $1 FROM generate_series(1, 20000) g`, [hash]);
  await query(`INSERT INTO events (name, event_date, location, category, is_recurring, created_by)
    SELECT 'Event ' || g, NOW() + ((g % 400) - 200) * INTERVAL '1 day', 'Venue ' || (g % 50),
           (ARRAY['college_fest','gym','market','exam','concert','custom'])[1 + g % 6], g % 7 = 0, 1 + (g * 7) % 20000
    FROM generate_series(1, 3000) g`);
  await query(`INSERT INTO rides (event_id, driver_id, zone_id, departure_time, total_seats, cost_split, total_cost, status)
    SELECT e.id, 1 + (g * 17) % 20000, 1 + g % 6, e.event_date - INTERVAL '2 hours', 3 + g % 3,
           g % 3 = 0, CASE WHEN g % 3 = 0 THEN 200 + (g % 5) * 50 END,
           CASE WHEN e.event_date < NOW() THEN 'completed' ELSE 'open' END
    FROM generate_series(1, 60000) g JOIN events e ON e.id = 1 + (g * 31) % 3000`);
  await query(`INSERT INTO ride_requests (ride_id, rider_id, status)
    SELECT r.id, 1 + ((r.driver_id - 1 + n * 997) % 20000),
           CASE n WHEN 1 THEN 'approved' WHEN 2 THEN 'approved' WHEN 4 THEN 'rejected' ELSE 'pending' END
    FROM rides r CROSS JOIN LATERAL generate_series(1, r.id % 6) n`);
  await query(`UPDATE rides r SET seats_available = r.total_seats -
     (SELECT COUNT(*) FROM ride_requests q WHERE q.ride_id = r.id AND q.status = 'approved')`);
  await query(`UPDATE rides SET status = 'full' WHERE seats_available = 0 AND status = 'open'`);
  await query('ALTER TABLE ratings DISABLE TRIGGER ratings_refresh_avg');
  await query(`INSERT INTO ratings (ride_id, rater_id, rated_id, stars)
    SELECT q.ride_id, q.rider_id, r.driver_id, 1 + (q.id * 7) % 5
    FROM ride_requests q JOIN rides r ON r.id = q.ride_id
    WHERE q.status = 'approved' AND r.status = 'completed'`);
  await query(`INSERT INTO ratings (ride_id, rater_id, rated_id, stars)
    SELECT q.ride_id, r.driver_id, q.rider_id, 1 + (q.id * 3) % 5
    FROM ride_requests q JOIN rides r ON r.id = q.ride_id
    WHERE q.status = 'approved' AND r.status = 'completed' AND q.id % 2 = 0`);
  await query('ALTER TABLE ratings ENABLE TRIGGER ratings_refresh_avg');
  await query(`UPDATE users u SET avg_rating = a.avg_stars
    FROM (SELECT rated_id, ROUND(AVG(stars)::numeric, 2) AS avg_stars FROM ratings GROUP BY rated_id) a
    WHERE a.rated_id = u.id`);
  await query(`INSERT INTO notifications (user_id, message, is_read, created_at)
    SELECT 1 + g % 20000, 'Notification ' || g, g % 3 = 0, NOW() - (g % 1000) * INTERVAL '1 hour'
    FROM generate_series(1, 300000) g`);
  await query('ANALYZE');
  console.log('Benchmark data ready: 20000 users, 3000 events, 60000 rides, about 150000 requests, 300000 notifications.');
}

const hash = await bcrypt.hash('password123', 10);
await clearTables();
if (big) await seedBig(hash);
else await seedDemo(hash);
await pool.end();
