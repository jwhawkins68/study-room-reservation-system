import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { fmtTime } from '../lib/dates';
import AddToCalendar from '../components/AddToCalendar';

const when = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

const STUDENT_EXAMPLES = [
  'A room for 6 with a whiteboard tomorrow at 2 for 2 hours',
  'Somewhere quiet for 2 people in the Library on Friday at 10',
  'What do I have booked?',
];
const STAFF_EXAMPLES = [
  'A room for 10 with a TV next Monday at 3',
  'Which rooms are busiest, and at what times?',
  'What do I have booked?',
];

// SRRS-18: AI booking assistant. It suggests rooms the server has checked; "Book it" uses the normal booking rules.
function OptionCard({ o, partySize, purpose, onBooked }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  async function book() {
    setState('busy'); setError('');
    try {
      const r = await api.createReservation({ roomId: o.roomId, start: o.start, end: o.end, partySize, purpose: purpose || 'Booked with the assistant' });
      setBooking({ ...r, roomName: r.roomName || o.roomName, building: r.building || o.building });
      setState('done');
      onBooked?.(o);
    } catch (e) {
      setError(e.message); setState('idle');
    }
  }
  return (
    <li className="ai-option">
      <div>
        <p className="ai-option-room">{o.roomName} <span className="muted">· {o.building}</span></p>
        <p className="muted">{when(o.start)}, {fmtTime(new Date(o.start))} – {fmtTime(new Date(o.end))} · seats {o.capacity}{o.amenities?.length ? ` · ${o.amenities.join(', ')}` : ''}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      {state === 'done' ? (
        <div className="ai-booked"><span className="badge badge--ok">Booked</span><AddToCalendar booking={booking} compact /></div>
      ) : (
        <button type="button" className="btn btn--primary btn--sm" disabled={state === 'busy'} onClick={book}>
          {state === 'busy' ? 'Booking…' : `Book it${partySize > 1 ? ` for ${partySize}` : ''}`}
        </button>
      )}
    </li>
  );
}

function Message({ m, bookingsPath }) {
  if (m.role === 'user') return <li className="ai-msg ai-msg--user"><p>{m.text}</p></li>;
  return (
    <li className="ai-msg ai-msg--bot">
      <p>{m.text}</p>
      {m.options?.length > 0 && (
        <ul className="ai-options">
          {m.options.map((o) => <OptionCard key={o.roomId + o.start} o={o} partySize={m.partySize || 1} purpose={m.purpose} />)}
        </ul>
      )}
      {m.bookings?.length > 0 && (
        <ul className="ai-options">
          {m.bookings.map((b) => (
            <li key={b.id} className="ai-option">
              <div>
                <p className="ai-option-room">{b.roomName} <span className="muted">· {b.building}</span></p>
                <p className="muted">{when(b.start)}, {fmtTime(new Date(b.start))} – {fmtTime(new Date(b.end))} · group of {b.partySize}</p>
              </div>
              <AddToCalendar booking={b} compact />
            </li>
          ))}
          <li className="ai-more"><Link to={bookingsPath}>Change or cancel in My bookings</Link></li>
        </ul>
      )}
      {m.insights && (
        <div className="ai-insights">
          <p><strong>{m.insights.bookings}</strong> confirmed bookings</p>
          <div className="ai-insights-grid">
            <div><h4>Busiest rooms</h4><ol>{m.insights.topRooms.map(([k, n]) => <li key={k}>{k} <span className="muted">({n})</span></li>)}</ol></div>
            <div><h4>Busiest start times</h4><ol>{m.insights.topHours.map(([k, n]) => <li key={k}>{k} <span className="muted">({n})</span></li>)}</ol></div>
            <div><h4>Rejected attempts</h4>{m.insights.rejected.length ? <ul>{m.insights.rejected.map(([k, n]) => <li key={k}>{k.replace(/_/g, ' ').toLowerCase()} <span className="muted">({n})</span></li>)}</ul> : <p className="muted">None</p>}</div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Assistant() {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const first = user?.fullName?.split(' ')[0];
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Hi${first ? ` ${first}` : ''}! Tell me what kind of room you need and when, and I’ll show rooms that are actually open.${isStaff ? ' I can also show booking insights.' : ''}` },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages, busy]);

  async function send(text) {
    const t = (text ?? draft).trim();
    if (!t || busy) return;
    const next = [...messages, { role: 'user', text: t }];
    setMessages(next); setDraft(''); setBusy(true);
    try {
      const res = await api.askAssistant(next.slice(1).map(({ role, text: x }) => ({ role, text: x })));
      setMessages([...next, { role: 'assistant', text: res.reply, options: res.options, partySize: res.partySize, purpose: res.purpose, bookings: res.bookings, insights: res.insights }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', text: e.message || 'Sorry, something went wrong. Try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  const examples = isStaff ? STAFF_EXAMPLES : STUDENT_EXAMPLES;
  return (
    <>
      <h1>Booking assistant</h1>
      <p className="muted">Ask in plain words. Every suggestion is checked against the live schedule, and nothing is booked until you press Book it.</p>
      <section className="panel ai-panel" aria-label="Conversation with the booking assistant">
        <ul className="ai-thread" aria-live="polite">
          {messages.map((m, i) => <Message key={i} m={m} bookingsPath={isStaff ? '/staff/bookings' : '/student'} />)}
          {busy && <li className="ai-msg ai-msg--bot ai-typing"><p>Checking the schedule…</p></li>}
          <li ref={endRef} aria-hidden="true" />
        </ul>
        {messages.length < 3 && (
          <div className="chips ai-examples" aria-label="Examples">
            {examples.map((x) => <button key={x} type="button" className="chip" onClick={() => send(x)}>{x}</button>)}
          </div>
        )}
        <form className="ai-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label className="sr-only" htmlFor="ai-input">Message the assistant</label>
          <input id="ai-input" value={draft} maxLength={600} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. a room for 4 with a TV tomorrow at 3" autoComplete="off" />
          <button className="btn btn--primary" disabled={busy || !draft.trim()}>Send</button>
        </form>
      </section>
    </>
  );
}
