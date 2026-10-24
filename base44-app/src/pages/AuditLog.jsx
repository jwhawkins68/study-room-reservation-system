import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ymd, addDays, midnight, fmtStamp, fmtRange } from '../lib/dates';

const ACTIONS = { created: 'Booked', changed: 'Time changed', cancelled: 'Cancelled' };

// SRRS-14: who booked, changed, or cancelled each reservation, and when.
export default function AuditLog() {
  const { user } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(ymd(addDays(today, -7)));
  const [to, setTo] = useState(ymd(today));
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      api.auditLog({ from: midnight(from).toISOString(), to: addDays(midnight(to), 1).toISOString(), action: action || undefined, q })
        .then((r) => active && setEvents(r.events)).catch((e) => active && setError(e.message));
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [from, to, action, q]);

  return (
    <>
      <h1>Booking audit log</h1>
      <p className="muted">Every booking, time change, and cancellation{user.staffRole === 'coordinator' ? ` in ${user.buildings.join(', ')}` : ''}, newest first.</p>
      <section className="panel">
        <div className="filter-row">
          <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          <label className="field"><span>What happened</span>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Everything</option>
              {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field field--grow"><span>Search</span>
            <input type="search" value={q} placeholder="Person, room, or building" onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!events && !error && <p className="page-status">Loading…</p>}
        {events && events.length === 0 && <p className="muted">Nothing happened in this period.</p>}
        {events && events.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">When</th><th scope="col">What</th><th scope="col">Booking</th><th scope="col">Done by</th><th scope="col">Details</th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtStamp(e.at)}</td>
                    <td><span className={`badge audit--${e.action}`}>{ACTIONS[e.action]}</span></td>
                    <td>{e.roomName} <small className="muted">({e.building})</small><br /><small className="muted">for {e.booker}</small></td>
                    <td>{e.actor} <span className={`role-badge role-badge--${e.actorRole}`}>{e.actorRole === 'staff' ? 'Staff' : 'Student'}</span></td>
                    <td>
                      {e.action === 'created' && e.newStart && fmtRange(e.newStart, e.newEnd)}
                      {e.action === 'changed' && <>{fmtRange(e.oldStart, e.oldEnd)}<br />→ {fmtRange(e.newStart, e.newEnd)}</>}
                      {e.action === 'cancelled' && e.oldStart && fmtRange(e.oldStart, e.oldEnd)}
                      {e.note && <><br /><small className="muted">{e.note}</small></>}
                    </td>
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
