// SRRS-27: narration of the welcome video, for people who prefer to read it.
export const HELP_TRANSCRIPT = [
  "Welcome to the Study Room Reservation System for Prairie View A&M. In the next few minutes, we'll show you how to find and book a study room, how to manage your bookings, and how staff keep rooms running. Then we'll show how our team built it.",
  "To get started, choose Create account. Enter your name, your student ID, and your email, and pick a password. We email you a six-digit code to confirm it's you. After that, you just log in with your email and password.",
  "Choose Find a room. Filter by group size, by features like a whiteboard or a screen, and by the time you need. You'll only see rooms that are open and big enough for your group.",
  "Open a room to see its whole day at a glance. Open half-hours are green. Booked and closed times are marked, so you never pick a time that's already taken.",
  "Pick a start time and how long you need, up to three hours. Add your group size, and choose Reserve. Your booking is confirmed right away, and you can add it to Outlook or any calendar with one click.",
  "Your bookings live on your dashboard. You can change the time or cancel. When you cancel, the room opens up for other students right away.",
  "If staff ever need your room, you're not left stranded. You get an email and a notice here, with another room or time the system has already found for you. Choose Move me, and you're rebooked.",
  "Need help? The assistant button is on every page. Ask in plain words, like: find me a room for four people tomorrow at two. It answers using live availability.",
  "At the top of every page, you can turn on larger text or high contrast. Your choice is saved to your account.",
  "Staff sign in to the admin center. A short daily brief sums up the day: how busy rooms are, what was turned away, and what needs attention. Below it, staff see every booking, each room's status, and booking attempts the system refused.",
  "To close a room for an event or repairs, staff block the time. Anyone booked in that window is notified and offered another room automatically.",
  "Analytics shows usage by day, by hour, and by room. Every chart has a table view, so it works with screen readers too.",
  "Here's how we got here. In Sprint 1, our team built a React front end on sample data, a Supabase Postgres database, and a Node and Express API.",
  "The most important rule, no double bookings, is enforced by the database itself. Alex books Study Room 106 from two to four. When Jordan tries three to five, Postgres refuses it. Four to five is fine, because back-to-back bookings don't overlap. The three-hour limit and room capacity are checked the same way.",
  "The Express API turns those database errors into clear answers. A conflict becomes a 409 error with the code ROOM_TAKEN, which the app shows in plain words.",
  "In Sprint 2, we moved to Base44 to put a live, public app in front of users, carrying the same rules over and testing them automatically on every pull request. Over the following sprints we added staff tools, calendar export, the AI assistant, and the rebooking and accessibility features you just saw.",
  "That's the Study Room Reservation System. Try it at the address on screen. Thanks for watching."
];
