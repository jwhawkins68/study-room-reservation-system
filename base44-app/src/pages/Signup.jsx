import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import AuthShell from './AuthShell';

const EMPTY = { fullName: '', studentId: '', email: '', password: '', confirm: '' };

function validate(f) {
  const errors = {};
  if (!f.fullName.trim()) errors.fullName = 'Enter your full name.';
  if (!/^[A-Za-z0-9-]{4,20}$/.test(f.studentId.trim())) errors.studentId = 'Enter a student ID like P00123456.';
  if (!/^\S+@\S+\.\S+$/.test(f.email)) errors.email = 'Enter an email like name@pvamu.edu.';
  if (f.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (f.confirm !== f.password) errors.confirm = 'The passwords don’t match.';
  return errors;
}

// Story 1: create an account with name, student ID, email, and password.
// Base44 confirms the email with a 6-digit code before the account can sign in.
export default function Signup() {
  const { user, startSignup, finishSignup, resendCode } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('form');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');

  if (user && step === 'form') return <Navigate to={homeFor(user)} replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const clean = () => ({ ...form, fullName: form.fullName.trim(), studentId: form.studentId.trim().toUpperCase(), email: form.email.trim() });

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await startSignup(clean());
      setStep('code');
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') setErrors({ email: err.message });
      else if (err.code === 'STUDENT_ID_TAKEN') setErrors({ studentId: err.message });
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e) {
    e.preventDefault();
    setFormError('');
    if (!/^\d{6}$/.test(code)) {
      setFormError('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    try {
      const u = await finishSignup(clean(), code);
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setFormError('');
    try {
      await resendCode(form.email);
      setNote('We sent a new code.');
    } catch {
      setFormError('Couldn’t send a new code. Wait a minute and try again.');
    }
  }

  if (step === 'code') {
    return (
      <AuthShell title="Check your email" intro={`We sent a 6-digit code to ${form.email.trim()}.`}>
        <form onSubmit={onVerify} noValidate className="form">
          <label className="field">
            <span>Verification code</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </label>
          {note && <p className="muted" role="status">{note}</p>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="btn btn--primary" disabled={busy}>{busy ? 'Checking…' : 'Verify and continue'}</button>
        </form>
        <p className="muted">
          Didn’t get it? <button type="button" className="link-btn" onClick={onResend}>Send a new code</button>
        </p>
      </AuthShell>
    );
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
        {field('studentId', 'Student ID', { autoComplete: 'off', placeholder: 'P00123456' })}
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
