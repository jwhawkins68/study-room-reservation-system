import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import AuthShell from './AuthShell';

// Story 1: a signed-in student without a saved student ID adds it here before booking.
export default function CompleteProfile() {
  const { user, loading, completeProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="page-status">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'staff' || user.studentId) return <Navigate to={homeFor(user)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !/^[A-Za-z0-9-]{4,20}$/.test(studentId.trim())) {
      setError('Enter your full name and a student ID like P00123456.');
      return;
    }
    setBusy(true);
    try {
      const u = await completeProfile({ fullName: fullName.trim(), studentId: studentId.trim().toUpperCase() });
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Finish your profile" intro="Bookings are held under your name and student ID.">
      <form onSubmit={onSubmit} noValidate className="form">
        <label className="field">
          <span>Full name</span>
          <input value={fullName} autoComplete="name" onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field">
          <span>Student ID</span>
          <input value={studentId} placeholder="P00123456" autoComplete="off" onChange={(e) => setStudentId(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
      </form>
      <p className="muted">Signed in as {user.email}. <button type="button" className="link-btn" onClick={logout}>Log out</button></p>
    </AuthShell>
  );
}
