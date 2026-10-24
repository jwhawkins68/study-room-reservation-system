# SRRS on Base44 (Sprints 1–3)

A second version of the Study Room Reservation System that runs on [Base44](https://base44.com) instead of Supabase + Express.
It covers Jira stories **SRRS-1 to SRRS-16** (Sprints 1–3) and reuses the React pages from `web/`, so it looks and behaves the same.

- **Live app:** https://study-room-reservation-system-5f98d0e0.base44.app
- **Base44 editor:** https://app.base44.com/apps/6adc01e69e59ba9d5f98d0e0/editor/preview (owner access)

This folder is a snapshot of the Base44 app's source. Base44 runs the app from its own copy;
changes made here don't reach Base44 by themselves (see "Keeping it in sync").

## What's different from `web/` + `api/`

| Topic | Supabase version | Base44 version |
| --- | --- | --- |
| Database | Postgres tables in `db/schema.sql` | Entities in `base44/entities/*.jsonc` |
| API | Express routes in `api/src/routes` | Backend functions in `base44/functions/*/entry.ts` |
| Booking rules | Exclusion constraint + trigger in Postgres | `base44/shared/booking.ts`, called by every booking function |
| Who can see what | Row-level security policies | Entity `rls` rules; students can only read their own reservations, and nobody writes them directly |
| Roles | `profiles.role` = student / staff | Base44 user role: `user` = student, `admin` = staff |
| Sign-up | Name, student ID, email, password | Same, plus a 6-digit email code from Base44 |

The pages in `src/pages` are the team's pages from `web/src/pages`. Only `src/lib/api.js` and `src/auth/AuthContext.jsx`
were rewritten to talk to Base44, with the same function names and data shapes.

## Stories

| Story | Where |
| --- | --- |
| SRRS-1 Create an account | `pages/Signup.jsx` (with code step), `pages/CompleteProfile.jsx`, functions `check-student-id`, `complete-profile` |
| SRRS-2 Log in | `pages/Login.jsx`, `auth/AuthContext.jsx` |
| SRRS-3 Staff portal | `pages/StaffHome.jsx`; room schedule shows who booked (`room-schedule` returns names to staff only) |
| SRRS-4 Browse rooms | `pages/Rooms.jsx` |
| SRRS-5 See open times | `pages/RoomDetail.jsx`, function `room-schedule` |
| SRRS-6 Book a room | `pages/RoomDetail.jsx`, function `book-room` |
| SRRS-7 My bookings | `pages/Dashboard.jsx` (Upcoming / Past and cancelled) |
| SRRS-8 Cancel | `pages/Dashboard.jsx`, function `cancel-booking` |
| SRRS-9 Find rooms open at a time | "Open at" filter in `pages/Rooms.jsx`, function `rooms-open-at` |
| SRRS-10 Change a booking's time | "Change time" in `pages/Dashboard.jsx`, function `change-booking` |
| SRRS-11 Admin center | `pages/AdminCenter.jsx` (room status at any time, all bookings, cancel with a reason, rejected attempts), function `admin-overview` |
| SRRS-12 Close rooms, block times | `pages/ManageRooms.jsx` (add, edit, close, reopen), block panel in `pages/RoomDetail.jsx`, functions `manage-room`, `manage-block` |
| SRRS-13 Room coordinators | `pages/ManageStaff.jsx`, function `manage-staff`; scope checks `staffScope` / `requireRoomScope` in `shared/booking.ts` |
| SRRS-14 Booking audit log | `BookingEvent` entity, `logEvent` in `shared/booking.ts`, `pages/AuditLog.jsx`, function `audit-log` |
| SRRS-15 Staff book rooms | `/staff/book` and `/staff/bookings` reuse `Rooms`, `RoomDetail` and `Dashboard`; `book-room` accepts staff |
| SRRS-16 Who booked each slot | "Who booked this day" table with Student/Staff badge and details in `pages/RoomDetail.jsx`; `room-schedule` returns these fields to staff only |

## Booking rules

Same rules as the database version, checked in this order: room is open, group fits, start isn't in the past,
no staff closure overlaps, no confirmed booking overlaps (2:00–3:00 and 3:00–4:00 don't conflict), at most 3 hours.
Rejections are logged to `BookingAttempt` for the admin center (SRRS-11). Every booking, time change and cancellation is logged to `BookingEvent` (SRRS-14).

Base44 has no database transactions, so two requests could pass the check at the same moment.
After writing, each function checks again and undoes its own write if anything now overlaps,
so a double booking can never stand (in a true tie, both people are told to pick another time).

Run the rule and staff-scope tests (20 cases, no Base44 account needed):

```bash
cd base44-app
npx esbuild base44/shared/booking.ts --format=esm --outfile=/tmp/booking.mjs
node scripts/test-booking-rules.mjs
```

## Accounts

- Students sign up on the app with any email they can read (the code is emailed).
- Staff are Base44 users with the **admin** role. Invite a teammate as admin from the Base44 dashboard.
- A staff member is a **system admin** (all buildings) unless a system admin makes them a **room coordinator** on the Coordinators page; coordinators only manage rooms and bookings in their buildings (other buildings return 403).
- The app owner's own account is an admin, so it opens the staff portal; use a different email to test as a student.

## Keeping it in sync

Base44 deploys from its own sandbox. To move a change from this folder into Base44, copy the file into the app
through the Base44 editor (or ask Claude to write it there), then publish. Data (the 23 rooms) lives in Base44, not in this folder;
the room list matches `db/seed-buildings.sql`.
