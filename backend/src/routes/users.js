import { Router } from 'express';
import { query } from '../db.js';
import { sql } from '../sql.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/me/summary', requireAuth, async (req, res) => {
  const result = await query(sql.R20, [req.userId]);
  res.json(result.rows[0]);
});

router.get('/:id', async (req, res) => {
  const profile = await query(sql.R16, [req.params.id]);
  if (profile.rowCount === 0) return res.status(404).json({ error: 'User not found' });
  const reviews = await query(sql.R17, [req.params.id]);
  res.json({ ...profile.rows[0], reviews: reviews.rows });
});

export default router;
