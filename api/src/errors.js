// Every error leaves the API as { error: { code, message, details? } } (see API Contract).
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const RULE_MESSAGES = {
  ROOM_INACTIVE: [400, 'That room is closed.'],
  OVER_CAPACITY: [400, 'Your group is bigger than the room’s capacity.'],
  IN_PAST: [400, 'That time has already passed.'],
  ROOM_BLOCKED: [400, 'Staff closed the room for part of that time.'],
};

// Turns a Supabase/Postgres error into the API's error codes.
export function fromDbError(err) {
  if (!err) return new ApiError(500, 'SERVER_ERROR', 'Something went wrong.');
  const msg = err.message || '';
  if (err.code === '23P01') {
    return new ApiError(409, 'ROOM_TAKEN', 'That room is already booked for part of that time.');
  }
  if (err.code === 'P0001' && RULE_MESSAGES[msg]) {
    const [status, text] = RULE_MESSAGES[msg];
    return new ApiError(status, msg, text);
  }
  if (err.code === '23514') {
    if (msg.includes('max_length')) return new ApiError(400, 'TOO_LONG', 'Bookings can be up to 3 hours.');
    if (msg.includes('valid_window')) return new ApiError(400, 'VALIDATION', 'The end time must be after the start time.');
    return new ApiError(400, 'VALIDATION', 'That request breaks a booking rule.');
  }
  if (err.code === '22000' && msg.includes('range lower bound')) {
    return new ApiError(400, 'VALIDATION', 'The end time must be after the start time.');
  }
  if (err.code === '42501' || msg.includes('row-level security')) {
    return new ApiError(403, 'FORBIDDEN', 'You’re not allowed to do that.');
  }
  return new ApiError(500, 'SERVER_ERROR', 'Something went wrong. Try again.');
}

export function errorHandler(err, req, res, _next) {
  const e = err instanceof ApiError ? err : fromDbError(err);
  if (e.status >= 500) console.error(req.method, req.originalUrl, err);
  res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } });
}

// Lets async route handlers throw instead of calling next(err).
export const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
