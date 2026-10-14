import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

// Used only to check sign-in tokens.
export const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, opts);

// Acts AS the signed-in user, so the database's row-level security rules apply to every query.
export function asUser(token) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Bypasses security rules. Only for sign-up and logging rejected bookings. Null if no secret key is set.
export const admin = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts) : null;
