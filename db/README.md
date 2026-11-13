# Database

`schema.sql` is schema v1.1, already applied to the Supabase project **srrs-study-rooms** (us-east-1),
with the 5 sample rooms loaded. Conflict tests and demo data go in this folder too.

`seed-buildings.sql` adds 18 more sample rooms across 7 campus buildings (23 rooms in all, 2–5 per building).
Run it after `schema.sql` in the Supabase SQL editor. It skips rows that already exist, so running it twice is fine.

## Live demo: the database refuses double bookings (SRRS-28)

`demo-double-booking.sql` books Study Room 106 for one user, then tries an overlapping time for a second user
(refused with `23P01 no_double_booking`, which the Express API returns as `409 ROOM_TAKEN`), then a back-to-back
time (allowed). It runs in one transaction and ends with `rollback`, so it is safe to run in front of the class
in the Supabase SQL editor. It needs at least two rows in `profiles` and the seeded rooms.
