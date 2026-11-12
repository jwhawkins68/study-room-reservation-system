import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// SRRS-13: system admins make staff members room coordinators for one or more buildings.
function StaffRow({ person, buildings, onSaved }) {
  const [role, setRole] = useState(person.staffRole);
  const [picked, setPicked] = useState(person.buildings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = role !== person.staffRole || picked.slice().sort().join() !== person.buildings.slice().sort().join();
  const toggle = (b) => setPicked(picked.includes(b) ? picked.filter((x) => x !== b) : [...picked, b]);

  async function save() {
    setBusy(true); setError('');
    try { onSaved(await api.updateStaff({ userId: person.id, staffRole: role, buildings: picked }), person.name); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <tr>
      <th scope="row">{person.name}{person.isMe && <small className="muted"> (you)</small>}<br /><small className="muted">{person.email}</small></th>
      <td>
        <select value={role} disabled={person.isMe} onChange={(e) => setRole(e.target.value)} aria-label={`Role for ${person.name}`}>
          <option value="system_admin">System admin (all buildings)</option>
          <option value="coordinator">Room coordinator</option>
        </select>
      </td>
      <td>
        {role === 'coordinator' ? (
          <div className="chips">
            {buildings.map((b) => (
              <button key={b} type="button" aria-pressed={picked.includes(b)} className={picked.includes(b) ? 'chip chip--on' : 'chip'} onClick={() => toggle(b)}>{b}</button>
            ))}
          </div>
        ) : <span className="muted">Every building</span>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </td>
      <td><button type="button" className="btn btn--primary btn--sm" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></td>
    </tr>
  );
}

export default function ManageStaff() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { api.staffList().then(setData).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <h1>Room coordinators</h1>
      <p className="muted">
        A room coordinator manages rooms, closures, and bookings only in the buildings picked here. A building can have more than one.
        Staff accounts are Base44 users with the admin role; invite new staff from the Base44 dashboard.
      </p>
      {message && <p className="confirm-box" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="page-status">Loading…</p>}
      {data && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Staff member</th><th scope="col">Role</th><th scope="col">Buildings</th><th scope="col"><span className="sr-only">Save</span></th></tr></thead>
              <tbody>
                {data.staff.map((p) => (
                  <StaffRow key={`${p.id}-${p.staffRole}-${p.buildings.join()}`} person={p} buildings={data.buildings}
                    onSaved={(d, name) => { setData(d); setMessage(`Saved ${name}.`); }} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
