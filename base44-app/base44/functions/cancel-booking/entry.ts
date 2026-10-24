// SRRS-8: cancel a booking so the room opens up. Students cancel their own upcoming bookings.
// SRRS-11: staff cancel any booking in the buildings they manage (SRRS-13), with an optional reason.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, staffScope, inScope, logEvent, toReservation } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const body = await req.json().catch(() => ({}));
    const rows = await sr.entities.Reservation.filter({ id: String(body.id || '') }, undefined, 1);
    const r = rows?.[0];
    const room = r ? (await sr.entities.Room.filter({ id: r.room_id }, undefined, 1))?.[0] : null;
    const scope = staffScope(user);
    const own = r && r.user_id === user.id;
    const asStaff = !!r && !own && inScope(scope, room?.building);
    if (!r || (!own && !asStaff)) throw new RuleError('NOT_FOUND', 'Booking not found.', 404);
    if (r.status !== 'confirmed') throw new RuleError('VALIDATION', 'That booking is already cancelled.', 400);
    if (!scope && Date.parse(r.starts_at) <= Date.now()) {
      throw new RuleError('VALIDATION', 'That booking has already started.', 400);
    }
    const reason = String(body.reason ?? '').trim().slice(0, 200);
    const updated = await sr.entities.Reservation.update(r.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by_name: user.full_name || user.email,
      cancel_reason: reason || undefined,
    });
    await logEvent(sr, {
      reservation: r, room, actor: user, action: 'cancelled',
      before: { starts_at: r.starts_at, ends_at: r.ends_at },
      note: asStaff ? `Cancelled by staff${reason ? `: ${reason}` : ''}` : reason || undefined,
    });
    return Response.json(toReservation({ ...r, ...updated }, room));
  } catch (err) {
    return errorResponse(err);
  }
}
