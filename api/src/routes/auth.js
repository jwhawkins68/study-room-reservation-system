import { Router } from 'express';
import { admin } from '../supabase.js';
import { ApiError, handle } from '../errors.js';

const router = Router();

// Story 1 (SRRS-1): POST /api/auth/signup
// Creates the Supabase login and profile in one step, so duplicates get clear errors.
router.post('/signup', handle(async (req, res) => {
  if (!admin) throw new ApiError(503, 'SIGNUP_UNAVAILABLE', 'Sign-up isn’t set up on the server yet (missing secret key).');

  const fullName = String(req.body.fullName || '').trim();
  const studentId = String(req.body.studentId || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const missing = [];
  if (!fullName) missing.push('fullName');
  if (!studentId) missing.push('studentId');
  if (!/^\S+@\S+\.\S+$/.test(email)) missing.push('email');
  if (password.length < 8) missing.push('password');
  if (missing.length) throw new ApiError(400, 'VALIDATION', 'Some fields are missing or invalid.', missing);

  const { data: taken, error: tErr } = await admin
    .from('profiles')
    .select('email, student_id')
    .or(`email.eq.${email},student_id.eq.${studentId}`);
  if (tErr) throw tErr;
  if (taken.some((p) => p.email === email)) throw new ApiError(409, 'EMAIL_TAKEN', 'An account already uses that email.');
  if (taken.some((p) => p.student_id === studentId)) {
    throw new ApiError(409, 'STUDENT_ID_TAKEN', 'An account already uses that student ID.');
  }

  // The database trigger on_auth_user_created copies these into the profiles table.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, student_id: studentId },
  });
  if (error) {
    if (/already.*registered|exists/i.test(error.message)) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account already uses that email.');
    }
    throw new ApiError(400, 'SIGNUP_FAILED', 'We couldn’t create that account. Check the details and try again.');
  }
  res.status(201).json({ id: data.user.id, email: data.user.email });
}));

export default router;
