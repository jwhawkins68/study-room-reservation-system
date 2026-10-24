// SRRS-12: add, edit, close, and reopen rooms. SRRS-13: coordinators only in their buildings.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, requireStaff, requireRoomScope, inScope } from '../../shared/booking.ts';

const AMENITIES = ['Whiteboard', 'TV / HDMI', 'Power outlets', 'Webcam', 'Accessible'];

function clean(input: any) {
  const out: any = {};
  const bad: string[] = [];
  if ('name' in input) { out.name = String(input.name ?? '').trim().slice(0, 80); if (!out.name) bad.push('name'); }
  if ('building' in input) { out.building = String(input.building ?? '').trim().slice(0, 80); if (!out.building) bad.push('building'); }
  if ('floor' in input) out.floor = String(input.floor ?? '').trim().slice(0, 20);
  if ('capacity' in input) { out.capacity = Number(input.capacity); if (!Number.isInteger(out.capacity) || out.capacity < 1 || out.capacity > 200) bad.push('capacity'); }
  if ('description' in input) out.description = String(input.description ?? '').trim().slice(0, 300);
  if ('amenities' in input) {
    out.amenities = Array.isArray(input.amenities) ? input.amenities.filter((a: any) => AMENITIES.includes(a)) : [];
  }
  if (bad.length) throw new RuleError('VALIDATION', 'Check the highlighted fields: name and building are required, seats must be 1–200.', 400, bad);
  return out;
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const scope = requireStaff(user);
    const body = await req.json().catch(() => ({}));
    const rooms = await sr.entities.Room.list(undefined, 5000);
    const dupe = (building: string, name: string, selfId?: string) =>
      rooms.some((r: any) => r.id !== selfId && r.building.toLowerCase() === building.toLowerCase() && r.name.toLowerCase() === name.toLowerCase());

    if (body.action === 'create') {
      const fields = clean({ name: body.name, building: body.building, floor: body.floor, capacity: body.capacity, description: body.description, amenities: body.amenities });
      if (!inScope(scope, fields.building)) throw new RuleError('FORBIDDEN', `You can only add rooms in ${scope.buildings.join(', ')}.`, 403);
      if (dupe(fields.building, fields.name)) throw new RuleError('DUPLICATE', `${fields.building} already has a room called ${fields.name}.`, 409);
      const room = await sr.entities.Room.create({ ...fields, is_active: true });
      return Response.json({ room }, { status: 201 });
    }

    const room = rooms.find((r: any) => r.id === body.id);
    if (!room) throw new RuleError('NOT_FOUND', 'Room not found.', 404);
    requireRoomScope(scope, room);

    if (body.action === 'update') {
      const fields = clean(body.fields || {});
      if (fields.building && !inScope(scope, fields.building)) throw new RuleError('FORBIDDEN', `You can only move rooms within ${scope.buildings.join(', ')}.`, 403);
      if (dupe(fields.building ?? room.building, fields.name ?? room.name, room.id)) throw new RuleError('DUPLICATE', 'Another room in that building has that name.', 409);
      const updated = await sr.entities.Room.update(room.id, fields);
      return Response.json({ room: { ...room, ...updated } });
    }
    if (body.action === 'close' || body.action === 'reopen') {
      const updated = await sr.entities.Room.update(room.id, { is_active: body.action === 'reopen' });
      return Response.json({ room: { ...room, ...updated } });
    }
    throw new RuleError('VALIDATION', 'Unknown action.', 400);
  } catch (err) {
    return errorResponse(err);
  }
}
