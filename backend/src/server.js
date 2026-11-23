import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import zoneRoutes from './routes/zones.js';
import eventRoutes from './routes/events.js';
import rideRoutes from './routes/rides.js';
import requestRoutes from './routes/requests.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import { startJobs } from './jobs/cron.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'This already exists' });
  if (err.code === 'P0001') return res.status(400).json({ error: err.message });
  if (err.code === '23514' || err.code === '22P02' || err.code === '23503') {
    return res.status(400).json({ error: 'Invalid data' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 5001;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
  if (!process.env.DISABLE_JOBS) startJobs();
});
