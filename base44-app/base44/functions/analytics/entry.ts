// SRRS-22: staff analytics and the AI daily brief. Everything is counted from live data;
// the AI only turns today's numbers into a short plain-English summary. Coordinators see only their buildings.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, requireUser, requireStaff, inScope, overlaps } from '../../shared/booking.ts';
import { checkedBrief } from '../../shared/brief.ts';

const TZ = 'America/Chicago';
const OPEN_HOURS = 14; // rooms bookable 8 AM – 10 PM
const dayKey = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));
const hourOf = (ms: number) => Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms)));
const label = (k: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(k + 'T12:00:00Z'));

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const scope = requireStaff(user);
    const body = await req.json().catch(() => ({}));
    const days = [7, 14, 30].includes(Number(body.days)) ? Number(body.days) : 14;
    const now = Date.now();
    const from = now - days * 86400000;
    const ahead = now + 7 * 86400000;

    const rooms = (await sr.entities.Room.list(undefined, 5000)).filter((r: any) => inScope(scope, r.building));
    const byId = new Map(rooms.map((r: any) => [r.id, r]));
    const all = (await sr.entities.Reservation.list('-starts_at', 5000)).filter((r: any) => byId.has(r.room_id));
    const inWindow = (r: any) => { const t = Date.parse(r.starts_at); return t >= from && t <= ahead; };
    const conf = all.filter((r: any) => r.status === 'confirmed' && inWindow(r));
    const canc = all.filter((r: any) => r.status === 'cancelled' && inWindow(r));
    const attempts = (await sr.entities.BookingAttempt.list('-created_date', 5000))
      .filter((a: any) => Date.parse(a.created_date) >= from && (!a.room_id || byId.has(a.room_id)));
    const blocks = (await sr.entities.RoomBlock.list(undefined, 5000)).filter((b: any) => byId.has(b.room_id));
    const hours = (r: any) => (Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 3600000;

    // Bookings per day: the last `days` days plus the coming week.
    const perDay: any[] = [];
    for (let t = from; t <= ahead; t += 86400000) perDay.push({ date: dayKey(t), label: label(dayKey(t)), bookings: 0, future: t > now });
    const idx = new Map(perDay.map((d, i) => [d.date, i]));
    for (const r of conf) { const i = idx.get(dayKey(Date.parse(r.starts_at))); if (i !== undefined) perDay[i].bookings += 1; }

    const byHour = Array.from({ length: 14 }, (_, i) => ({ hour: 8 + i, label: `${((8 + i) % 12) || 12} ${8 + i < 12 ? 'AM' : 'PM'}`, bookings: 0 }));
    for (const r of conf) { const h = hourOf(Date.parse(r.starts_at)); if (h >= 8 && h < 22) byHour[h - 8].bookings += 1; }

    const usage = rooms.map((room: any) => {
      const mine = conf.filter((r: any) => r.room_id === room.id);
      const h = mine.reduce((a: number, r: any) => a + hours(r), 0);
      const turnedAway = attempts.filter((a: any) => a.room_id === room.id && a.reason_code === 'ROOM_TAKEN').length;
      return { id: room.id, name: room.name, building: room.building, capacity: room.capacity, bookings: mine.length, hours: Math.round(h * 10) / 10,
        utilization: Math.round((h / ((days + 7) * OPEN_HOURS)) * 1000) / 10, turnedAway };
    }).sort((a: any, b: any) => b.hours - a.hours || b.bookings - a.bookings);

    const byBuilding = [...new Set(rooms.map((r: any) => r.building))].map((b) => ({
      building: b, bookings: conf.filter((r: any) => byId.get(r.room_id)?.building === b).length,
    })).sort((a, b) => b.bookings - a.bookings);

    const reasons = new Map<string, number>();
    for (const a of attempts) reasons.set(a.reason_code, (reasons.get(a.reason_code) || 0) + 1);

    const today = dayKey(now);
    const todays = conf.filter((r: any) => dayKey(Date.parse(r.starts_at)) === today);
    const inUse = new Set(todays.filter((r: any) => overlaps(Date.parse(r.starts_at), Date.parse(r.ends_at), now, now + 1)).map((r: any) => r.room_id));
    const closuresToday = blocks.filter((b: any) => dayKey(Date.parse(b.starts_at)) <= today && dayKey(Date.parse(b.ends_at)) >= today);
    const yesterday = dayKey(now - 86400000);
    const rejectedYesterday = attempts.filter((a: any) => dayKey(Date.parse(a.created_date)) === yesterday).length;
    const busiestToday = [...todays.reduce((m: Map<string, number>, r: any) => m.set(r.room_id, (m.get(r.room_id) || 0) + hours(r)), new Map()).entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, h]) => `${byId.get(id)?.name} (${byId.get(id)?.building}, ${h} h)`);
    const peak = [...byHour].sort((a, b) => b.bookings - a.bookings)[0];
    const facts = {
      today, bookingsToday: todays.length, roomsInUseNow: inUse.size, closuresToday: closuresToday.length,
      rejectedYesterday, busiestRoomsToday: busiestToday, peakStartTime: peak?.bookings ? peak.label : null,
      mostUsedRoom: usage[0]?.bookings ? `${usage[0].name} (${usage[0].building})` : null,
      // only open rooms: a room staff have closed isn't "underused"
      leastUsedRooms: usage.filter((u: any) => u.bookings === 0 && byId.get(u.id)?.is_active !== false).slice(0, 3).map((u: any) => u.name),
      scope: scope.all ? 'all buildings' : scope.buildings.join(', '),
    };

    let briefText = '';
    let briefSource = 'facts';
    if (body.brief !== false) {
      try {
        briefText = String(await sr.integrations.Core.InvokeLLM({
          prompt: `Write a short morning brief (2 or 3 sentences, plain English, no bullet points, no greeting) for the staff who manage campus study rooms at Prairie View A&M University (${facts.scope}). Use ONLY these facts: do not invent numbers, and name a room only if its exact name appears in the facts. Skip any fact that is empty or zero unless it is good news. End with one practical suggestion if the facts support one.\n${JSON.stringify(facts)}`,
        })).trim().slice(0, 600);
      } catch (err) {
        console.warn('Brief not generated:', err);
      }
      // never show a brief that names a room the facts don't list (a safety net: the model can invent names)
      const checked = checkedBrief(briefText, facts);
      briefText = checked.text;
      briefSource = checked.source;
    }

    return Response.json({
      days, scope: facts.scope,
      totals: {
        confirmed: conf.length, cancelled: canc.length, cancelledByStaff: canc.filter((r: any) => r.cancelled_by_name && r.cancelled_by_name !== r.user_name).length,
        rejected: attempts.length, bookers: new Set(conf.map((r: any) => r.user_id)).size,
        hours: Math.round(conf.reduce((a: number, r: any) => a + hours(r), 0) * 10) / 10,
      },
      perDay, byHour, usage, byBuilding,
      rejected: [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
      brief: { ...facts, text: briefText, source: briefSource },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
