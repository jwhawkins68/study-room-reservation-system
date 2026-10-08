# Study Room Reservation System, Sprint 1 Front End

This package is a static HTML, CSS, and JavaScript prototype for group review.

## Included pages
- `index.html`: home page
- `browse.html`: room directory and filter UI
- `room-details.html`: room details and sample time selection
- `login.html`: login form
- `register.html`: registration form
- `dashboard.html`: student dashboard preview

## Local review
1. Unzip the folder.
2. Open the folder in Visual Studio Code.
3. Install the Live Server extension by Ritwick Dey, if allowed by your course environment.
4. Right-click `index.html` and choose **Open with Live Server**.
5. If extensions are not allowed, open `index.html` directly in a browser. Navigation works without a server.

## Team review workflow
1. Create a GitHub repository for the team project.
2. Add these files to a `frontend` folder or the repository root.
3. Protect the `main` branch and make each update through a separate branch and pull request.
4. Ask reviewers to test desktop and mobile widths and comment on the pull request.
5. Track requested changes as issues, one issue per change.

Suggested branch names:
- `feature/home-page`
- `feature/room-search`
- `feature/account-access`
- `fix/mobile-navigation`

## Backend handoff points
- Replace sample room cards with records returned by the room query.
- Submit login and registration forms to the approved authentication layer.
- Populate dashboard reservations from the authenticated user record.
- Re-check room availability on the server before completing a reservation.
- Never store plaintext passwords.

## Branding and content notes
- Project palette uses purple `#582c83`, gold `#eaaa00`, gray `#808285`, white, and black supplied by the project team.
- All images and room details are placeholders. Use only approved PVAMU assets and verified room data.
- The header states this is a class prototype to avoid presenting it as an official live service.
