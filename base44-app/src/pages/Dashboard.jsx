import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { buildSlots, fmtTime } from '../components/DayStrip';

const fmtDay = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const MAX_SLOTS = 6; // 3 hours of half-hour slots

const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function dayRange(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { from: new Date(y, m - 1, d).toISOString(), to: new Date(y, m - 1, d + 1).toISOString() };
}
const durationLabel = (n) => {
  const h = Math.floor((n * 30) / 60);
  const m = (n * 30) % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
};

// Story 10: move a booking to another open time in the same room. The old time is shown as free.
function ChangeTime({ booking, onDone, onCancel }) {
  const origLen = Math.max(1, Math.round((Date.parse(booking.end) - Date.parse(booking.start)) / 1800000));
  const [date, setDate] = useState(dateStr(new Date(booking.start)));
  const [slots, setSlots] = useState(null);
  const [startIdx, setStartIdx] = useState('');
  const [length, setLength] = useState(origLen);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setSlots(null);
    setStartIdx('');
    api.room(booking.roomId, dayRange(date), { excludeId: booking.id })
      .then((room) => active && setSlots(buildSlots(date, room.busy)))
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [booking.roomId, booking.id, date]);

  const maxLen = useMemo(() => {
    if (!slots || startIdx === '') return 0;
    let n = 0;
    while (startIdx + n < slots.length && slots[startIdx + n].state === 'open' && n < MAX_SLOTS) n += 1;
    return n;
  }, [slots, startIdx]);
  const len = Math.min(length, maxLen || 1);

  async function save() {
    setError('');
    setBusy(true);
    try {
      const start = slots[startIdx].start;
      const end = slots[startIdx + len - 1].end;
      await api.updateReservation(booking.id, { start: start.toISOString(), end: end.toISOString() });
      onDone(`Moved to ${fmtDay(start.toISOString())}, ${fmtTime(start)} – ${fmtTime(end)}.`);
    } catch (e) {
      setError(`${e.message}${e.code === 'ROOM_TAKEN' ? '' : ' Your booking wasn’t changed.'}`);
    } finally {
      setBusy(false);
    }
  }

  const open = slots ? slots.map((s, i) => ({ ...s, i })).filter((s) => s.state === 'open') : [];

  return (
    <div className="change-panel">
      <div className="booking-fields">
        <label className="field">
          <span>Day</span>
          <input type="date" value={date} min={dateStr(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>New start time</span>
          <select value={startIdx} onChange={(e) => setStartIdx(e.target.value === '' ? '' : Number(e.target.value))} disabled={!slots || open.length === 0}>
            <option value="">{!slots ? 'Loading…' : open.length ? 'Pick a time' : 'No open times this day'}</option>
            {open.map((s) => <option key={s.i} value={s.i}>{fmtTime(s.start)}</option>)}
          </select>
        </label>
        {startIdx !== '' && (
          <label className="field">
            <span>How long</span>
            <select value={len} onChange={(e) => setLength(Number(e.target.value))}>
              {Array.from({ length: maxLen }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{durationLabel(n)}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="btn btn--primary" disabled={startIdx === '' || busy} onClick={save}>{busy ? 'Saving…' : 'Save new time'}</button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>Keep current time</button>
      </div>
    </div>
  );
}

// Student landing page after login. Stories 7, 8, and 10.
export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('upcoming');
  const [upcoming, setUpcoming] = useState(null);
  const [past, setPast] = useState(null);
  const [roomCount, setRoomCount] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [changing, setChanging] = useState(null);

  const load = useCallback(() => {
    api.myReservations('upcoming').then(setUpcoming).catch((e) => setError(e.message));
    api.myReservations('past').then(setPast).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    api.rooms().then((r) => setRoomCount(r.length)).catch(() => setRoomCount(null));
  }, [load]);

  async function cancel(r) {
    setCancelling(r.id);
    setError('');
    try {
      await api.cancelReservation(r.id);
      setMessage(`Cancelled ${r.roomName} on ${fmtDay(r.start)} at ${fmtTime(new Date(r.start))}. The time is open for others again.`);
      setConfirming(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(null);
    }
  }

  const first = user?.fullName?.split(' ')[0] || 'there';
  const list = tab === 'upcoming' ? upcoming : past;
  // SRRS-15: staff use the same bookings page under /staff
  const isStaff = user?.role === 'staff';
  const roomsPath = isStaff ? '/staff/book' : '/student/rooms';

  return (
    <>
      <h1>Welcome, {first}</h1>
      <p className="muted">Here’s what you have coming up.</p>

      <dl className="stats">
        <div className="stat">
          <dt>Upcoming bookings</dt>
          <dd>{upcoming ? upcoming.length : '–'}</dd>
        </div>
        <div className="stat">
          <dt>Rooms you can book</dt>
          <dd>{roomCount ?? '–'}</dd>
        </div>
        <div className="stat">
          <dt>{isStaff ? 'Account' : 'Student ID'}</dt>
          <dd className="stat-text">{isStaff ? 'Staff' : user?.studentId || '–'}</dd>
        </div>
      </dl>

      <section aria-labelledby="bookings-heading" className="panel">
        <div className="panel-head">
          <h2 id="bookings-heading">My bookings</h2>
          <Link to={roomsPath} className="btn btn--primary">{isStaff ? 'Book a room' : 'Find a room'}</Link>
        </div>
        <div className="segmented" role="tablist" aria-label="Which bookings">
          {[['upcoming', 'Upcoming'], ['past', 'Past and cancelled']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'seg seg--on' : 'seg'} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        {message && <p className="confirm-box" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!list && !error && <p className="page-status">Loading…</p>}
        {list && list.length === 0 && (
          <div className="empty">
            <p>{tab === 'upcoming' ? 'You don’t have any upcoming bookings.' : 'No past bookings yet.'}</p>
            {tab === 'upcoming' && <Link to={roomsPath}>Browse rooms</Link>}
          </div>
        )}
        {list && list.length > 0 && (
          <ul className="booking-list">
            {list.map((r) => (
              <li key={r.id} className="booking">
                <div className="booking-when">
                  <span className="booking-day">{fmtDay(r.start)}</span>
                  <span>{fmtTime(new Date(r.start))} – {fmtTime(new Date(r.end))}</span>
                </div>
                <div className="booking-main">
                  <Link to={`${roomsPath}/${r.roomId}`} className="booking-room">{r.roomName}</Link>
                  <p className="muted">{r.building ? `${r.building}. ` : ''}Group of {r.partySize}{r.purpose ? `. ${r.purpose}` : ''}</p>
                  {r.status === 'cancelled' && r.cancelReason && <p className="muted">Cancelled: {r.cancelReason}</p>}
                  {changing === r.id && (
                    <ChangeTime
                      booking={r}
                      onCancel={() => setChanging(null)}
                      onDone={(msg) => { setChanging(null); setMessage(msg); load(); }}
                    />
                  )}
                  {confirming === r.id && (
                    <div className="confirm-inline" role="alertdialog" aria-label="Confirm cancellation">
                      <p>Cancel this booking? The time opens up for other students.</p>
                      <div className="actions">
                        <button type="button" className="btn btn--primary" disabled={cancelling === r.id} onClick={() => cancel(r)}>
                          {cancelling === r.id ? 'Cancelling…' : 'Yes, cancel it'}
                        </button>
                        <button type="button" className="btn btn--quiet" onClick={() => setConfirming(null)}>Keep it</button>
                      </div>
                    </div>
                  )}
                </div>
                {r.status === 'cancelled'
                  ? <span className="badge">Cancelled</span>
                  : tab === 'past' ? <span className="badge">Done</span> : <span className="badge badge--ok">Confirmed</span>}
                {tab === 'upcoming' && Date.parse(r.start) > Date.now() && changing !== r.id && confirming !== r.id && (
                  <div className="booking-actions">
                    <button type="button" className="btn btn--quiet" onClick={() => { setMessage(''); setConfirming(null); setChanging(r.id); }}>Change time</button>
                    <button type="button" className="btn btn--quiet" onClick={() => { setMessage(''); setChanging(null); setConfirming(r.id); }}>Cancel</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
