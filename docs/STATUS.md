# SRRS Status

**Last updated:** Oct 14, 2026 (last day of Sprint 1)
**Current branch:** `SRRS-2-login-watermark` (branched from `main` at `d108f48`; committed, published and reviewed in a pull request)

## Finished

| Jira | What | Where |
| --- | --- | --- |
| SRRS-1 | Initial project: React app, schema v1.1, ERD, docs | `main` (`40a30e5`) |
| SRRS-2 | Node/Express API: auth, rooms, reservations, Postman collection | Merged to `main` in PR #1 (`080f890`) |
| — | Root README update (stack, Postman) | `main` (`d108f48`) |

Also done today:

- Local `main` brought up to date with GitHub (fast-forward to `d108f48`). The merged `SRRS-2-node-api` branch was deleted locally.
- Node.js LTS installed on the dev machine. API dependencies installed; `npm audit` on the API found 0 vulnerabilities.
- API checked locally: `GET /api/health` returns `{"ok":true}`, and a request with no token gets `401 UNAUTHENTICATED`.
- React app runs against the real API and Supabase. Student login and the dashboard were checked by hand.

## Ready for review (on `SRRS-2-login-watermark`, not yet merged)

**Login and portal styling**
- Login page: campus photo as a faint watermark on the purple panel, and a purple-to-gold gradient behind the login card. The card has rounded corners, a faint purple outline, and a soft purple shadow. The sign-up page shares this layout.
- Signed-in pages (dashboard, Find a room, room details, staff home): the same faint gradient as the background. Stat tiles, panels, filters, the room list, the open-times box, and the staff table are white with a soft shadow so they stand out.
- Files: `web/src/styles.css`, `web/src/components/Layout.jsx`, `web/src/assets/campus.jpg`, `web/src/assets/login-gradient.jpg`.

**More sample rooms**
- 18 new rooms (23 total) across 8 buildings, 2–5 rooms each: Library, Student Center, New Engineering Building, Collins Engineering, Harrington Science, Architecture, University College, University Village. The rooms are fictional.
- Added to the mock data (`web/src/lib/mock.js`) and a new seed file, `db/seed-buildings.sql`, which is safe to run more than once. Documented in `db/README.md`.

## Problems we hit

| Problem | Cause | Fix |
| --- | --- | --- |
| The copy of the API from the zip turned out to be redundant | The API had already been committed, merged in PR #1, and pulled while we were working | Used the version on `main` and deleted the leftover local branch |
| `node` and `npm` not found | Node.js wasn't installed | Installed Node.js LTS with winget and checked its publisher signature (OpenJS Foundation) |
| The web app had no local env file | It's git-ignored, so a fresh clone doesn't include it | Created it from `web/.env.example` |
| The first request through Vite's `/api` proxy timed out | Vite was still starting up | Retried: later requests answered in 14–80 ms. Nothing to change. |
| The first campus photo looked blurry | It was only 250×180 | Upscaled it, then replaced it with a full-size photo, compressed from 3.5 MB to 384 KB |
| Signed-in pages, they need a logged-in session | Checked them by hand in the browser instead | Review DB Logs

## Next steps (in order)

1.. **MOREPostman (later this week):** import `api/SRRS-API.postman_collection.json`, fill in the test account details locally, and run "0. Log in" first. Don't export the collection back into the repo with credentials in it.
2.. **Sprint 2 (Oct 15–28):** stories 6–10 (book a room, my bookings, cancel, find open rooms by time, change a booking).
3. **Midterm requirements paper:** due Oct 22 at 5 p.m.
4. **Security follow-up:** the web app's `npm audit` reports 2 moderate issues in `react-router` that ship with the app. The fix is an upgrade to react-router 7, a breaking change, so do it on its own branch. The other 5 issues are in dev-only tools.
5. **Open questions from the project hub:** team review of the stories and adding them to Jira, hosting for the app and API, the GitHub for Jira app, how far ahead students can book, and the proposal fixes.

## Notes
