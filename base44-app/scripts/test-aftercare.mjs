// SRRS-20: tests for the rebook offer search (no Base44 account needed).
// Build first: npx esbuild base44/shared/aftercare.ts --bundle --format=esm --outfile=/tmp/aftercare.mjs
import { findAlternative } from '/tmp/aftercare.mjs';

const H = 3600000;
const base = Date.now() + 48 * H; // two days out
const iso = (t) => new Date(t).toISOString();
const room = (id, building, capacity, amenities = [], extra = {}) => ({ id, name: `Room ${id}`, building, capacity, amenities, is_active: true, ...extra });
const fakeSr = ({ rooms, res = [], blocks = [] }) => ({
  entities: {
    Room: { list: async () => rooms },
    Reservation: { filter: async () => res },
    RoomBlock: { list: async () => blocks },
  },
});
const booking = { id: 'b1', room_id: 'A', party_size: 4, starts_at: iso(base), ends_at: iso(base + 2 * H) };
let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('PASS ', name); } catch (e) { fail++; console.log('FAIL ', name, '-', e.message); }
}
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${b}, got ${a}`); };

const A = room('A', 'Library', 6, ['Whiteboard']);
await t('prefers a free room in the same building with the same features', async () => {
  const alt = await findAlternative(fakeSr({ rooms: [A, room('B', 'Collins', 6, ['Whiteboard']), room('C', 'Library', 8, ['Whiteboard'])] }), booking, A);
  eq(alt.room.id, 'C'); eq(alt.start, base);
});
await t('never offers a room that is too small', async () => {
  const alt = await findAlternative(fakeSr({ rooms: [A, room('S', 'Library', 2, ['Whiteboard']), room('B', 'Collins', 4)] }), booking, A);
  eq(alt.room.id, 'B');
});
await t('skips rooms that are booked at that time', async () => {
  const res = [{ id: 'x', room_id: 'C', starts_at: iso(base + H), ends_at: iso(base + 3 * H) }];
  const alt = await findAlternative(fakeSr({ rooms: [A, room('C', 'Library', 8, ['Whiteboard']), room('D', 'Collins', 6)], res }), booking, A);
  eq(alt.room.id, 'D');
});
await t('skips rooms closed by staff at that time', async () => {
  const blocks = [{ room_id: 'C', starts_at: iso(base - H), ends_at: iso(base + H) }];
  const alt = await findAlternative(fakeSr({ rooms: [A, room('C', 'Library', 8), room('D', 'Collins', 6)], blocks }), booking, A);
  eq(alt.room.id, 'D');
});
await t('skips closed rooms (is_active = false)', async () => {
  const alt = await findAlternative(fakeSr({ rooms: [A, room('C', 'Library', 8, [], { is_active: false }), room('D', 'Collins', 6)] }), booking, A);
  eq(alt.room.id, 'D');
});
await t('falls back to the same room at the nearest open time', async () => {
  const blocks = [{ room_id: 'A', starts_at: iso(base), ends_at: iso(base + 2 * H) }];
  const alt = await findAlternative(fakeSr({ rooms: [A], blocks }), booking, A);
  eq(alt.room.id, 'A'); eq(Math.abs(alt.start - base) >= 2 * H || alt.start <= base - 2 * H, true);
});
await t('offers nothing when nothing fits', async () => {
  const blocks = [{ room_id: 'A', starts_at: iso(base - 5 * H), ends_at: iso(base + 6 * H) }];
  const alt = await findAlternative(fakeSr({ rooms: [A, room('T', 'Library', 2)], blocks }), booking, A);
  eq(alt, null);
});
await t('half-open: a booking ending exactly at the start does not block', async () => {
  const res = [{ id: 'x', room_id: 'C', starts_at: iso(base - 2 * H), ends_at: iso(base) }];
  const alt = await findAlternative(fakeSr({ rooms: [A, room('C', 'Library', 8, ['Whiteboard'])], res }), booking, A);
  eq(alt.room.id, 'C');
});
console.log(fail ? `${fail} failed` : `all ${pass} passed`);
process.exit(fail ? 1 : 0);
