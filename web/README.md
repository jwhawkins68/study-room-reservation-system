# SRRS Web (React front end)

Front end for the Study Room Reservation System. Covers the Sprint 1 stories:
sign-up (1), student login (2), staff portal login (3), browse rooms (4), and see when a room is open (5).

## Run it (no backend needed)

```bash
npm install
# .env.local is already filled in with the Supabase project; leave VITE_USE_MOCK=true
npm run dev                  # http://localhost:5173
```

Sample accounts (mock mode): `student@test.edu` or `staff@test.edu`, password `password123`.

## Clickable preview

`npm run build:preview` makes one self-contained HTML file on sample data (`dist-preview/index.html`) that anyone can open in a browser.

## Connect to the real stack

1. The schema and sample rooms are already loaded in the Supabase project (srrs-study-rooms).
2. In `.env.local`, set `VITE_USE_MOCK=false` (the Supabase URL and key are already filled in).
3. Start the Node/Express API on port 4000. Vite forwards `/api` to it (see `vite.config.js`).

Every call goes through `src/lib/api.js`, one function per endpoint in the API Contract.
Mock data in `src/lib/mock.js` returns the exact same shapes, so screens don't change when you switch.

## Where things are

| Path | What it does | Story |
| --- | --- | --- |
| `src/pages/Home.jsx` | Public home page with the 3-step journey | — |
| `src/pages/Signup.jsx` | Sign-up with name, student ID, email, password + confirm | 1 |
| `src/pages/Login.jsx` | Login, then sends you to the right portal | 2, 3 |
| `src/auth/AuthContext.jsx` | Login state; Supabase login + `GET /me` for the role | 2, 3 |
| `src/auth/RequireRole.jsx` | Keeps students out of staff pages and vice versa | 3 |
| `src/pages/Dashboard.jsx` | Student landing page: upcoming bookings, stats, cancel | 7, 8 |
| `src/pages/Rooms.jsx` | Room list with search, group-size, and feature filters | 4 |
| `src/pages/RoomDetail.jsx` | Room details, day view of open times, and the booking panel | 5, 6 |
| `src/components/DayStrip.jsx` | Half-hour time strip, 8 a.m. to 10 p.m. | 5 |
| `src/pages/StaffHome.jsx` | Staff portal home (rooms table) | 3 |

Booking, "my bookings," and cancel work on sample data now (`src/lib/mock.js`) and call the same
API functions the real backend will serve.

## Credits

The home page, student dashboard, room search, time-slot buttons, password confirmation, and
prototype notices are adapted from Stephanie's Sprint 1 HTML prototype (`docs/prototypes/steph-sprint1/`).

## Branch names

Start each branch with its Jira key so commits show up on the ticket, e.g. `SRRS-4-rooms-list`.
