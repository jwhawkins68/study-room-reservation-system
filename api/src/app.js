import express from 'express';
import cors from 'cors';
import { requireAuth } from './auth.js';
import { errorHandler, ApiError } from './errors.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import roomRoutes, { amenitiesRouter } from './routes/rooms.js';
import reservationRoutes from './routes/reservations.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Public
  app.use('/api/auth', authRoutes);

  // Everything below needs a signed-in user
  app.use('/api', requireAuth);
  app.use('/api/me', meRoutes);
  app.use('/api/amenities', amenitiesRouter);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/reservations', reservationRoutes);

  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'No such endpoint.')));
  app.use(errorHandler);
  return app;
}
