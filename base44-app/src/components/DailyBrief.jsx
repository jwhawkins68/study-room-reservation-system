import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

// SRRS-22: the AI daily brief at the top of the admin center. Numbers are counted from live data;
// the AI only words them. Refreshed on demand to keep AI use (and credits) low.
export default function DailyBrief() {
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => {
    setBusy(true); setError('');
    api.analytics({ days: 7, brief: true }).then((d) => setB(d.brief)).catch((e) => setError(e.message)).finally(() => setBusy(false));
  };
  useEffect(load, []);
  return (
    <section className="panel brief" aria-labelledby="brief-heading" aria-busy={busy}>
      <div className="panel-head">
        <h2 id="brief-heading"><span aria-hidden="true">✦</span> Daily brief</h2>
        <div className="actions">
          <button type="button" className="btn btn--quiet" onClick={load} disabled={busy}>{busy ? 'Updating…' : 'Refresh'}</button>
          <Link to="/staff/analytics" className="btn btn--outline">Open analytics</Link>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!b && !error && <p className="page-status">Writing today’s brief…</p>}
      {b && (
        <>
          {b.text && <p className="brief-text">{b.text}</p>}
          <dl className="brief-facts">
            <div><dt>Bookings today</dt><dd>{b.bookingsToday}</dd></div>
            <div><dt>Rooms in use now</dt><dd>{b.roomsInUseNow}</dd></div>
            <div><dt>Closures today</dt><dd>{b.closuresToday}</dd></div>
            <div><dt>Refused yesterday</dt><dd>{b.rejectedYesterday}</dd></div>
          </dl>
          <p className="muted small">{b.source === 'ai' ? 'Written by the AI assistant from the numbers above' : 'Summary of the numbers above'} · {b.scope}</p>
        </>
      )}
    </section>
  );
}
