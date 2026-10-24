// SRRS booking rules, shared by every booking function.
// Mirrors db/schema.sql in the team repo: the no_double_booking exclusion constraint,
// the max_length check, and the check_reservation_rules() trigger.

export const MAX_MS = 3 * 60 * 60 * 1000; // 3 hours

export class RuleError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status = 409, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof RuleError) {
    return Response.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  return Response.json({ error: { code: 'SERVER_ERROR', message } }, { status: 500 });
}

export async function requireUser(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) throw new RuleError('UNAUTHENTICATED', 'Please log in again.', 401);
  return user;
}

export const isStaff = (user: any) => user?.role === 'admin';

const ms = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : NaN);

// Half-open ranges [start, end): 2:00–3:00 and 3:00–4:00 do NOT overlap.
export const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && aE > bS;

export function parseWindow(start: unknown, end: unknown) {
  const s = ms(start);
  const e = ms(end);
  const bad: string[] = [];
  if (Number.isNaN(s)) bad.push('start');
  if (Number.isNaN(e)) bad.push('end');
  if (bad.length) throw new RuleError('VALIDATION', 'Some fields are missing or invalid.', 400, bad);
  if (e <= s) throw new RuleError('VALIDATION', 'The end time must be after the start time.', 400);
  if (e - s > MAX_MS) throw new RuleError('TOO_LONG', 'Bookings can be at most 3 hours.', 400);
  return { s, e };
}

export async function loadRoom(sr: any, roomId: unknown) {
  if (typeof roomId !== 'string' || !roomId) throw new RuleError('VALIDATION', 'Pick a room.', 400, ['roomId']);
  const rows = await sr.entities.Room.filter({ id: roomId }, undefined, 1);
  const room = rows?.[0];
  if (!room) throw new RuleError('NOT_FOUND', 'That room doesn’t exist.', 404);
  return room;
}

// Confirmed reservations in this room that overlap [s, e), ignoring one reservation (for time changes).
export async function conflicts(sr: any, roomId: string, s: number, e: number, excludeId?: string) {
  const rows = await sr.entities.Reservation.filter({ room_id: roomId, status: 'confirmed' }, undefined, 5000);
  return rows.filter((r: any) => r.id !== excludeId && overlaps(ms(r.starts_at), ms(r.ends_at), s, e));
}

export async function blocksIn(sr: any, roomId: string, s: number, e: number) {
  const rows = await sr.entities.RoomBlock.filter({ room_id: roomId }, undefined, 5000);
  return rows.filter((b: any) => overlaps(ms(b.starts_at), ms(b.ends_at), s, e));
}

// Every rule the database enforced in the Supabase version, in the same order.
export async function checkRules(
  sr: any,
  opts: { room: any; s: number; e: number; partySize: number; excludeId?: string },
) {
  const { room, s, e, partySize, excludeId } = opts;
  if (room.is_active === false) throw new RuleError('ROOM_INACTIVE', 'This room is closed.');
  if (partySize > room.capacity) throw new RuleError('OVER_CAPACITY', `This room fits ${room.capacity} people.`);
  if (s < Date.now()) throw new RuleError('IN_PAST', 'That time has already passed.', 400);
  if ((await blocksIn(sr, room.id, s, e)).length) {
    throw new RuleError('ROOM_BLOCKED', 'This room is closed during that time.');
  }
  if ((await conflicts(sr, room.id, s, e, excludeId)).length) {
    throw new RuleError('ROOM_TAKEN', 'That time is already booked. Pick another time.');
  }
}

// Story 11 needs rejected attempts. Best effort: never blocks the response.
export async function logAttempt(sr: any, userId: string | undefined, roomId: unknown, start: unknown, end: unknown, code: string) {
  try {
    await sr.entities.BookingAttempt.create({
      user_id: userId,
      room_id: typeof roomId === 'string' ? roomId : undefined,
      starts_at: typeof start === 'string' && !Number.isNaN(Date.parse(start)) ? start : undefined,
      ends_at: typeof end === 'string' && !Number.isNaN(Date.parse(end)) ? end : undefined,
      reason_code: code,
    });
  } catch (err) {
    console.warn('Could not log booking attempt:', err);
  }
}

export function toReservation(r: any, room?: any) {
  return {
    id: r.id,
    roomId: r.room_id,
    roomName: room?.name,
    building: room?.building,
    start: r.starts_at,
    end: r.ends_at,
    partySize: r.party_size,
    purpose: r.purpose,
    status: r.status,
    createdAt: r.created_date,
    cancelledAt: r.cancelled_at,
  };
}
