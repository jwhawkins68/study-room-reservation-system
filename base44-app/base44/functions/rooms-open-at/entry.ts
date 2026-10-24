// SRRS-9: which rooms are free for a whole time window (no confirmed booking and no staff block overlaps it).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, requireUser, parseWindow, overlaps } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    await requireUser(base44);
    const body = await req.json().catch(() => ({}));
    const { s, e } = parseWindow(body.start, body.end);

    const [reservations, blocks] = await Promise.all([
      sr.entities.Reservation.filter({ status: 'confirmed' }, undefined, 5000),
      sr.entities.RoomBlock.list(undefined, 5000),
    ]);
    const busyRooms = new Set<string>();
    for (const r of [...reservations, ...blocks]) {
      if (overlaps(Date.parse(r.starts_at), Date.parse(r.ends_at), s, e)) busyRooms.add(r.room_id);
    }
    return Response.json({ busyRoomIds: [...busyRooms] });
  } catch (err) {
    return errorResponse(err);
  }
}
