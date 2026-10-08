import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

// Story 3: staff land here after logging in. Admin center and room tools are Sprint 3.
export default function StaffHome() {
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.rooms().then(setRooms).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Rooms</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!rooms && !error && <p className="page-status">Loading rooms…</p>}
      {rooms && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Room</th>
                <th scope="col">Building</th>
                <th scope="col" className="num">Seats</th>
                <th scope="col">Features</th>
                <th scope="col"><span className="sr-only">Schedule</span></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name}</th>
                  <td>{r.building}, floor {r.floor}</td>
                  <td className="num">{r.capacity}</td>
                  <td>{r.amenities.join(', ')}</td>
                  <td><Link to={`/staff/rooms/${r.id}`}>Schedule</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
