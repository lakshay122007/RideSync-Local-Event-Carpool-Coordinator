import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { sql } from '../sql.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/mine', requireAuth, async (req, res) => {
  const result = await query(sql.R12, [req.userId]);
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const ride = await query(sql.R9, [req.params.id]);
  if (ride.rowCount === 0) return res.status(404).json({ error: 'Ride not found' });
  const riders = await query(sql.R10, [req.params.id]);
  res.json({ ...ride.rows[0], riders: riders.rows });
});

router.get('/:id/requests', requireAuth, async (req, res) => {
  const result = await query(sql.R11, [req.params.id, req.userId]);
  res.json(result.rows);
});

router.get('/:id/repeat', requireAuth, async (req, res) => {
  const result = await query(sql.R14, [req.params.id, req.userId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Ride not found' });
  res.json(result.rows[0]);
});

router.get('/:id/ratings/pending', requireAuth, async (req, res) => {
  const result = await query(sql.R15, [req.params.id, req.userId]);
  res.json(result.rows);
});

router.post('/:id/ratings', requireAuth, async (req, res) => {
  const { ratedId, stars, comment } = req.body;
  const allowed = await query(sql.R15, [req.params.id, req.userId]);
  if (!allowed.rows.some((person) => person.id === Number(ratedId))) {
    return res.status(400).json({ error: 'You cannot rate this person for this ride' });
  }
  const result = await query(sql.W18, [req.params.id, req.userId, ratedId, stars, comment || null]);
  res.status(201).json(result.rows[0]);
});

router.post('/:id/requests', requireAuth, async (req, res) => {
  const ride = await query(sql.R9, [req.params.id]);
  if (ride.rowCount === 0) return res.status(404).json({ error: 'Ride not found' });
  const result = await query(sql.W9, [req.params.id, req.userId]);
  if (result.rowCount === 0) return res.status(400).json({ error: 'This ride is not open for requests' });
  const me = await query(sql.R2, [req.userId]);
  const message = `${me.rows[0].name} requested a seat on your ride to ${ride.rows[0].event_name}`;
  await query(sql.W15, [ride.rows[0].driver_id, message]);
  res.status(201).json(result.rows[0]);
});

router.put('/:id/cancel', requireAuth, async (req, res) => {
  const ok = await withTransaction(async (client) => {
    const cancelled = await client.query(sql.W6, [req.params.id, req.userId]);
    if (cancelled.rowCount === 0) return false;
    await client.query(sql.W7, [req.params.id, 'A ride you requested was cancelled by the driver']);
    return true;
  });
  if (!ok) return res.status(400).json({ error: 'Only the driver can cancel an open or full ride' });
  res.json({ cancelled: true });
});

router.put('/:id/complete', requireAuth, async (req, res) => {
  const result = await query(sql.W8, [req.params.id, req.userId]);
  if (result.rowCount === 0) {
    return res.status(400).json({ error: 'Only the driver can complete a ride, and only after departure' });
  }
  res.json({ completed: true });
});

export default router;
