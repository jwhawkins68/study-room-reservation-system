// SRRS-14: who booked, changed, or cancelled each reservation and when. Coordinators see their buildings only.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, requireStaff, inScope } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const scope = requireStaff(user);
    const body = await req.json().catch(() => ({}));
    const from = Date.parse(body.from);
    const to = Date.parse(body.to);
    if (Number.isNaN(from) || Number.isNaN(to)) throw new RuleError('VALIDATION', 'Pick a valid date range.', 400);
    const q = String(body.q ?? '').trim().toLowerCase();

    const events = (await sr.entities.BookingEvent.list('-created_date', 5000))
      .filter((e: any) => inScope(scope, e.building))
      .filter((e: any) => { const at = Date.parse(e.created_date); return at >= from && at < to; })
      .filter((e: any) => !body.action || e.action === body.action)
      .filter((e: any) => !q || [e.actor_name, e.booker_name, e.room_name, e.building].some((v) => String(v || '').toLowerCase().includes(q)))
      .slice(0, 500)
      .map((e: any) => ({
        id: e.id, at: e.created_date, action: e.action, reservationId: e.reservation_id,
        roomName: e.room_name, building: e.building, actor: e.actor_name, actorRole: e.actor_role, booker: e.booker_name,
        oldStart: e.old_starts_at, oldEnd: e.old_ends_at, newStart: e.new_starts_at, newEnd: e.new_ends_at, note: e.note,
      }));
    return Response.json({ events });
  } catch (err) {
    return errorResponse(err);
  }
}
