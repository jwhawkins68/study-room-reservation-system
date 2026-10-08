// Sample data that mirrors the seed rows in schema.sql, shaped exactly like the API contract.
// Used when VITE_USE_MOCK=true or no Supabase URL is set.
import { ApiError } from './errors';

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const amenities = [
  { id: 1, name: 'Whiteboard' },
  { id: 2, name: 'TV / HDMI' },
  { id: 3, name: 'Power outlets' },
  { id: 4, name: 'Webcam' },
  { id: 5, name: 'Accessible' },
];

const rooms = [
  { id: 1, name: 'Study Room 101', building: 'Library', floor: '1', capacity: 4, isActive: true,
    description: 'Quiet room near the entrance', amenities: ['Power outlets'] },
  { id: 2, name: 'Study Room 102', building: 'Library', floor: '1', capacity: 6, isActive: true,
    description: 'Group room with a large table', amenities: ['Power outlets', 'Whiteboard'] },
  { id: 3, name: 'Study Room 201', building: 'Library', floor: '2', capacity: 8, isActive: true,
    description: 'Presentation practice room', amenities: ['TV / HDMI', 'Webcam', 'Whiteboard'] },
  { id: 4, name: 'Study Room 202', building: 'Library', floor: '2', capacity: 2, isActive: true,
    description: 'Small room for pairs', amenities: ['Power outlets'] },
  { id: 5, name: 'Collab Room A', building: 'Student Center', floor: '3', capacity: 10, isActive: true,
    description: 'Large collaboration space', amenities: ['Accessible', 'TV / HDMI', 'Whiteboard'] },
];

// Test accounts. Password for both: password123
const users = [
  { id: 'u-student', fullName: 'Test Student', studentId: 'P00000001', email: 'student@test.edu', role: 'student', password: 'password123' },
  { id: 'u-staff', fullName: 'Test Staff', studentId: null, email: 'staff@test.edu', role: 'staff', password: 'password123' },
];

const SESSION_KEY = 'srrs-mock-session';
let currentUserId = null;
try { currentUserId = sessionStorage.getItem(SESSION_KEY); } catch { /* storage unavailable */ }

function setSession(id) {
  currentUserId = id;
  try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// Sample reservations (Sprint 2 preview). Kept for the browser session so a refresh doesn't lose them.
const RES_KEY = 'srrs-mock-reservations';
let reservations = [];
let nextResId = 1;
try {
  reservations = JSON.parse(sessionStorage.getItem(RES_KEY) || '[]');
  nextResId = reservations.reduce((m, r) => Math.max(m, r.id), 0) + 1;
} catch { reservations = []; }
function saveReservations() {
  try { sessionStorage.setItem(RES_KEY, JSON.stringify(reservations)); } catch { /* ignore */ }
}
const overlaps = (aStart, aEnd, bStart, bEnd) => new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);

function publicUser(u) {
  const { password, ...rest } = u;
  return rest;
}

function requireUser() {
  const u = users.find((x) => x.id === currentUserId);
  if (!u) throw new ApiError(401, 'UNAUTHENTICATED', 'Your session ended. Log in again.');
  return u;
}

// Busy times are generated per room and per day so every date shows a realistic mix.
function busyFor(roomId, fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const out = [];
  for (let day = new Date(from.getFullYear(), from.getMonth(), from.getDate()); day < to; day.setDate(day.getDate() + 1)) {
    const at = (h, m = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString();
    const seed = (roomId + day.getDate()) % 4;
    out.push({ start: at(9 + seed, 0), end: at(10 + seed, 30), kind: 'reserved' });
    out.push({ start: at(13 + seed, 30), end: at(15 + seed, 0), kind: 'reserved' });
    if (roomId === 5) out.push({ start: at(18), end: at(22), kind: 'blocked' });
    if (roomId === 2 && seed === 1) out.push({ start: at(19), end: at(21), kind: 'reserved' });
  }
  for (const r of reservations) {
    if (r.roomId === roomId && r.status === 'confirmed') out.push({ start: r.start, end: r.end, kind: 'reserved' });
  }
  return out.filter((b) => new Date(b.start) < to && new Date(b.end) > from);
}

export const mockAuth = {
  async session() {
    await wait(50);
    const u = users.find((x) => x.id === currentUserId);
    return u ? publicUser(u) : null;
  },
  async login(email, password) {
    await wait();
    const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) {
      throw new ApiError(400, 'INVALID_LOGIN', 'That email and password don’t match an account.');
    }
    setSession(u.id);
    return publicUser(u);
  },
  async logout() {
    setSession(null);
  },
};

export const mockApi = {
  async signup({ fullName, studentId, email, password }) {
    await wait();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account already uses that email.');
    }
    if (users.some((u) => u.studentId && u.studentId.toLowerCase() === studentId.toLowerCase())) {
      throw new ApiError(409, 'STUDENT_ID_TAKEN', 'An account already uses that student ID.');
    }
    const u = { id: `u-${users.length + 1}`, fullName, studentId, email, role: 'student', password };
    users.push(u);
    return { id: u.id, email: u.email };
  },
  async me() {
    await wait(50);
    return publicUser(requireUser());
  },
  async amenities() {
    await wait();
    requireUser();
    return amenities;
  },
  async rooms({ minCapacity, amenityIds } = {}) {
    await wait();
    requireUser();
    const wanted = amenityIds
      ? String(amenityIds).split(',').map(Number).map((id) => amenities.find((a) => a.id === id)?.name)
      : [];
    return rooms
      .filter((r) => r.isActive)
      .filter((r) => !minCapacity || r.capacity >= Number(minCapacity))
      .filter((r) => wanted.every((name) => r.amenities.includes(name)))
      .map(({ isActive, ...r }) => r);
  },
  async room(id, { from, to } = {}) {
    await wait();
    requireUser();
    const r = rooms.find((x) => x.id === Number(id) && x.isActive);
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'That room doesn’t exist or is closed.');
    const { isActive, ...rest } = r;
    return { ...rest, busy: busyFor(r.id, from, to) };
  },

  async createReservation({ roomId, start, end, partySize = 1, purpose = '' }) {
    await wait();
    const u = requireUser();
    if (u.role !== 'student') throw new ApiError(403, 'FORBIDDEN', 'Only students can book rooms.');
    const r = rooms.find((x) => x.id === Number(roomId));
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'That room doesn’t exist.');
    if (!r.isActive) throw new ApiError(400, 'ROOM_INACTIVE', 'That room is closed.');
    const s0 = new Date(start); const e0 = new Date(end);
    if (!(e0 > s0)) throw new ApiError(400, 'VALIDATION', 'The end time must be after the start time.');
    if (s0 < new Date()) throw new ApiError(400, 'IN_PAST', 'That time has already passed.');
    if (e0 - s0 > 3 * 60 * 60 * 1000) throw new ApiError(400, 'TOO_LONG', 'Bookings can be up to 3 hours.');
    if (partySize > r.capacity) throw new ApiError(400, 'OVER_CAPACITY', `This room fits ${r.capacity}.`);
    const busy = busyFor(r.id, s0.toISOString(), e0.toISOString());
    if (busy.some((b) => b.kind === 'blocked')) throw new ApiError(400, 'ROOM_BLOCKED', 'Staff closed the room for part of that time.');
    if (busy.length) throw new ApiError(409, 'ROOM_TAKEN', 'That room is already booked for part of that time.');
    const res = {
      id: nextResId++, roomId: r.id, roomName: r.name, building: r.building,
      userId: u.id, start: s0.toISOString(), end: e0.toISOString(), partySize, purpose,
      status: 'confirmed', createdAt: new Date().toISOString(), cancelledAt: null,
    };
    reservations.push(res);
    saveReservations();
    return res;
  },
  async myReservations(scope = 'upcoming') {
    await wait();
    const u = requireUser();
    const now = new Date();
    const mine = reservations.filter((r) => r.userId === u.id);
    const upcoming = (r) => r.status === 'confirmed' && new Date(r.end) > now;
    return scope === 'past'
      ? mine.filter((r) => !upcoming(r)).sort((a, b) => new Date(b.start) - new Date(a.start))
      : mine.filter(upcoming).sort((a, b) => new Date(a.start) - new Date(b.start));
  },
  async cancelReservation(id) {
    await wait();
    const u = requireUser();
    const r = reservations.find((x) => x.id === Number(id));
    if (!r || (r.userId !== u.id && u.role !== 'staff')) throw new ApiError(404, 'NOT_FOUND', 'Booking not found.');
    if (r.status !== 'confirmed') throw new ApiError(400, 'VALIDATION', 'That booking is already cancelled.');
    r.status = 'cancelled';
    r.cancelledAt = new Date().toISOString();
    saveReservations();
    return r;
  },
};
