import { Link } from 'react-router-dom';

// Shared frame for the login and sign-up screens.
export default function AuthShell({ title, intro, children }) {
  return (
    <div className="auth">
      <section className="auth-side">
        <p className="auth-side-school">Prairie View A&amp;M University</p>
        <div>
          <Link to="/" className="auth-side-title">Study Room Reservations</Link>
          <p className="auth-side-line">Find a room that fits your group, and know it’s free before you walk over.</p>
        </div>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {intro && <p className="muted">{intro}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}
