// SRRS-1: save the student's full name and student ID after sign-up. Student IDs are unique.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { RuleError, errorResponse, requireUser } from '../../shared/booking.ts';

export const normalizeId = (v: unknown) => String(v ?? '').trim().toUpperCase();
const ID_RE = /^[A-Z0-9-]{4,20}$/;

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const user = await requireUser(base44);
    const body = await req.json().catch(() => ({}));
    const fullName = String(body.fullName ?? '').trim().slice(0, 120);
    const studentId = normalizeId(body.studentId);
    const bad: string[] = [];
    if (!fullName) bad.push('fullName');
    if (!ID_RE.test(studentId)) bad.push('studentId');
    if (bad.length) throw new RuleError('VALIDATION', 'Enter your full name and a student ID like P00123456.', 400, bad);

    const taken = await sr.entities.User.filter({ student_id: studentId }, undefined, 5);
    if (taken.some((u: any) => u.id !== user.id)) {
      throw new RuleError('STUDENT_ID_TAKEN', 'That student ID already has an account.', 409);
    }
    await sr.entities.User.update(user.id, { full_name: fullName, student_id: studentId });
    return Response.json({ ok: true, fullName, studentId });
  } catch (err) {
    return errorResponse(err);
  }
}
