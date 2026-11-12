// SRRS-5: busy times for one room. Students get times only, never who booked.
// SRRS-16: staff also get who booked, whether they're a student or staff, student ID, group, purpose, and when it was booked.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, isStaff, overlaps } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const body = await req.json().catch(() => ({}));
    const from = Date.parse(body.from);
    const to = Date.parse(body.to);
    if (!body.roomId || Number.isNaN(from) || Number.isNaN(to)) {
      throw new RuleError('VALIDATION', 'roomId, from, and to are required.', 400);
    }
    const staff = isStaff(user);

    const reservations = await sr.entities.Reservation.filter({ room_id: body.roomId, status: 'confirmed' }, undefined, 5000);
    const blocks = await sr.entities.RoomBlock.filter({ room_id: body.roomId }, undefined, 5000);

    const busy = [
      ...reservations
        // A user changing their own booking (SRRS-10) sees that slot as free.
        .filter((r: any) => !(body.excludeId && r.id === body.excludeId && r.user_id === user.id))
        .filter((r: any) => overlaps(Date.parse(r.starts_at), Date.parse(r.ends_at), from, to))
        .map((r: any) => ({
          start: r.starts_at,
          end: r.ends_at,
          kind: 'reserved',
          mine: r.user_id === user.id,
          ...(staff ? {
            booking: {
              id: r.id, name: r.user_name, email: r.user_email, role: r.booker_role || 'student',
              studentId: r.booker_student_id, partySize: r.party_size, purpose: r.purpose, bookedAt: r.created_date,
            },
          } : {}),
        })),
      ...blocks
        .filter((b: any) => overlaps(Date.parse(b.starts_at), Date.parse(b.ends_at), from, to))
        .map((b: any) => ({
          start: b.starts_at, end: b.ends_at, kind: 'blocked', reason: b.reason,
          ...(staff ? { blockId: b.id, blockedBy: b.created_by_name } : {}),
        })),
    ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

    return Response.json({ busy });
  } catch (err) {
    return errorResponse(err);
  }
}
