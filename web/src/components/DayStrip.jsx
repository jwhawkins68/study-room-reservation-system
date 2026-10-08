// The day view for one room: half-hour cells from 8 a.m. to 10 p.m.,
// each open, reserved, blocked by staff, or already past.
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;
const STEP_MIN = 30;

export function buildSlots(dateStr, busy, now = new Date()) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const slots = [];
  for (let mins = DAY_START_HOUR * 60; mins < DAY_END_HOUR * 60; mins += STEP_MIN) {
    const start = new Date(y, m - 1, d, 0, mins);
    const end = new Date(y, m - 1, d, 0, mins + STEP_MIN);
    let state = 'open';
    for (const b of busy) {
      if (new Date(b.start) < end && new Date(b.end) > start) {
        state = b.kind === 'blocked' ? 'blocked' : 'reserved';
        if (state === 'blocked') break;
      }
    }
    if (state === 'open' && end <= now) state = 'past';
    slots.push({ start, end, state });
  }
  return slots;
}

export function openWindows(slots) {
  const windows = [];
  for (const s of slots) {
    const last = windows.at(-1);
    if (s.state !== 'open') continue;
    if (last && last.end.getTime() === s.start.getTime()) last.end = s.end;
    else windows.push({ start: s.start, end: s.end });
  }
  return windows;
}

export const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const LABELS = { open: 'Open', reserved: 'Reserved', blocked: 'Closed by staff', past: 'Past' };

export default function DayStrip({ slots }) {
  const hours = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h += 2) hours.push(h);

  return (
    <figure className="daystrip">
      <div className="daystrip-cells" role="list" aria-label="Half-hour time slots">
        {slots.map((s) => (
          <div
            key={s.start.toISOString()}
            role="listitem"
            className={`slot slot--${s.state}`}
            title={`${fmtTime(s.start)}–${fmtTime(s.end)}: ${LABELS[s.state]}`}
            aria-label={`${fmtTime(s.start)} to ${fmtTime(s.end)}, ${LABELS[s.state]}`}
          />
        ))}
      </div>
      <div className="daystrip-hours" aria-hidden="true">
        {hours.map((h) => (
          <span key={h} style={{ left: `${((h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}>
            {h === 12 ? '12 p.m.' : h > 12 ? `${h - 12} p.m.` : `${h} a.m.`}
          </span>
        ))}
      </div>
      <figcaption className="legend">
        {['open', 'reserved', 'blocked', 'past'].map((k) => (
          <span key={k} className="legend-item">
            <span className={`swatch slot--${k}`} aria-hidden="true" />
            {LABELS[k]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
