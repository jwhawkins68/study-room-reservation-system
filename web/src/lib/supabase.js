import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_MOCK } from './config';

// null in mock mode so nothing tries to reach Supabase.
export const supabase = USE_MOCK ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
