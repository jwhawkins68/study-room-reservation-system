import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './AuthContext';

// Story 3: students can't open staff pages (and staff are sent to their own portal).
export default function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-status">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}
