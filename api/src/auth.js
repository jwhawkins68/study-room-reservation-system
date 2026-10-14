import { anon, asUser } from './supabase.js';
import { ApiError, fromDbError } from './errors.js';

// Story 2/3: every request (except sign-up) must carry a valid Supabase token.
// Adds req.user (auth user), req.profile (name, role...), and req.db (client acting as that user).
export async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Log in to continue.');

    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user) throw new ApiError(401, 'UNAUTHENTICATED', 'Your session ended. Log in again.');

    req.user = data.user;
    req.db = asUser(token);

    const { data: profile, error: pErr } = await req.db
      .from('profiles')
      .select('id, full_name, student_id, email, role')
      .eq('id', data.user.id)
      .single();
    if (pErr) throw fromDbError(pErr);
    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (role) => (req, _res, next) =>
  req.profile?.role === role ? next() : next(new ApiError(403, 'FORBIDDEN', 'You’re not allowed to do that.'));
