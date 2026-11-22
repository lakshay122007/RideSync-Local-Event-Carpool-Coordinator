import { Router } from 'express';
import { query } from '../db.js';
import { sql } from '../sql.js';

const router = Router();

router.get('/', async (req, res) => {
  const result = await query(sql.R3);
  res.json(result.rows);
});

router.get('/:id/nearby', async (req, res) => {
  const result = await query(sql.R4, [req.params.id]);
  res.json(result.rows);
});

export default router;
