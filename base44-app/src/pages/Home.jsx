import { Link, Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import Layout from '../components/Layout';

const STEPS = [
  { n: 1, title: 'Browse rooms', text: 'Compare rooms by building, size, and equipment like whiteboards and screens.' },
  { n: 2, title: 'Check open times', text: 'See which half-hours are open before you walk across campus.' },
  { n: 3, title: 'Reserve it', text: 'Book up to 3 hours under your name and get a confirmation right away.' },
];

// Public landing page (layout ideas from Steph's Sprint 1 prototype).
export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p className="page-status">Loading…</p>;
  if (user) return <Navigate to={homeFor(user)} replace />;

  return (
    <Layout>
      <section className="hero">
        <p className="eyebrow">Study with confidence</p>
        <h1>Find the right room for your next study session.</h1>
        <p className="hero-lead">
          Search study rooms by size and equipment, check open times, and keep your reservations in one place.
        </p>
        <div className="actions">
          <Link to="/signup" className="btn btn--primary">Create an account</Link>
          <Link to="/login" className="btn btn--outline">Log in</Link>
        </div>
      </section>

      <section className="steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading">From search to study in three steps</h2>
        <ol className="step-list">
          {STEPS.map((s) => (
            <li key={s.n} className="step">
              <span className="step-num" aria-hidden="true">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </Layout>
  );
}
