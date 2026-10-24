// SRRS-8: cancel a booking so the room opens up. Students cancel their own upcoming bookings; staff can cancel any.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, isStaff, toReservation } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const body = await req.json().catch(() => ({}));
    const rows = await sr.entities.Reservation.filter({ id: String(body.id || '') }, undefined, 1);
    const r = rows?.[0];
    if (!r || (!isStaff(user) && r.user_id !== user.id)) throw new RuleError('NOT_FOUND', 'Booking not found.', 404);
    if (r.status !== 'confirmed') throw new RuleError('VALIDATION', 'That booking is already cancelled.', 400);
    if (!isStaff(user) && Date.parse(r.starts_at) <= Date.now()) {
      throw new RuleError('VALIDATION', 'That booking has already started.', 400);
    }
    const updated = await sr.entities.Reservation.update(r.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });
    const room = (await sr.entities.Room.filter({ id: r.room_id }, undefined, 1))?.[0];
    return Response.json(toReservation({ ...r, ...updated }, room));
  } catch (err) {
    return errorResponse(err);
  }
}
