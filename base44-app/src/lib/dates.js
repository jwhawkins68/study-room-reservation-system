// Small date helpers shared by the staff pages (all in the browser's local time).
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const midnight = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const fmtDay = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtStamp = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–');
export const fmtRange = (s, e) => `${fmtDay(s)}, ${fmtTime(s)} – ${fmtTime(e)}`;
// value for <input type="datetime-local">
export const localInput = (d) => `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const REASONS = {
  ROOM_TAKEN: 'Time already booked',
  ROOM_BLOCKED: 'Room closed by staff',
  OVER_CAPACITY: 'Group too big for room',
  TOO_LONG: 'Longer than 3 hours',
  IN_PAST: 'Time already passed',
  ROOM_INACTIVE: 'Room closed',
};
