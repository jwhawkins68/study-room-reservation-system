# SRRS API (Node/Express + Supabase)

Serves the endpoints in the API Contract (`docs/project-hub-snapshot.md`). The database does the heavy lifting:
double-booking, booking rules, and who-can-see-what are enforced in Supabase, and this API maps its answers to
clean JSON errors.

## Run it

```bash
cd api
cp .env.example .env      # then paste the secret key (see below)
npm install
npm run dev               # http://localhost:4000/api/health should return {"ok":true}
```

**Secret key:** Supabase dashboard → srrs-study-rooms → Project Settings → API Keys → copy the `service_role` /
secret key into `SUPABASE_SERVICE_ROLE_KEY` in `.env`. It's only used for sign-up and logging rejected bookings.
`.env` is git-ignored; never commit it or put it in the React app.

Then run the React app with `VITE_USE_MOCK=false` in `web/.env.local` and `npm run dev` in `web/`.
Vite forwards `/api` to port 4000, so log in with the real Supabase test accounts.

## Endpoints

| Method | Path | Story |
| --- | --- | --- |
| GET | /api/health | — |
| POST | /api/auth/signup | SRRS-1 |
| GET | /api/me | SRRS-2, SRRS-3 |
| GET | /api/amenities | SRRS-4 |
| GET | /api/rooms?minCapacity=&amenityIds=&start=&end= | SRRS-4, SRRS-9 |
| GET | /api/rooms/:id?from=&to= | SRRS-5 |
| POST | /api/reservations | SRRS-6 |
| GET | /api/me/reservations?scope=upcoming\|past | SRRS-7 |
| POST | /api/reservations/:id/cancel | SRRS-8 |

Every request except sign-up needs `Authorization: Bearer <Supabase access token>`; the React app adds it.
Queries run *as the signed-in user*, so Supabase's row-level security decides what each person can see and change.

## How it's organized

| File | What it does |
| --- | --- |
| `src/index.js` | Loads `.env` and starts the server |
| `src/app.js` | Routes and middleware |
| `src/auth.js` | Checks the token, loads the user's profile and role |
| `src/supabase.js` | Supabase clients: as-the-user, and admin (secret key) |
| `src/errors.js` | Turns database errors into API error codes (`ROOM_TAKEN`, `TOO_LONG`, ...) |
| `src/routes/*.js` | One file per area: auth, me, rooms, reservations |

## Postman

Import `SRRS-API.postman_collection.json` into Postman. In the collection's Variables tab, set `password` for the test account and `start`/`end` to a future time, then run **0. Log in** first. It saves your token for every other request. The collection covers every endpoint, plus double-booking, over-capacity, and a no-token security check.

## Tests

`npm test` checks the error mapping. The full flow (sign-up, rooms, booking rules, double-booking, cancel,
staff permissions, and the React app in real mode) was also run against a local copy of the Supabase schema.
