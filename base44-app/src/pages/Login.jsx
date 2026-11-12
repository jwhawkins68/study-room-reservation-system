import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import { USE_MOCK } from '../lib/config';
import AuthShell from './AuthShell';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const u = await login(email, password);
      const from = location.state?.from?.pathname;
      navigate(from && from.startsWith(homeFor(u)) ? from : homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Log in">
      <form onSubmit={onSubmit} noValidate className="form">
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <p className="alert">Use your project test account. Don’t enter your real PVAMU password.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="muted">New here? <Link to="/signup">Create an account</Link></p>
      {USE_MOCK && (
        <p className="hint">
          Sample accounts: <code>student@test.edu</code> or <code>staff@test.edu</code>, password <code>password123</code>
        </p>
      )}
    </AuthShell>
  );
}
