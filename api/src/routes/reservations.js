import { Router } from 'express';
import { admin } from '../supabase.js';
import { ApiError, handle, fromDbError } from '../errors.js';

const router = Router();

export const RES_SELECT = 'id, room_id, user_id, starts_at, ends_at, party_size, purpose, status, created_at, cancelled_at, rooms(name, building)';

export function toReservation(r) {
  return {
    id: r.id,
    roomId: r.room_id,
    roomName: r.rooms?.name,
    building: r.rooms?.building,
    start: r.starts_at,
    end: r.ends_at,
    partySize: r.party_size,
    purpose: r.purpose,
    status: r.status,
    createdAt: r.created_at,
    cancelledAt: r.cancelled_at,
  };
}

// Story 11 needs rejected attempts, so log them. Best effort: never blocks the response.
async function logAttempt(userId, body, code) {
  if (!admin) return;
  const { error } = await admin.from('booking_attempts').insert({
    user_id: userId,
    room_id: Number(body.roomId) || null,
    starts_at: body.start || null,
    ends_at: body.end || null,
    reason_code: code,
  });
  if (error) console.warn('Could not log booking attempt:', error.message);
}

const isDate = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

// Story 6 (SRRS-6): POST /api/reservations
// The database itself blocks double-booking and enforces the booking rules; this maps its errors.
router.post('/', handle(async (req, res) => {
  if (req.profile.role !== 'student') throw new ApiError(403, 'FORBIDDEN', 'Only students can book rooms.');
  const { roomId, start, end } = req.body;
  const partySize = Number(req.body.partySize ?? 1);
  const purpose = String(req.body.purpose ?? '').trim().slice(0, 200);

  const bad = [];
  if (!Number.isInteger(Number(roomId))) bad.push('roomId');
  if (!isDate(start)) bad.push('start');
  if (!isDate(end)) bad.push('end');
  if (!Number.isInteger(partySize) || partySize < 1) bad.push('partySize');
  if (bad.length) throw new ApiError(400, 'VALIDATION', 'Some fields are missing or invalid.', bad);
  if (Date.parse(end) <= Date.parse(start)) throw new ApiError(400, 'VALIDATION', 'The end time must be after the start time.');

  const { data, error } = await req.db
    .from('reservations')
    .insert({ room_id: Number(roomId), user_id: req.user.id, starts_at: start, ends_at: end, party_size: partySize, purpose })
    .select(RES_SELECT)
    .single();

  if (error) {
    const e = fromDbError(error);
    await logAttempt(req.user.id, req.body, e.code);
    throw e;
  }
  res.status(201).json(toReservation(data));
}));

// Story 8 (SRRS-8): POST /api/reservations/:id/cancel
// Students cancel their own upcoming bookings; staff can cancel any (row-level security decides who sees what).
router.post('/:id/cancel', handle(async (req, res) => {
  const id = Number(req.params.id);
  const { data: r, error } = await req.db.from('reservations').select(RES_SELECT).eq('id', id).maybeSingle();
  if (error) throw fromDbError(error);
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'Booking not found.');
  if (r.status !== 'confirmed') throw new ApiError(400, 'VALIDATION', 'That booking is already cancelled.');
  if (req.profile.role === 'student' && new Date(r.starts_at) <= new Date()) {
    throw new ApiError(400, 'VALIDATION', 'That booking has already started.');
  }

  const { data, error: uErr } = await req.db
    .from('reservations')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .select(RES_SELECT)
    .single();
  if (uErr) throw fromDbError(uErr);
  res.json(toReservation(data));
}));

export default router;
