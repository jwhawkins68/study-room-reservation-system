import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const SIZES = [1, 2, 4, 6, 8, 10];

// Story 4: browse rooms by group size and features.
export default function Rooms({ basePath = '/student/rooms' }) {
  const [amenities, setAmenities] = useState([]);
  const [rooms, setRooms] = useState(null);
  const [size, setSize] = useState(1);
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.amenities().then(setAmenities).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let active = true;
    setRooms(null);
    api
      .rooms({ minCapacity: size > 1 ? size : undefined, amenityIds: picked.length ? picked.join(',') : undefined })
      .then((r) => active && setRooms(r))
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [size, picked]);

  const q = query.trim().toLowerCase();
  const shown = rooms && (q ? rooms.filter((r) => `${r.name} ${r.building}`.toLowerCase().includes(q)) : rooms);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <h1>Find a room</h1>
      <section className="filters" aria-label="Filters">
        <div className="filter">
          <label className="filter-label" htmlFor="room-search">Search</label>
          <input
            id="room-search"
            type="search"
            className="search-input"
            placeholder="Room or building, e.g. Library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter">
          <span className="filter-label" id="size-label">Group size</span>
          <div className="segmented" role="radiogroup" aria-labelledby="size-label">
            {SIZES.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={size === n}
                className={size === n ? 'seg seg--on' : 'seg'}
                onClick={() => setSize(n)}
              >
                {n === 1 ? 'Just me' : `${n}+`}
              </button>
            ))}
          </div>
        </div>
        <div className="filter">
          <span className="filter-label" id="features-label">Needs</span>
          <div className="chips" role="group" aria-labelledby="features-label">
            {amenities.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={picked.includes(a.id)}
                className={picked.includes(a.id) ? 'chip chip--on' : 'chip'}
                onClick={() => toggle(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!rooms && !error && <p className="page-status">Loading rooms…</p>}
      {shown && shown.length === 0 && (
        <div className="empty">
          <p>No rooms match your search and filters.</p>
          <button type="button" className="btn btn--quiet" onClick={() => { setSize(1); setPicked([]); setQuery(''); }}>Clear filters</button>
        </div>
      )}
      {shown && shown.length > 0 && (
        <>
        <p className="result-count">{shown.length} {shown.length === 1 ? 'room matches' : 'rooms match'}</p>
        <ul className="room-list">
          {shown.map((r) => (
            <li key={r.id} className="room-row">
              <div className="room-cap" aria-label={`Seats ${r.capacity}`}>
                <span className="room-cap-num">{r.capacity}</span>
                <span className="room-cap-unit">seats</span>
              </div>
              <div className="room-main">
                <h2 className="room-name">{r.name}</h2>
                <p className="muted">{r.building}, floor {r.floor}. {r.description}</p>
                <p className="room-tags">{r.amenities.join(', ')}</p>
              </div>
              <Link className="btn btn--outline" to={`${basePath}/${r.id}`}>See open times</Link>
            </li>
          ))}
        </ul>
        </>
      )}
    </>
  );
}
