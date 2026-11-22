import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { sql } from '../sql.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  }
  const hash = await bcrypt.hash(password, 10);
  const result = await query(sql.W1, [name, email.toLowerCase(), hash]);
  const user = result.rows[0];
  res.status(201).json({ token: signToken(user.id), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await query(sql.R1, [(email || '').toLowerCase()]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await query(sql.R2, [req.userId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

export default router;
