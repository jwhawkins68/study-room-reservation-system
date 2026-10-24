// Run: npx esbuild base44/shared/booking.ts --format=esm --outfile=/tmp/booking.mjs && node scripts/test-booking-rules.mjs
import * as B from '/tmp/booking.mjs';
let n = 0; const store = { Room: [], Reservation: [], RoomBlock: [], BookingAttempt: [] };
const ent = (name) => ({
  filter: async (q) => store[name].filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)),
  list: async () => store[name],
  create: async (d) => { const r = { id: 'id' + (++n), ...d }; store[name].push(r); return r; },
  update: async (id, d) => { const r = store[name].find((x) => x.id === id); Object.assign(r, d); return r; },
  delete: async (id) => { store[name] = store[name].filter((x) => x.id !== id); },
});
const sr = { entities: { Room: ent('Room'), Reservation: ent('Reservation'), RoomBlock: ent('RoomBlock'), BookingAttempt: ent('BookingAttempt') } };
const room = await sr.entities.Room.create({ name: 'R', capacity: 4, is_active: true });
const H = 3600e3, t0 = Math.ceil(Date.now() / H) * H + 24 * H;
const iso = (x) => new Date(x).toISOString();
async function tryBook(s, e, party = 1, excludeId) {
  try { const w = B.parseWindow(iso(s), iso(e)); await B.checkRules(sr, { room, s: w.s, e: w.e, partySize: party, excludeId }); 
        if (!excludeId) await sr.entities.Reservation.create({ room_id: room.id, starts_at: iso(s), ends_at: iso(e), status: 'confirmed' }); return 'OK'; }
  catch (err) { return err.code; }
}
const res = [];
res.push(['first booking 1-2pm', await tryBook(t0, t0 + H), 'OK']);
res.push(['overlap 1:30-2:30', await tryBook(t0 + H / 2, t0 + 1.5 * H), 'ROOM_TAKEN']);
res.push(['back-to-back 2-3pm', await tryBook(t0 + H, t0 + 2 * H), 'OK']);
res.push(['over capacity (5 in 4-seat)', await tryBook(t0 + 5 * H, t0 + 6 * H, 5), 'OVER_CAPACITY']);
res.push(['4 hours', await tryBook(t0 + 7 * H, t0 + 11 * H), 'TOO_LONG']);
res.push(['end before start', await tryBook(t0 + 7 * H, t0 + 6 * H), 'VALIDATION']);
res.push(['in the past', await tryBook(Date.now() - 2 * H, Date.now() - H), 'IN_PAST']);
await sr.entities.RoomBlock.create({ room_id: room.id, starts_at: iso(t0 + 20 * H), ends_at: iso(t0 + 22 * H) });
res.push(['during staff block', await tryBook(t0 + 21 * H, t0 + 22 * H), 'ROOM_BLOCKED']);
const first = store.Reservation[0];
res.push(['change own booking onto itself (exclude self)', await tryBook(t0 + H / 2 - H / 2, t0 + H, 1, first.id), 'OK']);
first.status = 'cancelled';
res.push(['rebook after cancel', await tryBook(t0, t0 + H), 'OK']);
room.is_active = false;
res.push(['closed room', await tryBook(t0 + 12 * H, t0 + 13 * H), 'ROOM_INACTIVE']);
room.is_active = true;
// race guard: two writes both passed the check
const a = await sr.entities.Reservation.create({ room_id: room.id, starts_at: iso(t0 + 30 * H), ends_at: iso(t0 + 31 * H), status: 'confirmed' });
const b = await sr.entities.Reservation.create({ room_id: room.id, starts_at: iso(t0 + 30.5 * H), ends_at: iso(t0 + 31.5 * H), status: 'confirmed' });
const ca = (await B.conflicts(sr, room.id, t0 + 30 * H, t0 + 31 * H, a.id)).length, cb = (await B.conflicts(sr, room.id, t0 + 30.5 * H, t0 + 31.5 * H, b.id)).length;
res.push(['race: both see the clash and undo', ca && cb ? 'BOTH_UNDO' : 'MISSED', 'BOTH_UNDO']);
let fail = 0; for (const [name, got, want] of res) { const ok = got === want; if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${got}${ok ? '' : ' (expected ' + want + ')'}`); }
console.log(fail ? `${fail} failed` : `all ${res.length} passed`);
