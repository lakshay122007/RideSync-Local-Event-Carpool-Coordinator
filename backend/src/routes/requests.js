import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { sql } from '../sql.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/mine', requireAuth, async (req, res) => {
  const result = await query(sql.R13, [req.userId, req.query.status || null]);
  res.json(result.rows);
});

router.put('/:id/approve', requireAuth, async (req, res) => {
  const outcome = await withTransaction(async (client) => {
    const approved = await client.query(sql.W11, [req.params.id, req.userId]);
    if (approved.rowCount === 0) return 'not_found';
    const { ride_id, rider_id } = approved.rows[0];
    const seat = await client.query(sql.W12, [ride_id]);
    if (seat.rowCount === 0) throw new NoSeatLeft();
    await client.query(sql.W15, [rider_id, 'Your seat request was approved']);
    return 'ok';
  }).catch((err) => {
    if (err instanceof NoSeatLeft) return 'no_seat';
    throw err;
  });
  if (outcome === 'not_found') return res.status(404).json({ error: 'Pending request not found for your ride' });
  if (outcome === 'no_seat') return res.status(409).json({ error: 'No seat left on this ride' });
  res.json({ approved: true });
});

router.put('/:id/reject', requireAuth, async (req, res) => {
  const result = await query(sql.W10, [req.params.id, req.userId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Pending request not found for your ride' });
  await query(sql.W15, [result.rows[0].rider_id, 'Your seat request was rejected']);
  res.json({ rejected: true });
});

router.put('/:id/cancel', requireAuth, async (req, res) => {
  const found = await withTransaction(async (client) => {
    const removed = await client.query(sql.W13, [req.params.id, req.userId]);
    if (removed.rowCount === 0) return false;
    if (removed.rows[0].status === 'approved') {
      await client.query(sql.W14, [removed.rows[0].ride_id]);
    }
    return true;
  });
  if (!found) return res.status(404).json({ error: 'Request not found, or the ride is already finished' });
  res.json({ cancelled: true });
});

class NoSeatLeft extends Error {}

export default router;
