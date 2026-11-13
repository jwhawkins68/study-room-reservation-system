// SRRS-19 and SRRS-20: what happens after staff cancel a booking or close a room.
// The student gets an in-app notice and an email, plus (when one exists) an offer of the closest open room.
// Offers are found from the live schedule with the same rules as booking, so they are never invented.
import { overlaps, nameOf } from './booking.ts';

const TZ = 'America/Chicago';
const when = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const timeOnly = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const APP_URL = 'https://study-room-reservation-system-5f98d0e0.base44.app';

// Best open alternative for a cancelled booking: same time in another room that fits (same building and
// features first, then snug size), else the same room at the nearest open start within 2 hours the same day.
export async function findAlternative(sr: any, r: any, room: any, avoidRoomIds: string[] = []) {
  const s = Date.parse(r.starts_at);
  const e = Date.parse(r.ends_at);
  const len = e - s;
  const party = Number(r.party_size) || 1;
  const [rooms, res, blocks] = await Promise.all([
    sr.entities.Room.list(undefined, 5000),
    sr.entities.Reservation.filter({ status: 'confirmed' }, undefined, 5000),
    sr.entities.RoomBlock.list(undefined, 5000),
  ]);
  const busy = [...res.filter((x: any) => x.id !== r.id), ...blocks]
    .map((x: any) => ({ room: x.room_id, s: Date.parse(x.starts_at), e: Date.parse(x.ends_at) }));
  const free = (roomId: string, a: number, b: number) => !busy.some((x) => x.room === roomId && overlaps(x.s, x.e, a, b));
  const want = room?.amenities || [];
  const score = (c: any) =>
    (c.building === room?.building ? 0 : 100) + want.filter((a: string) => !(c.amenities || []).includes(a)).length * 20 + (c.capacity - party);
  const candidates = rooms.filter((c: any) => c.is_active !== false && c.capacity >= party && !avoidRoomIds.includes(c.id) && c.id !== room?.id);

  const same = candidates.filter((c: any) => free(c.id, s, e)).sort((a: any, b: any) => score(a) - score(b))[0];
  if (same && s > Date.now()) {
    const parts = [same.building === room?.building ? `also in ${same.building}` : `in ${same.building}`];
    const missing = want.filter((a: string) => !(same.amenities || []).includes(a));
    parts.push(missing.length ? `no ${missing.join(' or ')}` : 'has the same features');
    parts.push(`seats ${same.capacity}`);
    return { room: same, start: s, end: e, reason: `Same time, ${parts.join(', ')}.` };
  }
  // Same room later or earlier the same day (only if the room itself is still usable then).
  if (room && room.is_active !== false) {
    for (let k = 1; k <= 4; k++) {
      for (const dir of [1, -1]) {
        const a = s + dir * k * 30 * 60000;
        if (a < Date.now()) continue;
        if (free(room.id, a, a + len)) {
          return { room, start: a, end: a + len, reason: `Same room, ${dir > 0 ? 'later' : 'earlier'} at ${timeOnly(new Date(a).toISOString())}.` };
        }
      }
    }
  }
  return null;
}

export async function aftercare(sr: any, opts: { reservation: any; room: any; staff: any; kind: 'cancelled_by_staff' | 'room_closed'; reason: string }) {
  const { reservation: r, room, staff, kind, reason } = opts;
  // Staff cancelling their own booking needs no notice.
  if (!r?.user_id || r.user_id === staff?.id) return { notified: false, offered: false };
  try {
    const user = (await sr.entities.User.filter({ id: r.user_id }, undefined, 1))?.[0];
    const alt = await findAlternative(sr, r, room);
    let offer: any = null;
    if (alt) {
      // Replace any older pending offer for this booking.
      for (const old of await sr.entities.RebookOffer.filter({ reservation_id: r.id, status: 'pending' }, undefined, 10)) {
        await sr.entities.RebookOffer.update(old.id, { status: 'expired' });
      }
      offer = await sr.entities.RebookOffer.create({
        user_id: r.user_id, reservation_id: r.id, room_id: alt.room.id, room_name: alt.room.name, building: alt.room.building,
        starts_at: new Date(alt.start).toISOString(), ends_at: new Date(alt.end).toISOString(),
        party_size: r.party_size || 1, reason: alt.reason, status: 'pending',
      });
    }
    const what = `${room?.name || 'Your room'}${room?.building ? ` (${room.building})` : ''}, ${when(r.starts_at)}`;
    const title = kind === 'room_closed' ? `Room closed: ${room?.name || 'your room'}` : `Booking cancelled: ${room?.name || 'your room'}`;
    const body = [
      `${kind === 'room_closed' ? 'Staff closed the room for your booking' : 'Staff cancelled your booking'}: ${what}.`,
      reason ? `Reason: ${reason}.` : '',
      offer ? `We found an open room for you: ${offer.room_name} (${offer.building}), ${when(offer.starts_at)} – ${timeOnly(offer.ends_at)}. ${offer.reason} Open your dashboard and press "Move me" to book it.` : 'Open your dashboard to find another room.',
    ].filter(Boolean).join(' ');
    const note = await sr.entities.Notification.create({ user_id: r.user_id, reservation_id: r.id, kind, title, body });
    if (user?.email) {
      try {
        await sr.integrations.Core.SendEmail({
          to: user.email,
          subject: title,
          body: `<p>Hi ${nameOf(user).split(' ')[0]},</p><p>${body}</p><p><a href="${APP_URL}/student">Open your dashboard</a></p><p style="color:#666">Study Room Reservation System, a CINS 5318 class prototype at Prairie View A&amp;M University.</p>`,
        });
        await sr.entities.Notification.update(note.id, { emailed_at: new Date().toISOString() });
      } catch (err) {
        console.warn('Email not sent:', err);
      }
    }
    return { notified: true, offered: !!offer };
  } catch (err) {
    console.warn('Aftercare failed:', err);
    return { notified: false, offered: false };
  }
}
