// SRRS-11: admin center. Every booking (who, which room, when), filters by room, date range, and student,
// each room's status (in use, booked up, open, closed), and rejected booking attempts.
// Coordinators (SRRS-13) see only their buildings.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, requireStaff, inScope, overlaps } from '../../shared/booking.ts';

const SLOT = 30 * 60 * 1000;
const t = (v: any) => Date.parse(v);

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const scope = requireStaff(user);
    const body = await req.json().catch(() => ({}));
    const from = t(body.from);
    const to = t(body.to);
    const at = Number.isNaN(t(body.at)) ? Date.now() : t(body.at);
    const dayStart = t(body.dayStart); // local midnight of the status day, sent by the browser
    const dayEnd = t(body.dayEnd); // 10 p.m. local on the status day, sent by the browser
    if (Number.isNaN(from) || Number.isNaN(to) || to <= from) throw new RuleError('VALIDATION', 'Pick a valid date range.', 400);

    const [rooms, reservations, blocks, attempts, users] = await Promise.all([
      sr.entities.Room.list(undefined, 5000),
      sr.entities.Reservation.list('-created_date', 5000),
      sr.entities.RoomBlock.list(undefined, 5000),
      sr.entities.BookingAttempt.list('-created_date', 1000),
      sr.entities.User.list(undefined, 5000),
    ]);
    const myRooms = rooms.filter((r: any) => inScope(scope, r.building));
    const roomById = new Map(myRooms.map((r: any) => [r.id, r]));
    const userById = new Map(users.map((u: any) => [u.id, u]));
    const confirmed = reservations.filter((r: any) => r.status === 'confirmed');

    // Room status at the chosen moment
    const status = myRooms.map((room: any) => {
      const busy = [
        ...confirmed.filter((r: any) => r.room_id === room.id).map((r: any) => ({ ...r, kind: 'reserved' })),
        ...blocks.filter((b: any) => b.room_id === room.id).map((b: any) => ({ ...b, kind: 'blocked' })),
      ];
      const covering = (s: number, e: number) => busy.find((b: any) => overlaps(t(b.starts_at), t(b.ends_at), s, e));
      let state = 'open';
      let until: string | undefined;
      if (room.is_active === false) state = 'closed';
      else {
        const now = covering(at, at + 1);
        if (now) { state = now.kind === 'blocked' ? 'blocked' : 'in_use'; until = now.ends_at; }
        if (state === 'open' && !Number.isNaN(dayEnd) && dayEnd > at) {
          let free = false;
          for (let s = Math.ceil(at / SLOT) * SLOT; s < dayEnd; s += SLOT) if (!covering(s, s + SLOT)) { free = true; break; }
          if (!free) state = 'booked_up';
        }
      }
      const ds = Number.isNaN(dayStart) ? at - 12 * 3600000 : dayStart;
      const today = confirmed.filter((r: any) => r.room_id === room.id && overlaps(t(r.starts_at), t(r.ends_at), ds, ds + 86400000)).length;
      return { id: room.id, name: room.name, building: room.building, capacity: room.capacity, state, until, bookingsToday: today };
    }).sort((a: any, b: any) => a.building.localeCompare(b.building) || a.name.localeCompare(b.name, undefined, { numeric: true }));

    // Bookings in range
    const q = String(body.q ?? '').trim().toLowerCase();
    const bookings = reservations
      .filter((r: any) => roomById.has(r.room_id))
      .filter((r: any) => !body.roomId || r.room_id === body.roomId)
      .filter((r: any) => overlaps(t(r.starts_at), t(r.ends_at), from, to))
      .filter((r: any) => !q || [r.user_name, r.user_email, r.booker_student_id].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a: any, b: any) => t(a.starts_at) - t(b.starts_at))
      .map((r: any) => {
        const room: any = roomById.get(r.room_id);
        return {
          id: r.id, roomId: r.room_id, roomName: room?.name, building: room?.building,
          start: r.starts_at, end: r.ends_at, status: r.status, name: r.user_name, email: r.user_email,
          role: r.booker_role || 'student', studentId: r.booker_student_id, partySize: r.party_size,
          purpose: r.purpose, cancelReason: r.cancel_reason, cancelledBy: r.cancelled_by_name,
        };
      });

    // Rejected attempts for those rooms in range (by the time they tried to book)
    const rejected = attempts
      .filter((a: any) => roomById.has(a.room_id))
      .filter((a: any) => !body.roomId || a.room_id === body.roomId)
      .filter((a: any) => { const s = t(a.starts_at || a.created_date); return s >= from && s < to; })
      .slice(0, 200)
      .map((a: any) => {
        const room: any = roomById.get(a.room_id); const u: any = userById.get(a.user_id);
        return { id: a.id, at: a.created_date, roomName: room?.name, building: room?.building, start: a.starts_at, end: a.ends_at, reason: a.reason_code, name: u?.full_name || u?.email || 'Unknown' };
      });

    return Response.json({
      scope: scope.all ? 'all' : scope.buildings,
      status,
      bookings,
      rejected,
      counts: {
        confirmed: bookings.filter((b: any) => b.status === 'confirmed').length,
        cancelled: bookings.filter((b: any) => b.status === 'cancelled').length,
        rejected: rejected.length,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
