// SRRS-13: a system admin makes a staff member a room coordinator for one or more buildings
// (a building can have several coordinators), or sets them back to system admin.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser, requireStaff, isStaff } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const scope = requireStaff(user);
    if (!scope.all) throw new RuleError('FORBIDDEN', 'Only system admins can assign coordinators.', 403);
    const body = await req.json().catch(() => ({}));
    const [users, rooms] = await Promise.all([sr.entities.User.list(undefined, 5000), sr.entities.Room.list(undefined, 5000)]);
    const buildings = [...new Set(rooms.map((r: any) => r.building))].sort();

    if (body.action === 'update') {
      const target = users.find((u: any) => u.id === body.userId);
      if (!target || !isStaff(target)) throw new RuleError('NOT_FOUND', 'Staff member not found.', 404);
      const staffRole = body.staffRole === 'coordinator' ? 'coordinator' : 'system_admin';
      if (target.id === user.id && staffRole !== 'system_admin') {
        throw new RuleError('VALIDATION', 'You can’t remove your own system admin access.', 400);
      }
      const picked = Array.isArray(body.buildings) ? body.buildings.filter((b: any) => buildings.includes(b)) : [];
      if (staffRole === 'coordinator' && !picked.length) throw new RuleError('VALIDATION', 'Pick at least one building for a coordinator.', 400);
      await sr.entities.User.update(target.id, { staff_role: staffRole, buildings: staffRole === 'coordinator' ? picked : [] });
    }

    const staff = users
      .filter((u: any) => isStaff(u))
      .map((u: any) => ({
        id: u.id, name: u.full_name || u.email, email: u.email,
        staffRole: (body.action === 'update' && u.id === body.userId)
          ? (body.staffRole === 'coordinator' ? 'coordinator' : 'system_admin')
          : (u.staff_role || 'system_admin'),
        buildings: (body.action === 'update' && u.id === body.userId) ? (body.staffRole === 'coordinator' ? body.buildings : []) : (u.buildings || []),
        isMe: u.id === user.id,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    return Response.json({ staff, buildings });
  } catch (err) {
    return errorResponse(err);
  }
}
