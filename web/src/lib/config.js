const env = import.meta.env;

export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export const API_URL = env.VITE_API_URL || '/api';

// Mock mode: no Supabase, no backend. Runs entirely on sample data in src/lib/mock.js.
export const USE_MOCK = env.VITE_USE_MOCK === 'true' || !SUPABASE_URL;
