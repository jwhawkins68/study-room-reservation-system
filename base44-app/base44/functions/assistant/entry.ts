// SRRS-18: AI booking assistant. The LLM only reads the request (what, when, how many, which features);
// availability, the user's bookings and staff insights are computed here from the real data, so the
// assistant can't invent an open room. Booking happens only when the user presses "Book it", through book-room.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, isStaff, staffScope, inScope, overlaps, MAX_MS } from '../../shared/booking.ts';

const TZ = 'America/Chicago';
const AMENITIES = ['Whiteboard', 'TV / HDMI', 'Power outlets', 'Webcam', 'Accessible'];
const MAX_TURNS = 12;
const MAX_CHARS = 600;

// ---- time helpers (US Central) ----
function offsetMin(utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return (Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')) - utcMs) / 60000;
}
function centralToUtc(date: string, time: string) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let res = guess - offsetMin(guess) * 60000;
  const off2 = offsetMin(res);
  res = guess - off2 * 60000;
  return res;
}
const todayCentral = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const weekday = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(new Date(ms));
const fmtWhen = (ms: number) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
const fmtTime = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
const hourOf = (ms: number) => Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms)));

const SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['find_rooms', 'my_bookings', 'insights', 'help', 'other'] },
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD in US Central time, resolved from words like "tomorrow" or "Friday"' },
    start_time: { type: ['string', 'null'], description: '24-hour HH:MM, e.g. 14:00 for 2 pm' },
    duration_minutes: { type: ['integer', 'null'] },
    party_size: { type: ['integer', 'null'] },
    amenities: { type: 'array', items: { type: 'string', enum: AMENITIES } },
    building: { type: ['string', 'null'], description: 'Exact building name from the list, or null' },
    room_name: { type: ['string', 'null'], description: 'Exact room name from the list if the user named one, or null' },
    purpose: { type: ['string', 'null'] },
    reply: { type: 'string', description: 'One or two friendly sentences. For find_rooms with a missing day or time, ask for it. Never claim a room is free.' },
  },
  required: ['intent', 'amenities', 'reply'],
};

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const staff = isStaff(user);
    const scope = staffScope(user);
    const body = await req.json().catch(() => ({}));
    const turns = (Array.isArray(body.messages) ? body.messages : [])
      .slice(-MAX_TURNS)
      .map((m: any) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', text: String(m?.text ?? '').slice(0, MAX_CHARS) }))
      .filter((m: any) => m.text.trim());
    if (!turns.length || turns[turns.length - 1].role !== 'user') {
      throw new RuleError('VALIDATION', 'Type a question for the assistant.', 400);
    }

    const rooms = (await sr.entities.Room.list(undefined, 5000)).filter((r: any) => r.is_active !== false);
    const buildings = [...new Set(rooms.map((r: any) => r.building))].sort();
    const today = todayCentral();
    const roomList = rooms.map((r: any) => `${r.name} | ${r.building} | ${r.capacity} seats | ${(r.amenities || []).join(', ') || 'no listed features'}`).join('\n');
    const convo = turns.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');

    const prompt = `You are the booking assistant for the Study Room Reservation System, a Prairie View A&M University class project.
You help ${staff ? 'a staff member' : 'a student'} find and book campus study rooms. Today is ${weekday(Date.now())}, ${today} (US Central time).
Rooms are booked in 30-minute steps, at most 3 hours, between 8:00 AM and 10:00 PM.

Read the conversation and work out what the user wants now, carrying details forward from earlier turns.
- find_rooms: they want a room. Fill date, start_time (24-hour), duration_minutes (default 60 if not said), party_size, amenities (only from: ${AMENITIES.join(', ')}; "TV", "screen", "monitor" or "HDMI" means "TV / HDMI"; "wheelchair" means "Accessible"), building (exact name from: ${buildings.join(', ')}), room_name if they named a room, purpose if they said why.
- my_bookings: they ask what they have booked.
- insights: ${staff ? 'they ask about usage, busiest rooms or times, or rejected bookings.' : 'only staff can use this; treat as other.'}
- help: they ask what you can do.
- other: anything not about study rooms. Reply politely that you only help with study rooms.
Never say a room is open or booked; the system checks that after you answer. Keep reply to one or two sentences.

Rooms:
${roomList}

Conversation:
${convo}`;

    const parsed: any = await sr.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA });
    const intent = parsed?.intent || 'other';
    const out: any = { intent, reply: String(parsed?.reply || '').slice(0, 400) };

    if (intent === 'find_rooms') {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed?.date || '') ? parsed.date : null;
      const time = /^\d{1,2}:\d{2}$/.test(parsed?.start_time || '') ? parsed.start_time.padStart(5, '0') : null;
      if (!date || !time) return Response.json({ ...out, reply: out.reply || 'What day and time do you need the room?' });

      let minutes = Number(parsed?.duration_minutes) || 60;
      let note = '';
      if (minutes > MAX_MS / 60000) { minutes = MAX_MS / 60000; note = ' Bookings are capped at 3 hours, so I searched for 3.'; }
      minutes = Math.max(30, Math.round(minutes / 30) * 30);
      const party = Math.max(1, Math.min(50, Number(parsed?.party_size) || 1));
      const wanted = (parsed?.amenities || []).filter((a: string) => AMENITIES.includes(a));
      const building = buildings.includes(parsed?.building) ? parsed.building : null;
      const named = rooms.find((r: any) => r.name.toLowerCase() === String(parsed?.room_name || '').toLowerCase() && (!building || r.building === building));

      const s = centralToUtc(date, time);
      const e = s + minutes * 60000;
      if (s < Date.now()) return Response.json({ ...out, reply: `${fmtWhen(s)} has already passed. Which day and time would you like instead?` });

      const fits = rooms.filter((r: any) =>
        r.capacity >= party && wanted.every((a: string) => (r.amenities || []).includes(a)) &&
        (!building || r.building === building) && (!named || r.id === named.id));
      const [reservations, blocks] = await Promise.all([
        sr.entities.Reservation.filter({ status: 'confirmed' }, undefined, 5000),
        sr.entities.RoomBlock.list(undefined, 5000),
      ]);
      const busy = [...reservations, ...blocks].map((x: any) => ({ room: x.room_id, s: Date.parse(x.starts_at), e: Date.parse(x.ends_at) }));
      const freeAt = (roomId: string, a: number, b: number) => !busy.some((x) => x.room === roomId && overlaps(x.s, x.e, a, b));
      const bySnugFit = (a: any, b: any) => a.capacity - b.capacity || a.building.localeCompare(b.building) || a.name.localeCompare(b.name);
      const shape = (r: any, a: number, b: number) => ({ roomId: r.id, roomName: r.name, building: r.building, capacity: r.capacity, amenities: r.amenities || [], start: new Date(a).toISOString(), end: new Date(b).toISOString() });

      const what = `${party > 1 ? `${party} people` : 'you'}${wanted.length ? ` with ${wanted.join(' and ')}` : ''}${building ? ` in ${building}` : ''}`;
      if (!fits.length) {
        return Response.json({ ...out, reply: `No open room fits ${what}. The largest room seats ${Math.max(...rooms.map((r: any) => r.capacity))}. Try fewer features or another building.` });
      }
      const open = fits.filter((r: any) => freeAt(r.id, s, e)).sort(bySnugFit).slice(0, 5);
      out.partySize = party;
      out.purpose = parsed?.purpose ? String(parsed.purpose).slice(0, 200) : undefined;
      if (open.length) {
        out.options = open.map((r: any) => shape(r, s, e));
        out.reply = `${open.length === 1 ? 'This room is' : `These ${open.length} rooms are`} open ${fmtWhen(s)} – ${fmtTime(e)} for ${what}.${note} Pick one to book it.`;
        return Response.json(out);
      }
      // Nothing free then: look for the nearest start times the same day, half an hour at a time.
      const alts: any[] = [];
      for (let k = 1; k <= 8 && alts.length < 3; k++) {
        for (const dir of [1, -1]) {
          const a = s + dir * k * 30 * 60000;
          const b = a + minutes * 60000;
          const h = hourOf(a);
          if (a < Date.now() || h < 8 || hourOf(b - 1) >= 22) continue;
          const r = fits.filter((x: any) => freeAt(x.id, a, b)).sort(bySnugFit)[0];
          if (r && !alts.some((o) => o.start === new Date(a).toISOString())) alts.push(shape(r, a, b));
          if (alts.length >= 3) break;
        }
      }
      alts.sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
      out.options = alts;
      out.reply = alts.length
        ? `Nothing that fits ${what} is open at ${fmtTime(s)}, but these nearby times are.${note}`
        : `Nothing that fits ${what} is open around ${fmtWhen(s)}. Try another day.`;
      return Response.json(out);
    }

    if (intent === 'my_bookings') {
      const mine = (await sr.entities.Reservation.filter({ user_id: user.id, status: 'confirmed' }, 'starts_at', 200))
        .filter((r: any) => Date.parse(r.ends_at) > Date.now()).slice(0, 6);
      const byId = new Map(rooms.map((r: any) => [r.id, r]));
      out.bookings = mine.map((r: any) => ({ id: r.id, roomName: byId.get(r.room_id)?.name || 'Room', building: byId.get(r.room_id)?.building, start: r.starts_at, end: r.ends_at, partySize: r.party_size, purpose: r.purpose }));
      out.reply = mine.length ? `You have ${mine.length} upcoming booking${mine.length === 1 ? '' : 's'}.` : 'You don’t have any upcoming bookings. Want me to find a room?';
      return Response.json(out);
    }

    if (intent === 'insights' && staff) {
      const from = Date.now() - 30 * 86400000;
      const to = Date.now() + 14 * 86400000;
      const byId = new Map(rooms.map((r: any) => [r.id, r]));
      const res = (await sr.entities.Reservation.filter({ status: 'confirmed' }, undefined, 5000))
        .filter((r: any) => { const t = Date.parse(r.starts_at); const room = byId.get(r.room_id); return t >= from && t <= to && room && inScope(scope, room.building); });
      const count = (keyOf: (r: any) => string) => {
        const m = new Map<string, number>();
        for (const r of res) m.set(keyOf(r), (m.get(keyOf(r)) || 0) + 1);
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
      };
      const topRooms = count((r) => `${byId.get(r.room_id)?.name} (${byId.get(r.room_id)?.building})`).slice(0, 5);
      const topHours = count((r) => String(hourOf(Date.parse(r.starts_at)))).slice(0, 3)
        .map(([h, n]) => [`${(Number(h) % 12) || 12}:00 ${Number(h) < 12 ? 'AM' : 'PM'}`, n]);
      const attempts = (await sr.entities.BookingAttempt.list('-created_date', 2000))
        .filter((a: any) => Date.parse(a.created_date) >= from && (!a.room_id || inScope(scope, byId.get(a.room_id)?.building || '')));
      const reasons = new Map<string, number>();
      for (const a of attempts) reasons.set(a.reason_code, (reasons.get(a.reason_code) || 0) + 1);
      out.insights = { bookings: res.length, topRooms, topHours, rejected: [...reasons.entries()].sort((a, b) => b[1] - a[1]) };
      out.reply = `Here is booking activity from the last 30 days through the next 2 weeks${scope?.all ? '' : ` in ${scope?.buildings.join(', ')}`}.`;
      return Response.json(out);
    }

    if (intent === 'help' || !out.reply) {
      out.reply = staff
        ? 'I can find open rooms ("a room for 6 with a TV Thursday at 3"), list your bookings, or show usage insights such as the busiest rooms and times.'
        : 'Tell me what you need, like "a room for 4 with a whiteboard tomorrow at 2 for 2 hours", and I’ll show rooms that are open. I can also list your bookings.';
    }
    return Response.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
