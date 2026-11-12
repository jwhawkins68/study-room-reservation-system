import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ymd, addDays, midnight, fmtDay, fmtTime, fmtStamp, localInput, REASONS } from '../lib/dates';

const STATE = {
  in_use: { label: 'In use now', cls: 'state--use' },
  booked_up: { label: 'Booked up today', cls: 'state--full' },
  blocked: { label: 'Closed for a period', cls: 'state--blocked' },
  closed: { label: 'Room closed', cls: 'state--closed' },
  open: { label: 'Open', cls: 'state--open' },
};

// SRRS-11: admin center. Every booking with who, where, and when; filters; room status; rejected attempts; cancel any booking.
export default function AdminCenter() {
  const { user } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(ymd(today));
  const [to, setTo] = useState(ymd(addDays(today, 7)));
  const [roomId, setRoomId] = useState('');
  const [q, setQ] = useState('');
  const [at, setAt] = useState(localInput(today));
  const [rooms, setRooms] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    api.allRooms().then((r) => setRooms(r.filter((x) => user.staffRole !== 'coordinator' || user.buildings.includes(x.building)))).catch(() => {});
  }, [user]);

  const load = useCallback(() => {
    setError('');
    const atDate = new Date(at);
    const dayStart = new Date(atDate.getFullYear(), atDate.getMonth(), atDate.getDate());
    const dayEnd = new Date(atDate.getFullYear(), atDate.getMonth(), atDate.getDate(), 22);
    api.adminOverview({
      from: midnight(from).toISOString(), to: addDays(midnight(to), 1).toISOString(), roomId: roomId || undefined, q,
      at: atDate.toISOString(), dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString(),
    }).then(setData).catch((e) => setError(e.message));
  }, [from, to, roomId, q, at]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function cancel(b) {
    setWorking(true);
    try {
      await api.cancelReservation(b.id, reason.trim());
      setMessage(`Cancelled ${b.name}'s booking in ${b.roomName} on ${fmtDay(b.start)} at ${fmtTime(b.start)}.`);
      setConfirming(null); setReason('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  const status = data?.status || [];
  const counts = Object.fromEntries(Object.keys(STATE).map((k) => [k, status.filter((s) => s.state === k).length]));

  return (
    <>
      <h1>Admin center</h1>
      <p className="muted">
        {user.staffRole === 'coordinator' ? `Your buildings: ${user.buildings.join(', ')}.` : 'All buildings.'} Bookings, room status, and rejected attempts.
      </p>

      <dl className="stats stats--4">
        <div className="stat"><dt>Confirmed bookings</dt><dd>{data ? data.counts.confirmed : '–'}</dd></div>
        <div className="stat"><dt>Cancelled</dt><dd>{data ? data.counts.cancelled : '–'}</dd></div>
        <div className="stat"><dt>Rejected attempts</dt><dd>{data ? data.counts.rejected : '–'}</dd></div>
        <div className="stat"><dt>Rooms in use</dt><dd>{data ? counts.in_use : '–'}</dd></div>
      </dl>

      <section className="panel" aria-labelledby="status-heading">
        <div className="panel-head">
          <h2 id="status-heading">Room status</h2>
          <label className="field field--inline"><span>Status at</span>
            <input type="datetime-local" value={at} onChange={(e) => e.target.value && setAt(e.target.value)} />
          </label>
        </div>
        <p className="legend status-legend">
          {Object.entries(STATE).map(([k, v]) => (
            <span key={k} className={`state ${v.cls}`}>{v.label}: {counts[k] ?? 0}</span>
          ))}
        </p>
        {!data && !error && <p className="page-status">Loading…</p>}
        <ul className="status-grid">
          {status.map((s) => (
            <li key={s.id} className={`status-card ${STATE[s.state].cls}`}>
              <Link to={`/staff/rooms/${s.id}`} className="status-name">{s.name}</Link>
              <span className="muted">{s.building} · {s.capacity} seats</span>
              <span className={`state ${STATE[s.state].cls}`}>{STATE[s.state].label}{s.until ? ` until ${fmtTime(s.until)}` : ''}</span>
              <span className="muted">{s.bookingsToday} booking{s.bookingsToday === 1 ? '' : 's'} that day</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="bookings-heading">
        <h2 id="bookings-heading">All bookings</h2>
        <div className="filter-row">
          <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          <label className="field"><span>Room</span>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">All rooms</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.building}: {r.name}</option>)}
            </select>
          </label>
          <label className="field field--grow"><span>Student or staff</span>
            <input type="search" value={q} placeholder="Name, email, or student ID" onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {message && <p className="confirm-box" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {data && data.bookings.length === 0 && <p className="muted">No bookings match these filters.</p>}
        {data && data.bookings.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th><th scope="col">Room</th><th scope="col">Booked by</th>
                  <th scope="col" className="num">Group</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((b) => (
                  <tr key={b.id} className={b.status === 'cancelled' ? 'row--muted' : ''}>
                    <td><strong>{fmtDay(b.start)}</strong><br />{fmtTime(b.start)} – {fmtTime(b.end)}</td>
                    <td>{b.roomName}<br /><small className="muted">{b.building}</small></td>
                    <td>
                      {b.name} <span className={`role-badge role-badge--${b.role}`}>{b.role === 'staff' ? 'Staff' : 'Student'}</span>
                      <br /><small className="muted">{b.email}{b.studentId ? ` · ${b.studentId}` : ''}</small>
                    </td>
                    <td className="num">{b.partySize}</td>
                    <td>
                      {b.status === 'cancelled'
                        ? <><span className="badge">Cancelled</span>{b.cancelReason && <><br /><small className="muted">{b.cancelReason}</small></>}</>
                        : <span className="badge badge--ok">Confirmed</span>}
                    </td>
                    <td>
                      {b.status === 'confirmed' && confirming !== b.id && (
                        <button type="button" className="btn btn--quiet" onClick={() => { setConfirming(b.id); setReason(''); setMessage(''); }}>Cancel</button>
                      )}
                      {confirming === b.id && (
                        <div className="confirm-inline" role="alertdialog" aria-label="Cancel booking">
                          <label className="field"><span>Reason (shown to the student)</span>
                            <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Room needed for an event" />
                          </label>
                          <div className="actions">
                            <button type="button" className="btn btn--primary" disabled={working} onClick={() => cancel(b)}>{working ? 'Cancelling…' : 'Cancel booking'}</button>
                            <button type="button" className="btn btn--quiet" onClick={() => setConfirming(null)}>Keep it</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="rejected-heading">
        <h2 id="rejected-heading">Rejected booking attempts</h2>
        <p className="muted">Bookings the system refused for these dates, newest first.</p>
        {data && data.rejected.length === 0 && <p className="muted">None for these filters.</p>}
        {data && data.rejected.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Tried at</th><th scope="col">Who</th><th scope="col">Room</th><th scope="col">Time requested</th><th scope="col">Why it was refused</th></tr></thead>
              <tbody>
                {data.rejected.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtStamp(a.at)}</td>
                    <td>{a.name}</td>
                    <td>{a.roomName}<br /><small className="muted">{a.building}</small></td>
                    <td>{a.start ? <>{fmtDay(a.start)}, {fmtTime(a.start)}{a.end ? ` – ${fmtTime(a.end)}` : ''}</> : '–'}</td>
                    <td><span className="badge badge--warn">{REASONS[a.reason] || a.reason}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
