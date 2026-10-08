// One function per endpoint in the API Contract tab of the SRRS Project Hub.
import { API_URL, USE_MOCK } from './config';
import { ApiError } from './errors';
import { supabase } from './supabase';
import { mockApi } from './mock';

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries).toString() : '';
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the server. Check that the API is running.');
  }

  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error || {};
    throw new ApiError(res.status, e.code || 'UNKNOWN', e.message || `Request failed (${res.status}).`, e.details);
  }
  return json;
}

const realApi = {
  // Sprint 1
  signup: (body) => request('/auth/signup', { method: 'POST', body, auth: false }),
  me: () => request('/me'),
  amenities: () => request('/amenities'),
  rooms: (filters) => request('/rooms' + qs(filters)),
  room: (id, range) => request(`/rooms/${id}` + qs(range)),

  // Sprint 2 (wired to the contract; screens come next sprint)
  createReservation: (body) => request('/reservations', { method: 'POST', body }),
  myReservations: (scope = 'upcoming') => request('/me/reservations' + qs({ scope })),
  cancelReservation: (id) => request(`/reservations/${id}/cancel`, { method: 'POST' }),
  updateReservation: (id, body) => request(`/reservations/${id}`, { method: 'PATCH', body }),
};

export const api = USE_MOCK ? mockApi : realApi;
