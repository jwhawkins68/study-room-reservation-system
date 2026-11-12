// SRRS-10: move my booking to another open time. If the new time fails any rule, the original stays put.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  RuleError, errorResponse, requireUser, parseWindow, loadRoom,
  checkRules, conflicts, logAttempt, logEvent, toReservation,
} from '../../shared/booking.ts';

const RULES = ['ROOM_TAKEN', 'ROOM_BLOCKED', 'OVER_CAPACITY', 'TOO_LONG', 'IN_PAST', 'ROOM_INACTIVE'];

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  let user: any;
  let body: any = {};
  let roomId: string | undefined;
  try {
    user = await requireUser(base44);
    body = await req.json().catch(() => ({}));
    const rows = await sr.entities.Reservation.filter({ id: String(body.id || '') }, undefined, 1);
    const r = rows?.[0];
    if (!r || r.user_id !== user.id) throw new RuleError('NOT_FOUND', 'Booking not found.', 404);
    roomId = r.room_id;
    if (r.status !== 'confirmed') throw new RuleError('VALIDATION', 'That booking is cancelled.', 400);
    if (Date.parse(r.starts_at) <= Date.now()) throw new RuleError('VALIDATION', 'That booking has already started.', 400);

    const { s, e } = parseWindow(body.start, body.end);
    const room = await loadRoom(sr, r.room_id);
    await checkRules(sr, { room, s, e, partySize: r.party_size || 1, excludeId: r.id });

    const before = { starts_at: r.starts_at, ends_at: r.ends_at };
    const after = { starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString() };
    const updated = await sr.entities.Reservation.update(r.id, after);

    // Same race guard as booking: if another booking now overlaps, put the original time back.
    if ((await conflicts(sr, room.id, s, e, r.id)).length) {
      await sr.entities.Reservation.update(r.id, before);
      throw new RuleError('ROOM_TAKEN', 'That time is already booked. Your booking wasn’t changed.');
    }

    await logEvent(sr, { reservation: r, room, actor: user, action: 'changed', before, after });
    return Response.json(toReservation({ ...r, ...updated }, room));
  } catch (err) {
    if (err instanceof RuleError && user && RULES.includes(err.code)) {
      await logAttempt(sr, user.id, roomId, body.start, body.end, err.code);
    }
    return errorResponse(err);
  }
}
