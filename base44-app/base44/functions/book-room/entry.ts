// SRRS-6: book a room under my name.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  RuleError, errorResponse, requireUser, isStaff, parseWindow, loadRoom,
  checkRules, conflicts, logAttempt, toReservation,
} from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  let user: any;
  let body: any = {};
  try {
    user = await requireUser(base44);
    body = await req.json().catch(() => ({}));
    if (isStaff(user)) throw new RuleError('FORBIDDEN', 'Only students can book rooms.', 403);

    const { roomId, start, end } = body;
    const partySize = Number(body.partySize ?? 1);
    const purpose = String(body.purpose ?? '').trim().slice(0, 200);
    if (!Number.isInteger(partySize) || partySize < 1) {
      throw new RuleError('VALIDATION', 'Some fields are missing or invalid.', 400, ['partySize']);
    }
    const { s, e } = parseWindow(start, end);
    const room = await loadRoom(sr, roomId);
    await checkRules(sr, { room, s, e, partySize });

    const created = await sr.entities.Reservation.create({
      room_id: room.id,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      starts_at: new Date(s).toISOString(),
      ends_at: new Date(e).toISOString(),
      party_size: partySize,
      purpose,
      status: 'confirmed',
    });

    // Two requests can pass the check at the same moment. Re-check after writing:
    // if anything else now overlaps, undo ours, so a double booking can never stand.
    if ((await conflicts(sr, room.id, s, e, created.id)).length) {
      await sr.entities.Reservation.delete(created.id);
      throw new RuleError('ROOM_TAKEN', 'That time is already booked. Pick another time.');
    }

    return Response.json(toReservation(created, room), { status: 201 });
  } catch (err) {
    const RULES = ['ROOM_TAKEN', 'ROOM_BLOCKED', 'OVER_CAPACITY', 'TOO_LONG', 'IN_PAST', 'ROOM_INACTIVE'];
    if (err instanceof RuleError && user && RULES.includes(err.code)) {
      await logAttempt(sr, user.id, body.roomId, body.start, body.end, err.code);
    }
    return errorResponse(err);
  }
}
