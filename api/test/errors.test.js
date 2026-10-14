import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromDbError } from '../src/errors.js';

// Database errors must come out as the API contract's error codes.
test('double-booking becomes 409 ROOM_TAKEN', () => {
  const e = fromDbError({ code: '23P01', message: 'conflicting key value violates exclusion constraint "no_double_booking"' });
  assert.equal(e.status, 409);
  assert.equal(e.code, 'ROOM_TAKEN');
});

test('booking-rule trigger errors keep their code', () => {
  for (const code of ['ROOM_INACTIVE', 'OVER_CAPACITY', 'IN_PAST', 'ROOM_BLOCKED']) {
    const e = fromDbError({ code: 'P0001', message: code });
    assert.equal(e.status, 400);
    assert.equal(e.code, code);
  }
});

test('check constraints map to TOO_LONG and VALIDATION', () => {
  assert.equal(fromDbError({ code: '23514', message: 'violates check constraint "max_length"' }).code, 'TOO_LONG');
  assert.equal(fromDbError({ code: '23514', message: 'violates check constraint "valid_window"' }).code, 'VALIDATION');
  assert.equal(fromDbError({ code: '22000', message: 'range lower bound must be less than or equal to range upper bound' }).code, 'VALIDATION');
});

test('security-rule refusals become 403, anything else 500', () => {
  assert.equal(fromDbError({ code: '42501', message: 'new row violates row-level security policy' }).status, 403);
  assert.equal(fromDbError({ code: 'XX000', message: 'boom' }).status, 500);
});
