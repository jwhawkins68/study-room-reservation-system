-- SRRS-28: live demo for the final presentation. Run in the Supabase SQL editor (or psql).
-- Shows the database refusing a double booking. Everything is rolled back at the end,
-- so it leaves no data behind. Uses the first two profiles and "Study Room 106".
begin;

create temp table demo_ids as
select (select id from profiles order by created_at limit 1)          as alex,
       (select id from profiles order by created_at offset 1 limit 1) as jordan,
       (select id from rooms where name = 'Study Room 106' limit 1)    as room;

-- 1. Alex books 2:00-4:00 PM next Monday: confirmed
insert into reservations (room_id, user_id, starts_at, ends_at, party_size)
select room, alex, date_trunc('week', now()) + interval '7 days 20 hours',
                   date_trunc('week', now()) + interval '7 days 22 hours', 4 from demo_ids
returning id, status;

-- 2. Jordan tries 3:00-5:00 PM in the same room: refused by the exclusion constraint
do $$ begin
  insert into reservations (room_id, user_id, starts_at, ends_at, party_size)
  select room, jordan, date_trunc('week', now()) + interval '7 days 21 hours',
                       date_trunc('week', now()) + interval '7 days 23 hours', 3 from demo_ids;
exception when exclusion_violation then
  raise notice 'Refused: % (%)', sqlerrm, sqlstate;   -- 23P01, mapped to 409 ROOM_TAKEN by the API
end $$;

-- 3. Jordan picks 4:00-5:00 PM instead: back-to-back is fine
insert into reservations (room_id, user_id, starts_at, ends_at, party_size)
select room, jordan, date_trunc('week', now()) + interval '7 days 22 hours',
                     date_trunc('week', now()) + interval '7 days 23 hours', 3 from demo_ids
returning id, status;

rollback;  -- nothing is kept
