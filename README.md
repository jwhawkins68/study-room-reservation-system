# Study Room Reservation System (SRRS)

Software Engineering (CINS 5318) class project, Prairie View A&M University, Fall 2026.
Students find and reserve study rooms; staff manage rooms and closures.

| Folder | What's in it |
| --- | --- |
| `web/` | React front end (Vite). Runs on sample data today: `cd web && npm install && npm run dev` |
| `api/` | Node/Express API (next up) |
| `db/` | Supabase/Postgres schema; later, conflict tests and demo data |
| `docs/` | Project hub snapshot, plus Stephanie's Sprint 1 HTML prototype in `docs/prototypes/` |

## Stack

React · Node.js/Express · Supabase (Postgres + Auth)

## Working rules

- Branch names start with the Jira key: `SRRS-4-rooms-list`
- Put the Jira key in commit messages too: `SRRS-4 add room filters`
- Never commit a Supabase `service_role` key. The publishable key in `web/.env.example` is safe to share.
