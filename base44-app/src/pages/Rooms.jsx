import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const SIZES = [1, 2, 4, 6, 8, 10];

// Story 9: half-hour start times from 8 a.m. to 9:30 p.m. (rooms close at 10 p.m.).
const TIMES = Array.from({ length: 28 }, (_, i) => {
  const mins = 8 * 60 + i * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
  return { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label };
});
const LENGTHS = [[1, '30 min'], [2, '1 hr'], [3, '1 hr 30 min'], [4, '2 hr'], [5, '2 hr 30 min'], [6, '3 hr']];
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function openWindow(date, time, len) {
  if (!date || !time) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const start = new Date(y, mo - 1, d, h, mi);
  const end = new Date(start.getTime() + len * 30 * 60000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Story 4: browse rooms by group size and features.
export default function Rooms({ basePath = '/student/rooms' }) {
  const [amenities, setAmenities] = useState([]);
  const [rooms, setRooms] = useState(null);
  const [size, setSize] = useState(1);
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [openLen, setOpenLen] = useState(2);
  const win = openWindow(openDate, openTime, openLen);
  const winKey = win ? `${win.start}|${win.end}` : '';
  const inPast = win && Date.parse(win.start) < Date.now();

  useEffect(() => {
    api.amenities().then(setAmenities).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let active = true;
    setRooms(null);
    setError('');
    const [start, end] = winKey && !inPast ? winKey.split('|') : [];
    api
      .rooms({ minCapacity: size > 1 ? size : undefined, amenityIds: picked.length ? picked.join(',') : undefined, start, end })
      .then((r) => active && setRooms(r))
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [size, picked, winKey, inPast]);

  const q = query.trim().toLowerCase();
  const shown = rooms && (q ? rooms.filter((r) => `${r.name} ${r.building}`.toLowerCase().includes(q)) : rooms);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <h1>Find a room</h1>
      <section className="filters" aria-label="Filters">
        <div className="filter">
          <label className="filter-label" htmlFor="room-search">Search</label>
          <input
            id="room-search"
            type="search"
            className="search-input"
            placeholder="Room or building, e.g. Library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter">
          <span className="filter-label" id="size-label">Group size</span>
          <div className="segmented" role="radiogroup" aria-labelledby="size-label">
            {SIZES.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={size === n}
                className={size === n ? 'seg seg--on' : 'seg'}
                onClick={() => setSize(n)}
              >
                {n === 1 ? 'Just me' : `${n}+`}
              </button>
            ))}
          </div>
        </div>
        <div className="filter">
          <span className="filter-label" id="open-label">Open at</span>
          <div className="open-at" role="group" aria-labelledby="open-label">
            <input type="date" aria-label="Day" value={openDate} min={todayStr()} onChange={(e) => setOpenDate(e.target.value)} />
            <select aria-label="Start time" value={openTime} onChange={(e) => setOpenTime(e.target.value)}>
              <option value="">Any time</option>
              {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select aria-label="For how long" value={openLen} onChange={(e) => setOpenLen(Number(e.target.value))}>
              {LENGTHS.map(([n, label]) => <option key={n} value={n}>for {label}</option>)}
            </select>
            {(openDate || openTime) && (
              <button type="button" className="btn btn--quiet" onClick={() => { setOpenDate(''); setOpenTime(''); }}>Clear</button>
            )}
          </div>
          {openTime && !openDate && <small className="muted">Pick a day too.</small>}
          {inPast && <small className="field-error">That time has already passed.</small>}
        </div>
        <div className="filter">
          <span className="filter-label" id="features-label">Needs</span>
          <div className="chips" role="group" aria-labelledby="features-label">
            {amenities.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={picked.includes(a.id)}
                className={picked.includes(a.id) ? 'chip chip--on' : 'chip'}
                onClick={() => toggle(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!rooms && !error && <p className="page-status">Loading rooms…</p>}
      {shown && shown.length === 0 && (
        <div className="empty">
          <p>No rooms match your search and filters.</p>
          <button type="button" className="btn btn--quiet" onClick={() => { setSize(1); setPicked([]); setQuery(''); setOpenDate(''); setOpenTime(''); }}>Clear filters</button>
        </div>
      )}
      {shown && shown.length > 0 && (
        <>
        <p className="result-count">
          {shown.length} {shown.length === 1 ? 'room matches' : 'rooms match'}
          {win && !inPast && `, free ${new Date(win.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} – ${new Date(win.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
        </p>
        <ul className="room-list">
          {shown.map((r) => (
            <li key={r.id} className="room-row">
              <div className="room-cap" aria-label={`Seats ${r.capacity}`}>
                <span className="room-cap-num">{r.capacity}</span>
                <span className="room-cap-unit">seats</span>
              </div>
              <div className="room-main">
                <h2 className="room-name">{r.name}</h2>
                <p className="muted">{r.building}, floor {r.floor}. {r.description}</p>
                <p className="room-tags">{r.amenities.join(', ')}</p>
              </div>
              <Link className="btn btn--outline" to={`${basePath}/${r.id}`}>See open times</Link>
            </li>
          ))}
        </ul>
        </>
      )}
    </>
  );
}
