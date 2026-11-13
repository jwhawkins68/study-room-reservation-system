// SRRS-19/20: the signed-in user's notices and rebook offers.
// actions: list (default) · read { ids } · accept { offerId } · dismiss { offerId }
// Accepting books the offered room through the same rules as book-room, and logs it.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  RuleError, errorResponse, requireUser, roleOf, loadRoom, checkRules, conflicts, logEvent, logAttempt, toReservation, nameOf,
} from '../../shared/booking.ts';

const shapeNote = (n: any) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, at: n.created_date, read: !!n.read_at, emailed: !!n.emailed_at });
const shapeOffer = (o: any) => ({
  id: o.id, reservationId: o.reservation_id, roomId: o.room_id, roomName: o.room_name, building: o.building,
  start: o.starts_at, end: o.ends_at, partySize: o.party_size, reason: o.reason, status: o.status,
});

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  let user: any;
  try {
    user = await requireUser(base44);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';

    if (action === 'read') {
      const ids: string[] = (Array.isArray(body.ids) ? body.ids : []).slice(0, 50).map(String);
      for (const id of ids) {
        const n = (await sr.entities.Notification.filter({ id, user_id: user.id }, undefined, 1))?.[0];
        if (n && !n.read_at) await sr.entities.Notification.update(n.id, { read_at: new Date().toISOString() });
      }
    }

    if (action === 'accept' || action === 'dismiss') {
      const o = (await sr.entities.RebookOffer.filter({ id: String(body.offerId || ''), user_id: user.id }, undefined, 1))?.[0];
      if (!o) throw new RuleError('NOT_FOUND', 'That offer no longer exists.', 404);
      if (o.status !== 'pending') throw new RuleError('VALIDATION', 'That offer was already used or dismissed.', 400);
      if (action === 'dismiss') {
        await sr.entities.RebookOffer.update(o.id, { status: 'dismissed' });
      } else {
        const s = Date.parse(o.starts_at);
        const e = Date.parse(o.ends_at);
        const room = await loadRoom(sr, o.room_id);
        const old = (await sr.entities.Reservation.filter({ id: o.reservation_id }, undefined, 1))?.[0];
        try {
          await checkRules(sr, { room, s, e, partySize: o.party_size || 1 });
        } catch (err) {
          if (err instanceof RuleError) {
            await logAttempt(sr, user.id, room.id, o.starts_at, o.ends_at, err.code);
            await sr.entities.RebookOffer.update(o.id, { status: 'expired' });
            throw new RuleError(err.code, `${err.message} Someone booked it first, so this offer has expired.`, err.status);
          }
          throw err;
        }
        const created = await sr.entities.Reservation.create({
          room_id: room.id, user_id: user.id, user_email: user.email, user_name: nameOf(user), booker_role: roleOf(user),
          booker_student_id: user.student_id || undefined,
          starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(),
          party_size: o.party_size || 1, purpose: old?.purpose || 'Moved after a staff change', status: 'confirmed',
        });
        if ((await conflicts(sr, room.id, s, e, created.id)).length) {
          await sr.entities.Reservation.delete(created.id);
          await sr.entities.RebookOffer.update(o.id, { status: 'expired' });
          throw new RuleError('ROOM_TAKEN', 'Someone booked that room first, so this offer has expired.');
        }
        await sr.entities.RebookOffer.update(o.id, { status: 'accepted', new_reservation_id: created.id });
        await logEvent(sr, { reservation: created, room, actor: user, action: 'created', after: created, note: 'Accepted a rebook offer' });
        await sr.entities.Notification.create({
          user_id: user.id, reservation_id: created.id, kind: 'rebooked',
          title: `Booked: ${room.name}`, body: `You moved to ${room.name} (${room.building}). It is in My bookings.`, read_at: new Date().toISOString(),
        });
        const [notes, offers] = await load(sr, user.id);
        return Response.json({ booking: toReservation(created, room), notifications: notes, offers }, { status: 201 });
      }
    }

    const [notes, offers] = await load(sr, user.id);
    return Response.json({ notifications: notes, offers });
  } catch (err) {
    return errorResponse(err);
  }
}

async function load(sr: any, userId: string) {
  const [notes, offers] = await Promise.all([
    sr.entities.Notification.filter({ user_id: userId }, '-created_date', 20),
    sr.entities.RebookOffer.filter({ user_id: userId, status: 'pending' }, '-created_date', 20),
  ]);
  const now = Date.now();
  const live: any[] = [];
  for (const o of offers) {
    if (Date.parse(o.starts_at) <= now) await sr.entities.RebookOffer.update(o.id, { status: 'expired' });
    else live.push(shapeOffer(o));
  }
  return [notes.map(shapeNote), live];
}
