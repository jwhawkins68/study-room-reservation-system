import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import AuthShell from './AuthShell';

const EMPTY = { fullName: '', studentId: '', email: '', password: '', confirm: '' };

function validate(f) {
  const errors = {};
  if (!f.fullName.trim()) errors.fullName = 'Enter your full name.';
  if (!f.studentId.trim()) errors.studentId = 'Enter your student ID.';
  if (!/^\S+@\S+\.\S+$/.test(f.email)) errors.email = 'Enter an email like name@pvamu.edu.';
  if (f.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (f.confirm !== f.password) errors.confirm = 'The passwords don’t match.';
  return errors;
}

// Story 1: create an account with name, student ID, email, and password.
export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const { confirm, ...body } = form;
      const u = await signup({ ...body, fullName: form.fullName.trim(), studentId: form.studentId.trim(), email: form.email.trim() });
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') setErrors({ email: err.message });
      else if (err.code === 'STUDENT_ID_TAKEN') setErrors({ studentId: err.message });
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key, label, props = {}) => (
    <label className={errors[key] ? 'field field--error' : 'field'}>
      <span>{label}</span>
      <input value={form[key]} onChange={set(key)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-err` : undefined} {...props} />
      {errors[key] && <small id={`${key}-err`} className="field-error">{errors[key]}</small>}
    </label>
  );

  return (
    <AuthShell title="Create your account" intro="Your bookings are saved under your name and student ID.">
      <form onSubmit={onSubmit} noValidate className="form">
        {field('fullName', 'Full name', { autoComplete: 'name' })}
        {field('studentId', 'Student ID', { autoComplete: 'off' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
        {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
        <p className="alert">This is a class prototype. Don’t reuse your real PVAMU password.</p>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthShell>
  );
}
