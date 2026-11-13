import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtDay, fmtTime } from '../lib/dates';
import AddToCalendar from './AddToCalendar';

// SRRS-19/20: notices from staff and AI rebook offers, at the top of the student dashboard.
// An offer books only when the student presses "Move me", through the normal booking rules.
export default function Updates({ onChange }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const load = useCallback(() => api.myUpdates().then(setData).catch(() => setData({ notifications: [], offers: [] })), []);
  useEffect(() => { load(); }, [load]);

  const unread = (data?.notifications || []).filter((n) => !n.read && n.kind !== 'rebooked');
  const offers = data?.offers || [];
  if (!data || (!unread.length && !offers.length && !done)) return null;

  async function act(kind, o) {
    setBusy(o.id); setError('');
    try {
      if (kind === 'accept') {
        const res = await api.acceptOffer(o.id);
        setDone({ ...res.booking, roomName: res.booking.roomName || o.roomName, building: res.booking.building || o.building });
        setData({ notifications: res.notifications, offers: res.offers });
        onChange?.();
      } else {
        setData(await api.dismissOffer(o.id));
      }
    } catch (e) {
      setError(e.message); load();
    } finally {
      setBusy('');
    }
  }
  async function markAll() {
    setData(await api.markRead(unread.map((n) => n.id)));
  }

  return (
    <section className="panel updates" aria-labelledby="updates-heading">
      <div className="panel-head">
        <h2 id="updates-heading">Updates <span className="count-badge" aria-label={`${unread.length + offers.length} new`}>{unread.length + offers.length}</span></h2>
        {unread.length > 0 && <button type="button" className="btn btn--quiet" onClick={markAll}>Mark notices read</button>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {done && (
        <div className="update-card update-card--ok" role="status">
          <p className="update-title">You’re booked in {done.roomName}</p>
          <p>{fmtDay(done.start)}, {fmtTime(new Date(done.start))} – {fmtTime(new Date(done.end))}{done.building ? ` · ${done.building}` : ''}</p>
          <AddToCalendar booking={done} compact />
        </div>
      )}
      <ul className="update-list">
        {offers.map((o) => (
          <li key={o.id} className="update-card update-card--offer">
            <p className="update-kicker">Suggested by the assistant</p>
            <p className="update-title">Move to {o.roomName} <span className="muted">· {o.building}</span></p>
            <p>{fmtDay(o.start)}, {fmtTime(new Date(o.start))} – {fmtTime(new Date(o.end))} · group of {o.partySize}</p>
            <p className="muted">Why this room: {o.reason}</p>
            <div className="actions">
              <button type="button" className="btn btn--primary" disabled={busy === o.id} onClick={() => act('accept', o)}>{busy === o.id ? 'Booking…' : 'Move me'}</button>
              <button type="button" className="btn btn--quiet" disabled={busy === o.id} onClick={() => act('dismiss', o)}>No thanks</button>
            </div>
          </li>
        ))}
        {unread.map((n) => (
          <li key={n.id} className="update-card">
            <p className="update-title">{n.title}</p>
            <p>{n.body}</p>
            {n.emailed && <p className="muted">Also sent to your email.</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
