// SRRS-23: remember a user's display settings (larger text, high contrast) on their account,
// so they follow them to any device. Only these two fields can be changed here.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, requireUser } from '../../shared/booking.ts';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  try {
    const user = await requireUser(base44);
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, boolean> = {};
    if (typeof body.largeText === 'boolean') patch.large_text = body.largeText;
    if (typeof body.highContrast === 'boolean') patch.high_contrast = body.highContrast;
    if (Object.keys(patch).length) await base44.asServiceRole.entities.User.update(user.id, patch);
    return Response.json({ largeText: patch.large_text ?? !!user.large_text, highContrast: patch.high_contrast ?? !!user.high_contrast });
  } catch (err) {
    return errorResponse(err);
  }
}
