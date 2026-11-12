import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const FEATURES = ['Whiteboard', 'TV / HDMI', 'Power outlets', 'Webcam', 'Accessible'];
const EMPTY = { name: '', building: '', floor: '', capacity: 4, description: '', amenities: [] };

function RoomForm({ initial, buildings, freeBuilding, onSave, onCancel, saveLabel }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (a) => setF({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] });

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await onSave({ ...f, capacity: Number(f.capacity) }); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form className="room-form" onSubmit={submit}>
      <div className="filter-row">
        <label className="field field--grow"><span>Room name</span><input value={f.name} onChange={set('name')} placeholder="Study Room 105" /></label>
        <label className="field"><span>Building</span>
          {freeBuilding ? (
            <>
              <input list="building-list" value={f.building} onChange={set('building')} placeholder="Library" />
              <datalist id="building-list">{buildings.map((b) => <option key={b} value={b} />)}</datalist>
            </>
          ) : (
            <select value={f.building} onChange={set('building')}>
              <option value="">Pick one</option>
              {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </label>
        <label className="field field--small"><span>Floor</span><input value={f.floor} onChange={set('floor')} /></label>
        <label className="field field--small"><span>Seats</span><input type="number" min="1" max="200" value={f.capacity} onChange={set('capacity')} /></label>
      </div>
      <label className="field"><span>Description</span><input value={f.description} onChange={set('description')} /></label>
      <fieldset className="chips" aria-label="Features">
        {FEATURES.map((a) => (
          <button key={a} type="button" aria-pressed={f.amenities.includes(a)} className={f.amenities.includes(a) ? 'chip chip--on' : 'chip'} onClick={() => toggle(a)}>{a}</button>
        ))}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// SRRS-12: add, edit, close, and reopen rooms. SRRS-13: coordinators see and change only their buildings.
export default function ManageRooms() {
  const { user } = useAuth();
  const coordinator = user.staffRole === 'coordinator';
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [closing, setClosing] = useState(null);

  const load = useCallback(() => {
    api.allRooms().then((r) => setRooms(coordinator ? r.filter((x) => user.buildings.includes(x.building)) : r)).catch((e) => setError(e.message));
  }, [coordinator, user.buildings]);
  useEffect(load, [load]);

  const buildings = coordinator ? user.buildings : [...new Set((rooms || []).map((r) => r.building))].sort();

  async function act(body, msg) {
    setError(''); setMessage('');
    const res = await api.manageRoom(body);
    setMessage(msg(res.room)); setAdding(false); setEditing(null); setClosing(null);
    load();
  }

  return (
    <>
      <h1>Rooms</h1>
      <p className="muted">{coordinator ? `You manage ${user.buildings.join(', ')}.` : 'All buildings.'} Closed rooms are hidden from students and can't be booked.</p>
      {message && <p className="confirm-box" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="panel" aria-labelledby="add-heading">
        <div className="panel-head">
          <h2 id="add-heading">{adding ? 'Add a room' : `${rooms ? rooms.length : '–'} rooms`}</h2>
          {!adding && <button type="button" className="btn btn--primary" onClick={() => { setAdding(true); setMessage(''); }}>Add a room</button>}
        </div>
        {adding && (
          <RoomForm initial={{ ...EMPTY, building: buildings.length === 1 ? buildings[0] : '' }} buildings={buildings} freeBuilding={!coordinator}
            saveLabel="Add room" onCancel={() => setAdding(false)}
            onSave={(f) => act({ action: 'create', ...f }, (r) => `Added ${r.name} in ${r.building}.`)} />
        )}

        {!rooms && !error && <p className="page-status">Loading rooms…</p>}
        {rooms && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Room</th><th scope="col">Building</th><th scope="col" className="num">Seats</th>
                  <th scope="col">Features</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  editing === r.id ? (
                    <tr key={r.id}><td colSpan={6}>
                      <RoomForm initial={{ name: r.name, building: r.building, floor: r.floor || '', capacity: r.capacity, description: r.description || '', amenities: r.amenities }}
                        buildings={buildings} freeBuilding={!coordinator} saveLabel="Save changes" onCancel={() => setEditing(null)}
                        onSave={(f) => act({ action: 'update', id: r.id, fields: f }, (x) => `Saved ${x.name}.`)} />
                    </td></tr>
                  ) : (
                    <tr key={r.id} className={r.isActive ? '' : 'row--muted'}>
                      <th scope="row">{r.name}</th>
                      <td>{r.building}, floor {r.floor}</td>
                      <td className="num">{r.capacity}</td>
                      <td>{r.amenities.join(', ')}</td>
                      <td>{r.isActive ? <span className="badge badge--ok">Open</span> : <span className="badge badge--closed">Closed</span>}</td>
                      <td className="row-actions">
                        <Link to={`/staff/rooms/${r.id}`}>Schedule and closures</Link>
                        <button type="button" className="link-btn" onClick={() => { setEditing(r.id); setMessage(''); }}>Edit</button>
                        {r.isActive && closing !== r.id && <button type="button" className="link-btn" onClick={() => setClosing(r.id)}>Close room</button>}
                        {closing === r.id && (
                          <span className="inline-confirm">Close {r.name}?{' '}
                            <button type="button" className="btn btn--primary btn--sm" onClick={() => act({ action: 'close', id: r.id }, (x) => `Closed ${x.name}. Students can't see or book it.`).catch((e) => setError(e.message))}>Close it</button>{' '}
                            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setClosing(null)}>Keep open</button>
                          </span>
                        )}
                        {!r.isActive && <button type="button" className="link-btn" onClick={() => act({ action: 'reopen', id: r.id }, (x) => `Reopened ${x.name}.`).catch((e) => setError(e.message))}>Reopen</button>}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
