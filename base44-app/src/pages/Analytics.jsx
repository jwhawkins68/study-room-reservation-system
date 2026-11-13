import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';

const PURPLE = '#582c83';
const GOLD = '#b8860b';
const REASON = { ROOM_TAKEN: 'Already booked', OVER_CAPACITY: 'Group too big', TOO_LONG: 'Over 3 hours', IN_PAST: 'Time already passed', ROOM_BLOCKED: 'Room closed then', ROOM_INACTIVE: 'Room closed', VALIDATION: 'Missing details' };

// SRRS-22: usage analytics for staff. Every chart also has a plain table (for screen readers and printouts).
function Chart({ title, data, x, y, height = 260, future, caption }) {
  return (
    <figure className="chart">
      <figcaption><h3>{title}</h3>{caption && <p className="muted">{caption}</p>}</figcaption>
      <div style={{ width: '100%', height }} aria-hidden="true">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e4e1e8" />
            <XAxis dataKey={x} tick={{ fontSize: 13 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 13 }} width={36} />
            <Tooltip />
            <Bar dataKey={y} radius={[3, 3, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={future && d.future ? GOLD : PURPLE} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-table">
        <summary>Show as a table</summary>
        <table className="table"><thead><tr><th scope="col">{x}</th><th scope="col">{y}</th></tr></thead>
          <tbody>{data.map((d, i) => <tr key={i}><td>{d[x]}</td><td>{d[y]}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(14);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setD(null); setError('');
    api.analytics({ days, brief: false }).then(setD).catch((e) => setError(e.message));
  }, [days]);

  return (
    <>
      <h1>Analytics</h1>
      <p className="muted">How rooms are used{d ? ` · ${d.scope}` : ''}. Counts come straight from bookings, closures, and refused attempts.</p>
      <div className="segmented" role="group" aria-label="Period">
        {[7, 14, 30].map((n) => (
          <button key={n} type="button" aria-pressed={days === n} className={days === n ? 'seg seg--on' : 'seg'} onClick={() => setDays(n)}>Last {n} days</button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!d && !error && <p className="page-status">Counting…</p>}
      {d && (
        <>
          <dl className="stats stats--4">
            <div className="stat"><dt>Confirmed bookings</dt><dd>{d.totals.confirmed}</dd></div>
            <div className="stat"><dt>Hours booked</dt><dd>{d.totals.hours}</dd></div>
            <div className="stat"><dt>Different people</dt><dd>{d.totals.bookers}</dd></div>
            <div className="stat"><dt>Refused attempts</dt><dd>{d.totals.rejected}</dd></div>
          </dl>
          <section className="panel">
            <Chart title="Bookings per day" caption="Purple: past days. Gold: the coming week (already booked)." data={d.perDay} x="label" y="bookings" future />
          </section>
          <div className="chart-grid">
            <section className="panel"><Chart title="Busiest start times" data={d.byHour} x="label" y="bookings" /></section>
            <section className="panel"><Chart title="Bookings by building" data={d.byBuilding} x="building" y="bookings" /></section>
          </div>
          <section className="panel">
            <h3>Room usage</h3>
            <p className="muted">Hours booked out of open hours (8 AM – 10 PM). “Turned away” counts people refused because the room was already booked: high numbers mean demand is bigger than supply.</p>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">Room</th><th scope="col">Building</th><th scope="col" className="num">Seats</th><th scope="col" className="num">Bookings</th><th scope="col" className="num">Hours</th><th scope="col">Use</th><th scope="col" className="num">Turned away</th></tr></thead>
                <tbody>
                  {d.usage.map((u) => (
                    <tr key={u.id}>
                      <th scope="row">{u.name}</th><td>{u.building}</td><td className="num">{u.capacity}</td><td className="num">{u.bookings}</td><td className="num">{u.hours}</td>
                      <td><span className="meter" aria-label={`${u.utilization}%`}><span style={{ width: `${Math.min(100, u.utilization)}%` }} /></span> {u.utilization}%</td>
                      <td className="num">{u.turnedAway}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {d.rejected.length > 0 && (
            <section className="panel">
              <h3>Why bookings were refused</h3>
              <ul className="reason-list">{d.rejected.map((r) => <li key={r.reason}><strong>{r.count}</strong> {REASON[r.reason] || r.reason}</li>)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
