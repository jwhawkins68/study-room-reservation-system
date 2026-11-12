// SRRS-1: before sign-up, check that a student ID isn't already used (so we can say so before sending a code).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = String(body.studentId ?? '').trim().toUpperCase();
    if (!studentId) return Response.json({ available: false });
    const rows = await base44.asServiceRole.entities.User.filter({ student_id: studentId }, undefined, 1);
    return Response.json({ available: rows.length === 0 });
  } catch (err) {
    return errorResponse(err);
  }
}
