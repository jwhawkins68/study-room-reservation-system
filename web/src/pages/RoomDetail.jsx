import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import DayStrip, { buildSlots, openWindows, fmtTime } from '../components/DayStrip';

const MAX_SLOTS = 6; // 3 hours of half-hour slots

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function dayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { from: new Date(y, m - 1, d).toISOString(), to: new Date(y, m - 1, d + 1).toISOString() };
}

const durationLabel = (n) => {
  const mins = n * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
};

// Story 6 preview: pick an open start time (time-slot buttons from Steph's prototype), a length, and book.
function BookingPanel({ room, slots, onBooked }) {
  const [startIdx, setStartIdx] = useState(null);
  const [length, setLength] = useState(2);
  const [partySize, setPartySize] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(null);

  // How many back-to-back open slots follow the chosen start, capped at 3 hours.
  const maxLen = useMemo(() => {
    if (startIdx === null) return 0;
    let n = 0;
    while (startIdx + n < slots.length && slots[startIdx + n].state === 'open' && n < MAX_SLOTS) n += 1;
    return n;
  }, [startIdx, slots]);

  const len = Math.min(length, maxLen || 1);
  const start = startIdx !== null ? slots[startIdx].start : null;
  const end = startIdx !== null ? slots[startIdx + len - 1].end : null;

  async function book() {
    setError('');
    setBusy(true);
    try {
      const res = await api.createReservation({
        roomId: room.id, start: start.toISOString(), end: end.toISOString(), partySize: Number(partySize), purpose: purpose.trim(),
      });
      setBooked(res);
      setStartIdx(null);
      onBooked();
    } catch (e) {
      setError(e.message);
      if (e.code === 'ROOM_TAKEN') onBooked(); // refresh so the taken time shows
    } finally {
      setBusy(false);
    }
  }

  if (booked) {
    return (
      <div className="confirm-box" role="status">
        <h3>You’re booked</h3>
        <p>
          {booked.roomName}, {new Date(booked.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })},{' '}
          {fmtTime(new Date(booked.start))} – {fmtTime(new Date(booked.end))}, group of {booked.partySize}.
        </p>
        <div className="actions">
          <Link to="/student" className="btn btn--primary">Go to my dashboard</Link>
          <button type="button" className="btn btn--outline" onClick={() => setBooked(null)}>Book another time</button>
        </div>
      </div>
    );
  }

  const openSlots = slots.map((s, i) => ({ ...s, i })).filter((s) => s.state === 'open');

  return (
    <section className="booking-panel" aria-labelledby="book-heading">
      <h3 id="book-heading">Reserve this room</h3>
      {openSlots.length === 0 ? (
        <p className="muted">Nothing left to book on this day.</p>
      ) : (
        <>
          <p className="field-label" id="start-label">Start time</p>
          <div className="slot-buttons" role="radiogroup" aria-labelledby="start-label">
            {openSlots.map((s) => (
              <button
                key={s.i}
                type="button"
                role="radio"
                aria-checked={startIdx === s.i}
                className={startIdx === s.i ? 'slot-btn slot-btn--on' : 'slot-btn'}
                onClick={() => { setStartIdx(s.i); setError(''); }}
              >
                {fmtTime(s.start)}
              </button>
            ))}
          </div>

          {startIdx !== null && (
            <div className="booking-fields">
              <label className="field">
                <span>How long</span>
                <select value={len} onChange={(e) => setLength(Number(e.target.value))}>
                  {Array.from({ length: maxLen }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>{durationLabel(n)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Group size</span>
                <select value={partySize} onChange={(e) => setPartySize(e.target.value)}>
                  {Array.from({ length: room.capacity }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>{n === 1 ? 'Just me' : `${n} people`}</option>
                  ))}
                </select>
              </label>
              <label className="field field--wide">
                <span>Purpose <small className="muted">(optional)</small></span>
                <input value={purpose} maxLength={120} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. CINS 5318 group meeting" />
              </label>
            </div>
          )}

          {start && (
            <p className="selected-summary">
              <strong>Selected:</strong> {fmtTime(start)} – {fmtTime(end)}
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className="btn btn--primary" disabled={startIdx === null || busy} onClick={book}>
            {busy ? 'Booking…' : 'Reserve'}
          </button>
        </>
      )}
    </section>
  );
}

// Story 5: see a room's details and which times are taken or blocked. Never shows who booked.
export default function RoomDetail({ backPath = '/student/rooms', canBook = false }) {
  const { id } = useParams();
  const [date, setDate] = useState(todayStr());
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    api.room(id, dayRange(date)).then((r) => active && setRoom(r)).catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [id, date, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const slots = useMemo(() => (room ? buildSlots(date, room.busy) : []), [room, date]);
  const windows = useMemo(() => openWindows(slots), [slots]);

  if (error && !room) {
    return (
      <>
        <p className="form-error" role="alert">{error}</p>
        <Link to={backPath}>Back to rooms</Link>
      </>
    );
  }
  if (!room) return <p className="page-status">Loading room…</p>;

  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <Link to={backPath} className="back">Back to rooms</Link>
      <header className="room-head">
        <div>
          <h1>{room.name}</h1>
          <p className="muted">{room.building}, floor {room.floor}. Seats {room.capacity}.</p>
          <p>{room.description}</p>
          <p className="room-tags">{room.amenities.join(', ')}</p>
        </div>
        <label className="field field--inline">
          <span>Day</span>
          <input type="date" value={date} min={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </header>

      <section aria-labelledby="times-heading" className="times">
        <h2 id="times-heading">{dayLabel}</h2>
        <DayStrip slots={slots} />
        <h3>Open times</h3>
        {windows.length === 0 ? (
          <p className="muted">No open times left on this day. Try another day.</p>
        ) : (
          <ul className="windows">
            {windows.map((w) => (
              <li key={w.start.toISOString()}>{fmtTime(w.start)} – {fmtTime(w.end)}</li>
            ))}
          </ul>
        )}
        {canBook && <BookingPanel key={date} room={room} slots={slots} onBooked={refresh} />}
      </section>
    </>
  );
}
