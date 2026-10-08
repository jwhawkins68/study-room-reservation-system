import { Link, NavLink } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import { USE_MOCK } from '../lib/config';

// One frame for every page. Signed out: Log in / Create account. Signed in: the portal's nav.
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const isStaff = user?.role === 'staff';

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to main content</a>
      <div className="utility">
        <div className="utility-inner">
          <span className="utility-name">Prairie View A&amp;M University</span>
          {user && (
            <div className="account">
              <span className="account-name">{user.fullName}{isStaff ? ', staff' : ''}</span>
              <button type="button" className="link-btn" onClick={logout}>Log out</button>
            </div>
          )}
        </div>
      </div>

      <header className="masthead">
        <div className="masthead-inner">
          <Link to={user ? homeFor(user) : '/'} className="site-title">
            Study Room Reservations
            {isStaff && <span className="portal-tag">Staff portal</span>}
          </Link>
          <nav className="mainnav" aria-label="Main">
            {!user && (
              <>
                <NavLink to="/login">Log in</NavLink>
                <Link to="/signup" className="btn btn--gold nav-cta">Create account</Link>
              </>
            )}
            {user && !isStaff && (
              <>
                <NavLink to="/student" end>Dashboard</NavLink>
                <NavLink to="/student/rooms">Find a room</NavLink>
              </>
            )}
            {isStaff && <NavLink to="/staff" end>Rooms</NavLink>}
          </nav>
        </div>
      </header>

      <p className="prototype-note" role="note">
        Class prototype only. Not an official PVAMU website or live reservation system.
        {USE_MOCK && ' Running on sample data.'}
      </p>

      <main id="main" className="page">{children}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-title">Study Room Reservation System</p>
          <p>A Software Engineering class project, Fall 2026. Not an official university service.</p>
        </div>
      </footer>
    </div>
  );
}
