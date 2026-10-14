# Database

`schema.sql` is schema v1.1, already applied to the Supabase project **srrs-study-rooms** (us-east-1),
with the 5 sample rooms loaded. Conflict tests and demo data go in this folder too.

`seed-buildings.sql` adds 18 more sample rooms across 7 campus buildings (23 rooms in all, 2–5 per building).
Run it after `schema.sql` in the Supabase SQL editor. It skips rows that already exist, so running it twice is fine.
