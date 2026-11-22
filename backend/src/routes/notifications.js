import { Router } from 'express';
import { query } from '../db.js';
import { sql } from '../sql.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await query(sql.R18, [req.userId]);
  res.json(result.rows);
});

router.get('/unread-count', async (req, res) => {
  const result = await query(sql.R19, [req.userId]);
  res.json(result.rows[0]);
});

router.put('/read-all', async (req, res) => {
  await query(sql.W17, [req.userId]);
  res.json({ done: true });
});

router.put('/:id/read', async (req, res) => {
  const result = await query(sql.W16, [req.params.id, req.userId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
  res.json({ done: true });
});

export default router;
