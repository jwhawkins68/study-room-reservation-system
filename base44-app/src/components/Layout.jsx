import { Link, NavLink } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import { USE_MOCK } from '../lib/config';
import AssistantLauncher from './AssistantLauncher';

// One frame for every page. Signed out: Log in / Create account. Signed in: the portal's nav.
export default function Layout({ children }) {
  const { user, logout, prefs, setPrefs } = useAuth();
  const isStaff = user?.role === 'staff';

  return (
    <div className={user ? `shell shell--signed-in${isStaff ? ' shell--staff' : ''}` : 'shell'}>
      <a href="#main" className="skip-link">Skip to main content</a>
      <div className="utility">
        <div className="utility-inner">
          <span className="utility-name">Prairie View A&amp;M University</span>
          {/* SRRS-23: display settings, on every page */}
          <div className="display-toggles" role="group" aria-label="Display settings">
            <button type="button" className="toggle" aria-pressed={!!prefs?.largeText} onClick={() => setPrefs({ largeText: !prefs?.largeText })}>
              <span aria-hidden="true">A+</span> Larger text
            </button>
            <button type="button" className="toggle" aria-pressed={!!prefs?.highContrast} onClick={() => setPrefs({ highContrast: !prefs?.highContrast })}>
              <span aria-hidden="true">◐</span> High contrast
            </button>
          </div>
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
            {isStaff && (
              <span className="portal-tag">
                {user.staffRole === 'coordinator' ? `Coordinator: ${user.buildings.join(', ')}` : 'Staff portal'}
              </span>
            )}
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
                <NavLink to="/student/assistant">Assistant</NavLink>
                <NavLink to="/help">How to use</NavLink>
              </>
            )}
            {isStaff && (
              <>
                <NavLink to="/staff" end>Admin center</NavLink>
                <NavLink to="/staff/rooms">Rooms</NavLink>
                <NavLink to="/staff/book">Book a room</NavLink>
                <NavLink to="/staff/bookings">My bookings</NavLink>
                <NavLink to="/staff/audit">Audit log</NavLink>
                <NavLink to="/staff/analytics">Analytics</NavLink>
                <NavLink to="/staff/assistant">Assistant</NavLink>
                {user.staffRole === 'system_admin' && <NavLink to="/staff/team">Coordinators</NavLink>}
              </>
            )}
          </nav>
        </div>
      </header>

      <p className="prototype-note" role="note">
        Class prototype only. Not an official PVAMU website or live reservation system.
        {USE_MOCK && ' Running on sample data.'}
      </p>

      <main id="main" className="page">{children}</main>
      {user && <AssistantLauncher />}

      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-title">Study Room Reservation System</p>
          <p>A Software Engineering class project, Fall 2026. Not an official university service. <a href="/help" className="footer-link">How to use this site</a></p>
        </div>
      </footer>
    </div>
  );
}
