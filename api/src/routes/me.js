import { Router } from 'express';
import { handle, fromDbError } from '../errors.js';
import { toReservation, RES_SELECT } from './reservations.js';

const router = Router();

// Stories 2 and 3: GET /api/me. The front end uses role to pick the student or staff portal.
router.get('/', (req, res) => {
  const p = req.profile;
  res.json({ id: p.id, fullName: p.full_name, studentId: p.student_id, email: p.email, role: p.role });
});

// Story 7 (SRRS-7): GET /api/me/reservations?scope=upcoming|past
router.get('/reservations', handle(async (req, res) => {
  const now = new Date().toISOString();
  let q = req.db.from('reservations').select(RES_SELECT).eq('user_id', req.user.id);
  q = req.query.scope === 'past'
    ? q.or(`status.eq.cancelled,ends_at.lte.${now}`).order('starts_at', { ascending: false })
    : q.eq('status', 'confirmed').gt('ends_at', now).order('starts_at', { ascending: true });
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  res.json(data.map(toReservation));
}));

export default router;
