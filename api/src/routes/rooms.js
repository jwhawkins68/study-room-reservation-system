import { Router } from 'express';
import { ApiError, handle, fromDbError } from '../errors.js';

const router = Router();

const ROOM_SELECT = 'id, name, building, floor, capacity, description, room_amenities(amenities(id, name))';

function toRoom(r) {
  const list = (r.room_amenities || []).map((ra) => ra.amenities).filter(Boolean);
  return {
    id: r.id,
    name: r.name,
    building: r.building,
    floor: r.floor,
    capacity: r.capacity,
    description: r.description,
    amenities: list.map((a) => a.name).sort(),
    amenityIds: list.map((a) => a.id),
  };
}

const isDate = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

// Busy times come from a database function that never reveals who booked.
async function busyTimes(db, roomId, from, to) {
  const { data, error } = await db.rpc('room_busy_times', { p_room_id: roomId, p_from: from, p_to: to });
  if (error) throw fromDbError(error);
  return data.map((b) => ({ start: b.starts_at, end: b.ends_at, kind: b.kind }));
}

// Story 4 (SRRS-4): GET /api/amenities
export const amenitiesRouter = Router();
amenitiesRouter.get('/', handle(async (req, res) => {
  const { data, error } = await req.db.from('amenities').select('id, name').order('name');
  if (error) throw fromDbError(error);
  res.json(data);
}));

// Story 4 (SRRS-4) and Story 9 (SRRS-9): GET /api/rooms?minCapacity=&amenityIds=1,2&start=&end=
router.get('/', handle(async (req, res) => {
  let q = req.db.from('rooms').select(ROOM_SELECT).eq('is_active', true).order('building').order('name');
  const minCapacity = Number(req.query.minCapacity);
  if (minCapacity > 0) q = q.gte('capacity', minCapacity);

  const { data, error } = await q;
  if (error) throw fromDbError(error);
  let rooms = data.map(toRoom);

  if (req.query.amenityIds) {
    const wanted = String(req.query.amenityIds).split(',').map(Number).filter(Boolean);
    rooms = rooms.filter((r) => wanted.every((id) => r.amenityIds.includes(id)));
  }

  const { start, end } = req.query;
  if (start || end) {
    if (!isDate(start) || !isDate(end)) throw new ApiError(400, 'VALIDATION', 'start and end must both be valid times.');
    const free = await Promise.all(rooms.map(async (r) => (await busyTimes(req.db, r.id, start, end)).length === 0));
    rooms = rooms.filter((_, i) => free[i]);
  }

  res.json(rooms.map(({ amenityIds, ...r }) => r));
}));

// Story 5 (SRRS-5): GET /api/rooms/:id?from=&to=   (defaults to the next 24 hours)
router.get('/:id', handle(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(404, 'NOT_FOUND', 'That room doesn’t exist.');

  const from = isDate(req.query.from) ? req.query.from : new Date().toISOString();
  const to = isDate(req.query.to) ? req.query.to : new Date(Date.parse(from) + 24 * 3600 * 1000).toISOString();

  const { data, error } = await req.db.from('rooms').select(ROOM_SELECT).eq('id', id).eq('is_active', true).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'That room doesn’t exist or is closed.');

  const { amenityIds, ...room } = toRoom(data);
  res.json({ ...room, busy: await busyTimes(req.db, id, from, to) });
}));

export default router;
