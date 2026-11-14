STUDY ROOM RESERVATION SYSTEM (SRRS)
CINS 5318-P01 Software Engineering, Fall 2026, Prairie View A&M University
Instructor: Dr. Mary Kim
Group 1: James Hawkins, David Brown, Isiaka Jimoh, Hemnarayan Sah, Stephanie Redd,
         London Thompson, Ryan Tucker, Teyana Williams

WHAT IT IS
----------
A web application where students find a study room that fits their group, see when it
is open, and book, change or cancel it, and where staff manage rooms, closures and all
bookings. It also has an AI booking assistant, automatic notices and AI rebooking offers
when staff cancel a booking, usage analytics with an AI daily brief, Outlook export, and
larger-text and high-contrast modes for users with low vision.

  Live application:  https://study-room-reservation-system-5f98d0e0.base44.app
  How to use page:   https://study-room-reservation-system-5f98d0e0.base44.app/help
  Source code:       https://github.com/jwhawkins68/study-room-reservation-system
  Jira:              project SRRS on pvamu-heatsafe.atlassian.net (board 2, Sprints 1-5)

The live site is public. Anyone can create a student account (a 6-digit code is emailed).
Staff features need a staff account; ask the team for one.

DELIVERABLES
------------
  SRRS_Final_Technical_Report.pdf   Final technical report (also .docx)
  SRRS_Source_Code.zip              This repository (branch main)
  SRRS_Welcome_Walkthrough.mp4      3:48 narrated, captioned walkthrough of the running app
  readme.txt                        This file

WHAT IS IN THE REPOSITORY
-------------------------
  base44-app/   The live application (React pages + Base44 backend functions). Sprints 2-5.
     src/                     React pages and components
     base44/entities/         Data model (User, Room, Reservation, RoomBlock, BookingAttempt,
                              BookingEvent, Notification, RebookOffer)
     base44/functions/        Backend functions (book-room, cancel-booking, manage-block,
                              assistant, analytics, my-updates, ...)
     base44/shared/           booking.ts (all booking rules), aftercare.ts (notices and
                              rebook offers), brief.ts (checks the AI daily brief)
     scripts/                 Unit tests for the rules, rebook offers and daily brief
  web/          Sprint 1 React front end (Vite). Runs on sample data or against Supabase.
  api/          Sprint 1 Node.js + Express API (9 endpoints) and a Postman collection.
  db/           Sprint 1 Supabase PostgreSQL schema, seed data, and
                demo-double-booking.sql (a safe live demo that rolls back).
  docs/         Design notes and diagrams.
  front-end prototype/   The first clickable prototype of the screens (before Sprint 1 coding).
  .github/workflows/ci.yml   Automated checks on every pull request.

HOW TO RUN
----------
Requirements: Node.js 20 or newer and npm.

1) The live application
   Nothing to install. Open the live URL above.

2) Sprint 1 React front end on sample data (no accounts or database needed)
     cd web
     npm install
     npm run dev            -> open http://localhost:5173
   Sample logins (sample-data mode): student@test.edu or staff@test.edu, password password123

3) Sprint 1 Express API against Supabase
     cd api
     cp .env.example .env   (paste the Supabase secret key; never commit it)
     npm install
     npm run dev            -> http://localhost:4000/api/health returns {"ok":true}
     npm test               -> error-mapping tests
   Then set VITE_USE_MOCK=false in web/.env.local and run the front end as in step 2.

4) Database
   Run db/schema.sql, then db/seed-buildings.sql, in the Supabase SQL editor (or psql).
   db/demo-double-booking.sql shows the database refusing an overlapping booking
   (error 23P01, returned by the API as 409 ROOM_TAKEN). It runs in one transaction and
   rolls back, so it leaves no data behind.

5) Base44 application tests (no Base44 account needed)
     cd base44-app
     npm install
     npm run lint
     npm run build
     npx esbuild base44/shared/booking.ts --format=esm --outfile=/tmp/booking.mjs
     node scripts/test-booking-rules.mjs          (20 tests)
     npx esbuild base44/shared/aftercare.ts --bundle --format=esm --outfile=/tmp/aftercare.mjs
     node scripts/test-aftercare.mjs              (8 tests)
     npx esbuild base44/shared/brief.ts --bundle --format=esm --outfile=/tmp/brief.mjs
     node scripts/test-brief.mjs                  (8 tests)
   GitHub Actions runs all of these on every pull request.

TESTING
-------
Final regression test (Nov 14, 2026): all 23 user stories (SRRS-1 to SRRS-23) pass on the
live application. See Section 10 and Appendix B of the technical report.

NOTE
----
Class prototype only. Not an official PVAMU website or live reservation system.
