-- Study Room Reservation System — Supabase / Postgres schema (v1.1)
-- v1.1: student_id on profiles; booking_attempts log for the admin center
-- Run in the Supabase SQL editor, top to bottom.

create extension if not exists btree_gist with schema extensions;  -- lets the exclusion constraint mix = and &&

-- ─── Types ───────────────────────────────────────────────────────────────
create type user_role as enum ('student', 'staff');
create type reservation_status as enum ('confirmed', 'cancelled');

-- ─── Users (extends Supabase auth.users) ─────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  student_id  text unique,                       -- null for staff accounts
  email       text not null unique,
  role        user_role not null default 'student',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever someone signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, student_id, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'student_id', ''),
          new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Rooms & amenities ───────────────────────────────────────────────────
create table rooms (
  id           bigint generated always as identity primary key,
  name         text not null,
  building     text not null,
  floor        text,
  capacity     int  not null check (capacity > 0),
  description  text,
  is_active    boolean not null default true,   -- staff can take a room offline entirely
  created_at   timestamptz not null default now(),
  unique (building, name)
);

create table amenities (
  id    bigint generated always as identity primary key,
  name  text not null unique                     -- 'Whiteboard', 'TV / HDMI', ...
);

create table room_amenities (
  room_id     bigint references rooms(id)     on delete cascade,
  amenity_id  bigint references amenities(id) on delete cascade,
  primary key (room_id, amenity_id)
);

-- ─── Staff closures / blocked periods ────────────────────────────────────
create table room_blocks (
  id          bigint generated always as identity primary key,
  room_id     bigint not null references rooms(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  constraint block_window check (ends_at > starts_at)
);

-- ─── Reservations ────────────────────────────────────────────────────────
create table reservations (
  id            bigint generated always as identity primary key,
  room_id       bigint not null references rooms(id),
  user_id       uuid   not null references profiles(id),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  party_size    int not null default 1 check (party_size > 0),
  purpose       text,
  status        reservation_status not null default 'confirmed',
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,

  constraint valid_window check (ends_at > starts_at),
  constraint max_length   check (ends_at - starts_at <= interval '3 hours'),  -- team booking rule, adjust

  -- THE core feature: two confirmed bookings for the same room can never overlap.
  -- Enforced by Postgres itself, so it holds even if two requests hit at the same instant.
  -- Cancelled rows are excluded, so cancelling frees the slot automatically.
  -- '[)' means 2:00–3:00 and 3:00–4:00 do NOT conflict.
  constraint no_double_booking exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);

create index reservations_user_idx on reservations (user_id, starts_at);

-- Business rules the constraint can't express on its own
create or replace function check_reservation_rules()
returns trigger language plpgsql set search_path = public as $$
declare r rooms%rowtype;
begin
  if new.status <> 'confirmed' then
    return new;                                   -- cancelling is always allowed
  end if;

  select * into r from rooms where id = new.room_id;

  if not r.is_active then
    raise exception 'ROOM_INACTIVE';
  end if;
  if new.party_size > r.capacity then
    raise exception 'OVER_CAPACITY';
  end if;
  if tg_op = 'INSERT' and new.starts_at < now() then
    raise exception 'IN_PAST';
  end if;
  if exists (
    select 1 from room_blocks b
    where b.room_id = new.room_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'ROOM_BLOCKED';
  end if;

  return new;
end $$;

create trigger reservation_rules
  before insert or update on reservations
  for each row execute function check_reservation_rules();

-- ─── Rejected / duplicate booking attempts (admin center, Story 11) ─────
-- The Node API writes a row here whenever it rejects a booking.
create table booking_attempts (
  id            bigint generated always as identity primary key,
  attempted_at  timestamptz not null default now(),
  user_id       uuid references profiles(id) on delete set null,
  room_id       bigint references rooms(id) on delete set null,
  starts_at     timestamptz,
  ends_at       timestamptz,
  reason_code   text not null      -- ROOM_TAKEN, ROOM_BLOCKED, OVER_CAPACITY, ...
);
create index booking_attempts_time_idx on booking_attempts (attempted_at desc);

-- ─── Availability lookup ─────────────────────────────────────────────────
-- Returns busy intervals for a room WITHOUT revealing who booked them.
-- Front end calls this to grey out taken slots.
create or replace function room_busy_times(p_room_id bigint, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, kind text)
language sql stable security definer set search_path = public as $$
  select starts_at, ends_at, 'reserved' from reservations
   where room_id = p_room_id and status = 'confirmed'
     and starts_at < p_to and ends_at > p_from
  union all
  select starts_at, ends_at, 'blocked' from room_blocks
   where room_id = p_room_id
     and starts_at < p_to and ends_at > p_from
  order by 1;
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'staff');
$$;

alter table profiles       enable row level security;
alter table rooms          enable row level security;
alter table amenities      enable row level security;
alter table room_amenities enable row level security;
alter table room_blocks    enable row level security;
alter table reservations   enable row level security;
alter table booking_attempts enable row level security;

-- Profiles: read your own (staff read all). No client-side updates, so nobody can promote themselves to staff.
create policy profiles_read on profiles for select using (id = auth.uid() or is_staff());

-- Rooms / amenities / blocks: any signed-in user can read; only staff can change
create policy rooms_read      on rooms          for select to authenticated using (true);
create policy rooms_staff     on rooms          for all    using (is_staff()) with check (is_staff());
create policy amenities_read  on amenities      for select to authenticated using (true);
create policy amenities_staff on amenities      for all    using (is_staff()) with check (is_staff());
create policy ra_read         on room_amenities for select to authenticated using (true);
create policy ra_staff        on room_amenities for all    using (is_staff()) with check (is_staff());
create policy blocks_read     on room_blocks    for select to authenticated using (true);
create policy blocks_staff    on room_blocks    for all    using (is_staff()) with check (is_staff());

-- Reservations: students see and manage only their own; staff see and manage all
create policy res_read   on reservations for select using (user_id = auth.uid() or is_staff());
create policy res_insert on reservations for insert with check (user_id = auth.uid());
create policy res_update on reservations for update using (user_id = auth.uid() or is_staff())
                                                    with check (user_id = auth.uid() or is_staff());

-- Booking attempts: staff read only; the API writes them with the service role
create policy attempts_staff on booking_attempts for select using (is_staff());

-- ─── Sample data (fictional rooms for the prototype) ─────────────────────
insert into amenities (name) values
  ('Whiteboard'), ('TV / HDMI'), ('Power outlets'), ('Webcam'), ('Accessible');

insert into rooms (name, building, floor, capacity, description) values
  ('Study Room 101', 'Library', '1', 4,  'Quiet room near the entrance'),
  ('Study Room 102', 'Library', '1', 6,  'Group room with a large table'),
  ('Study Room 201', 'Library', '2', 8,  'Presentation practice room'),
  ('Study Room 202', 'Library', '2', 2,  'Small room for pairs'),
  ('Collab Room A',  'Student Center', '3', 10, 'Large collaboration space');

insert into room_amenities (room_id, amenity_id)
select r.id, a.id from rooms r, amenities a
where (r.name, a.name) in (
  ('Study Room 101', 'Power outlets'),
  ('Study Room 102', 'Whiteboard'), ('Study Room 102', 'Power outlets'),
  ('Study Room 201', 'TV / HDMI'),  ('Study Room 201', 'Whiteboard'), ('Study Room 201', 'Webcam'),
  ('Study Room 202', 'Power outlets'),
  ('Collab Room A',  'TV / HDMI'),  ('Collab Room A',  'Whiteboard'), ('Collab Room A', 'Accessible')
);
