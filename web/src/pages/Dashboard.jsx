import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { fmtTime } from '../components/DayStrip';

const fmtDay = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

// Student landing page after login (idea from Steph's prototype). Stories 7 and 8 preview.
export default function Dashboard() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState(null);
  const [roomCount, setRoomCount] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(() => {
    api.myReservations('upcoming').then(setUpcoming).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    api.rooms().then((r) => setRoomCount(r.length)).catch(() => setRoomCount(null));
  }, [load]);

  async function cancel(r) {
    if (!window.confirm(`Cancel ${r.roomName} on ${fmtDay(r.start)} at ${fmtTime(new Date(r.start))}?`)) return;
    setCancelling(r.id);
    try {
      await api.cancelReservation(r.id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(null);
    }
  }

  const first = user?.fullName?.split(' ')[0] || 'there';

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
          <dt>Student ID</dt>
          <dd className="stat-text">{user?.studentId || '–'}</dd>
        </div>
      </dl>

      <section aria-labelledby="upcoming-heading" className="panel">
        <div className="panel-head">
          <h2 id="upcoming-heading">Upcoming bookings</h2>
          <Link to="/student/rooms" className="btn btn--primary">Find a room</Link>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!upcoming && !error && <p className="page-status">Loading…</p>}
        {upcoming && upcoming.length === 0 && (
          <div className="empty">
            <p>You don’t have any upcoming bookings.</p>
            <Link to="/student/rooms">Browse rooms</Link>
          </div>
        )}
        {upcoming && upcoming.length > 0 && (
          <ul className="booking-list">
            {upcoming.map((r) => (
              <li key={r.id} className="booking">
                <div className="booking-when">
                  <span className="booking-day">{fmtDay(r.start)}</span>
                  <span>{fmtTime(new Date(r.start))} – {fmtTime(new Date(r.end))}</span>
                </div>
                <div className="booking-main">
                  <Link to={`/student/rooms/${r.roomId}`} className="booking-room">{r.roomName}</Link>
                  <p className="muted">{r.building ? `${r.building}. ` : ''}Group of {r.partySize}{r.purpose ? `. ${r.purpose}` : ''}</p>
                </div>
                <span className="badge badge--ok">Confirmed</span>
                <button type="button" className="btn btn--quiet" disabled={cancelling === r.id} onClick={() => cancel(r)}>
                  {cancelling === r.id ? 'Cancelling…' : 'Cancel'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
