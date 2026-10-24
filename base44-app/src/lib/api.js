// Same functions and data shapes as web/src/lib/api.js in the team repo,
// backed by Base44 entities and backend functions instead of Supabase + Express.
import { base44 } from '@/api/base44Client';
import { ApiError } from './errors';

const AMENITY_NAMES = ['Whiteboard', 'TV / HDMI', 'Power outlets', 'Webcam', 'Accessible'];
const AMENITIES = AMENITY_NAMES.map((name, i) => ({ id: i + 1, name }));

// Backend functions answer { error: { code, message, details } } on failure, like the Express API did.
async function call(name, data) {
  try {
    const res = await base44.functions.invoke(name, data);
    return res.data;
  } catch (err) {
    const e = err?.response?.data?.error || {};
    throw new ApiError(err?.response?.status || 0, e.code || 'UNKNOWN', e.message || 'Something went wrong. Try again.', e.details);
  }
}

async function entity(promise) {
  try {
    return await promise;
  } catch (err) {
    throw new ApiError(err?.status || 0, 'UNKNOWN', err?.message || 'Couldn’t load data. Try again.');
  }
}

const toRoom = (r) => ({
  id: r.id,
  name: r.name,
  building: r.building,
  floor: r.floor,
  capacity: r.capacity,
  description: r.description,
  isActive: r.is_active !== false,
  amenities: [...(r.amenities || [])].sort(),
});

const byBuildingThenName = (a, b) =>
  a.building.localeCompare(b.building) || a.name.localeCompare(b.name, undefined, { numeric: true });

async function allRooms() {
  const rows = await entity(base44.entities.Room.list(undefined, 5000));
  return rows.map(toRoom).sort(byBuildingThenName);
}

export const api = {
  // SRRS-4
  amenities: async () => AMENITIES,

  // SRRS-4 and SRRS-9: ?minCapacity=&amenityIds=1,2&start=&end=
  rooms: async ({ minCapacity, amenityIds, start, end } = {}) => {
    let rooms = (await allRooms()).filter((r) => r.isActive);
    if (Number(minCapacity) > 0) rooms = rooms.filter((r) => r.capacity >= Number(minCapacity));
    if (amenityIds) {
      const wanted = String(amenityIds).split(',').map((id) => AMENITY_NAMES[Number(id) - 1]).filter(Boolean);
      rooms = rooms.filter((r) => wanted.every((w) => r.amenities.includes(w)));
    }
    if (start && end) {
      const { busyRoomIds } = await call('rooms-open-at', { start, end });
      const busy = new Set(busyRoomIds);
      rooms = rooms.filter((r) => !busy.has(r.id));
    }
    return rooms;
  },

  // SRRS-5: room details + busy times for a range. Staff also get who booked.
  room: async (id, { from, to }, { excludeId, includeClosed } = {}) => {
    const room = (await allRooms()).find((r) => r.id === id);
    if (!room || (!room.isActive && !includeClosed)) throw new ApiError(404, 'NOT_FOUND', 'That room doesn’t exist or is closed.');
    const { busy } = await call('room-schedule', { roomId: id, from, to, excludeId });
    return { ...room, busy };
  },

  // SRRS-6
  createReservation: (body) => call('book-room', body),

  // SRRS-7: upcoming = confirmed and not yet over; past = over, or cancelled.
  myReservations: async (scope = 'upcoming') => {
    const me = await entity(base44.auth.me());
    const [rows, rooms] = await Promise.all([
      entity(base44.entities.Reservation.filter({ user_id: me.id }, '-starts_at', 5000)),
      allRooms(),
    ]);
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const now = Date.now();
    const shaped = rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      roomName: roomById.get(r.room_id)?.name || 'Room',
      building: roomById.get(r.room_id)?.building,
      start: r.starts_at,
      end: r.ends_at,
      partySize: r.party_size,
      purpose: r.purpose,
      status: r.status,
      cancelledAt: r.cancelled_at,
      cancelReason: r.cancel_reason,
    }));
    if (scope === 'past') {
      return shaped
        .filter((r) => r.status !== 'confirmed' || Date.parse(r.end) <= now)
        .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
    }
    return shaped
      .filter((r) => r.status === 'confirmed' && Date.parse(r.end) > now)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  },

  // SRRS-8
  cancelReservation: (id, reason) => call('cancel-booking', { id, reason }),

  // SRRS-10
  updateReservation: (id, { start, end }) => call('change-booking', { id, start, end }),

  // Sprint 3 staff tools
  allRooms, // includes closed rooms (SRRS-12)
  adminOverview: (body) => call('admin-overview', body), // SRRS-11
  manageRoom: (body) => call('manage-room', body), // SRRS-12
  manageBlock: (body) => call('manage-block', body), // SRRS-12
  auditLog: (body) => call('audit-log', body), // SRRS-14
  staffList: () => call('manage-staff', { action: 'list' }), // SRRS-13
  updateStaff: (body) => call('manage-staff', { action: 'update', ...body }), // SRRS-13

  // SRRS-1 profile step
  completeProfile: (body) => call('complete-profile', body),
  studentIdAvailable: async (studentId) => (await call('check-student-id', { studentId })).available,
};
