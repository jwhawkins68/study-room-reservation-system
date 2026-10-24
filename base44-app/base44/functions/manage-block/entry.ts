// SRRS-12: block off a room for a period with a reason, or remove a block. Students can't book blocked times
// (checked in shared/booking.ts). If bookings already sit in that period, staff see them first and can cancel them.
// SRRS-13: coordinators only in their buildings.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, requireStaff, requireRoomScope, loadRoom, conflicts, logEvent } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const scope = requireStaff(user);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'delete') {
      const block = (await sr.entities.RoomBlock.filter({ id: String(body.id || '') }, undefined, 1))?.[0];
      if (!block) throw new RuleError('NOT_FOUND', 'Closure not found.', 404);
      requireRoomScope(scope, await loadRoom(sr, block.room_id));
      await sr.entities.RoomBlock.delete(block.id);
      return Response.json({ ok: true });
    }

    const room = await loadRoom(sr, body.roomId);
    requireRoomScope(scope, room);
    const s = Date.parse(body.start);
    const e = Date.parse(body.end);
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) throw new RuleError('VALIDATION', 'The end must be after the start.', 400);
    if (e <= Date.now()) throw new RuleError('VALIDATION', 'That period has already ended.', 400);
    const reason = String(body.reason ?? '').trim().slice(0, 200);
    if (!reason) throw new RuleError('VALIDATION', 'Add a reason so students know why the room is closed.', 400, ['reason']);

    const affected = await conflicts(sr, room.id, s, e);
    if (affected.length && !body.cancelAffected) {
      return Response.json({
        error: {
          code: 'BLOCK_CONFLICT',
          message: `${affected.length} booking${affected.length === 1 ? '' : 's'} already in that period.`,
          details: affected.map((r: any) => ({ id: r.id, name: r.user_name, start: r.starts_at, end: r.ends_at, role: r.booker_role || 'student' })),
        },
      }, { status: 409 });
    }

    for (const r of affected) {
      await sr.entities.Reservation.update(r.id, {
        status: 'cancelled', cancelled_at: new Date().toISOString(),
        cancelled_by_name: user.full_name || user.email, cancel_reason: `Room closed: ${reason}`,
      });
      await logEvent(sr, { reservation: r, room, actor: user, action: 'cancelled', before: { starts_at: r.starts_at, ends_at: r.ends_at }, note: `Room closed: ${reason}` });
    }
    const block = await sr.entities.RoomBlock.create({
      room_id: room.id, starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(),
      reason, created_by_name: user.full_name || user.email,
    });
    return Response.json({ block, cancelled: affected.length }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
