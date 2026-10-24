import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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

const fmtStamp = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–');

// SRRS-16: the day's bookings with who booked and whether they're a student or staff. Students never get these details.
function StaffBookings({ busy }) {
  const items = busy.filter((b) => b.booking);
  const [open, setOpen] = useState(null);
  return (
    <section aria-labelledby="who-heading" className="panel staff-panel">
      <h3 id="who-heading">Who booked this day</h3>
      {items.length === 0 ? (
        <p className="muted">No bookings on this day.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Booked by</th>
                <th scope="col">Type</th>
                <th scope="col" className="num">Group</th>
                <th scope="col"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <Fragment key={b.booking.id}>
                  <tr>
                    <td>{fmtTime(new Date(b.start))} – {fmtTime(new Date(b.end))}</td>
                    <td>{b.booking.name}<br /><small className="muted">{b.booking.email}</small></td>
                    <td><span className={`role-badge role-badge--${b.booking.role}`}>{b.booking.role === 'staff' ? 'Staff' : 'Student'}</span></td>
                    <td className="num">{b.booking.partySize}</td>
                    <td>
                      <button type="button" className="link-btn" aria-expanded={open === b.booking.id}
                        onClick={() => setOpen(open === b.booking.id ? null : b.booking.id)}>
                        {open === b.booking.id ? 'Hide details' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {open === b.booking.id && (
                    <tr className="detail-row">
                      <td colSpan={5}>
                        <dl className="details">
                          <div><dt>Name</dt><dd>{b.booking.name}</dd></div>
                          {b.booking.role === 'student' && <div><dt>Student ID</dt><dd>{b.booking.studentId || '–'}</dd></div>}
                          <div><dt>Group size</dt><dd>{b.booking.partySize}</dd></div>
                          <div><dt>Purpose</dt><dd>{b.booking.purpose || '–'}</dd></div>
                          <div><dt>Booked</dt><dd>{fmtStamp(b.booking.bookedAt)}</dd></div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// SRRS-12: block off times with a reason; students can't book them. Existing bookings in the way are listed first.
const HALF_HOURS = Array.from({ length: 29 }, (_, i) => {
  const mins = 8 * 60 + i * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}` };
});

function BlockPanel({ room, date, busy, onChange }) {
  const [from, setFrom] = useState('08:00');
  const [to, setTo] = useState('22:00');
  const [reason, setReason] = useState('');
  const [busyFlag, setBusyFlag] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [done, setDone] = useState('');
  const blocks = busy.filter((b) => b.kind === 'blocked');
  const at = (hhmm) => { const [y, mo, d] = date.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number); return new Date(y, mo - 1, d, h, mi).toISOString(); };

  async function save(cancelAffected = false) {
    setError(''); setDone(''); setBusyFlag(true);
    try {
      const res = await api.manageBlock({ action: 'create', roomId: room.id, start: at(from), end: at(to), reason: reason.trim(), cancelAffected });
      setConflict(null); setReason('');
      setDone(`Closed ${fmtTime(new Date(at(from)))} – ${fmtTime(new Date(at(to)))}.${res.cancelled ? ` ${res.cancelled} booking${res.cancelled === 1 ? ' was' : 's were'} cancelled.` : ''}`);
      onChange();
    } catch (e) {
      if (e.code === 'BLOCK_CONFLICT') setConflict(e.details || []);
      else setError(e.message);
    } finally {
      setBusyFlag(false);
    }
  }

  async function remove(id) {
    setError(''); setDone('');
    try { await api.manageBlock({ action: 'delete', id }); setDone('Closure removed. Those times are open again.'); onChange(); } catch (e) { setError(e.message); }
  }

  return (
    <section aria-labelledby="block-heading" className="panel staff-panel">
      <h3 id="block-heading">Block off time</h3>
      {blocks.length > 0 && (
        <ul className="block-list">
          {blocks.map((b) => (
            <li key={b.blockId || b.start}>
              <span><strong>{fmtTime(new Date(b.start))} – {fmtTime(new Date(b.end))}</strong> {b.reason}{b.blockedBy ? ` (by ${b.blockedBy})` : ''}</span>
              {b.blockId && <button type="button" className="btn btn--quiet" onClick={() => remove(b.blockId)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      <div className="booking-fields block-fields">
        <label className="field"><span>From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>{HALF_HOURS.slice(0, -1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
        <label className="field"><span>To</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>{HALF_HOURS.slice(1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
        <label className="field field--wide"><span>Reason</span>
          <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. HVAC repair" />
        </label>
      </div>
      {conflict && (
        <div className="confirm-inline" role="alertdialog" aria-label="Bookings in the way">
          <p>{conflict.length} booking{conflict.length === 1 ? ' is' : 's are'} already in that period:</p>
          <ul>{conflict.map((c) => <li key={c.id}>{fmtTime(new Date(c.start))} – {fmtTime(new Date(c.end))}, {c.name} ({c.role})</li>)}</ul>
          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={busyFlag} onClick={() => save(true)}>Close anyway and cancel {conflict.length === 1 ? 'it' : 'them'}</button>
            <button type="button" className="btn btn--quiet" onClick={() => setConflict(null)}>Go back</button>
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {done && <p className="confirm-box" role="status">{done}</p>}
      {!conflict && <button type="button" className="btn btn--primary" disabled={busyFlag || !reason.trim()} onClick={() => save(false)}>{busyFlag ? 'Saving…' : 'Block this time'}</button>}
    </section>
  );
}

// Story 5: see a room's details and which times are taken or blocked. Never shows who booked.
export default function RoomDetail({ backPath = '/student/rooms', canBook = false, staffView = false }) {
  const { id } = useParams();
  const [date, setDate] = useState(todayStr());
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    api.room(id, dayRange(date), { includeClosed: staffView }).then((r) => active && setRoom(r)).catch((e) => active && setError(e.message));
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
          <h1>{room.name}{!room.isActive && <span className="badge badge--closed"> Closed</span>}</h1>
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
        <DayStrip slots={slots} showStaff={staffView} />
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
        {canBook && room.isActive && <BookingPanel key={date} room={room} slots={slots} onBooked={refresh} />}
        {staffView && <StaffBookings busy={room.busy} />}
        {staffView && <BlockPanel key={date} room={room} date={date} busy={room.busy} onChange={refresh} />}
      </section>
    </>
  );
}
