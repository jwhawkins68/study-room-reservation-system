import { Link } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext';
import { HELP_VIDEO_URL, HELP_CAPTIONS_URL, HELP_POSTER_URL } from '../lib/media';
import { HELP_TRANSCRIPT } from '../lib/transcript';

const STUDENT_STEPS = [
  ['Create your account', 'Choose Create account, enter your name, student ID, email and a password, then type the 6-digit code we email you.'],
  ['Find a room', 'Open Find a room. Filter by group size and features (whiteboard, TV, webcam, accessible), or pick a day and time to see only rooms that are open then.'],
  ['Check open times', 'Open a room to see its day: open, reserved, and closed-by-staff times. You never see who booked.'],
  ['Book it', 'Pick a start time, how long (up to 3 hours) and your group size, then press Reserve. The system checks every rule before it confirms.'],
  ['Add it to Outlook', 'Press Add to Outlook on the confirmation or in My bookings to put it on your calendar.'],
  ['Change or cancel', 'In My bookings, use Change time or Cancel. Cancelling frees the room for others right away.'],
  ['Ask the assistant', 'Press Ask the assistant (bottom right of every page) and type what you need, like “a room for 6 with a whiteboard tomorrow at 2.” Nothing is booked until you press Book it.'],
  ['Watch for Updates', 'If staff cancel your booking or close the room, you get an email and an Updates card on your dashboard, usually with a ready-made offer of the closest open room: press Move me.'],
];
const STAFF_STEPS = [
  ['Admin center', 'See today’s AI brief, every room’s status at any time, all bookings, and refused attempts. Cancel a booking with a reason the student sees.'],
  ['Rooms', 'Add, edit, close or reopen rooms. Open a room’s schedule to block off time; if bookings are in the way, you see them first, and those students are offered another room automatically.'],
  ['Analytics', 'Bookings per day, busiest times and buildings, how much each room is used, and why bookings were refused.'],
  ['Coordinators', 'System admins choose which buildings each room coordinator manages.'],
];

export default function Help() {
  const { user } = useAuth();
  return (
    <>
      <h1>How to use Study Room Reservations</h1>
      <p className="lead">A short welcome video, then the steps in writing. Use <strong>Larger text</strong> or <strong>High contrast</strong> at the top of any page if that is easier to read.</p>

      <section className="panel help-video" aria-labelledby="video-heading">
        <h2 id="video-heading">Welcome video</h2>
        {HELP_VIDEO_URL ? (
          <video controls preload="metadata" poster={HELP_POSTER_URL || undefined} className="video">
            <source src={HELP_VIDEO_URL} type="video/mp4" />
            {HELP_CAPTIONS_URL && <track kind="captions" src={HELP_CAPTIONS_URL} srcLang="en" label="English" default />}
            Your browser can’t play this video. The steps below cover the same things.
          </video>
        ) : (
          <p className="muted">The video is being produced. The steps below cover the same things.</p>
        )}
        <p className="muted small">Captions are on by default. The narration is a computer voice.</p>
        <details className="transcript">
          <summary>Read the narration</summary>
          {HELP_TRANSCRIPT.map((t, i) => <p key={i}>{t}</p>)}
        </details>
      </section>

      <section className="panel" aria-labelledby="student-steps">
        <h2 id="student-steps">For students</h2>
        <ol className="steps">{STUDENT_STEPS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ol>
      </section>
      <section className="panel" aria-labelledby="staff-steps">
        <h2 id="staff-steps">For staff</h2>
        <ol className="steps">{STAFF_STEPS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ol>
      </section>
      <p>{user ? <Link to={homeFor(user)} className="btn btn--primary">Back to my dashboard</Link> : <Link to="/signup" className="btn btn--primary">Create an account</Link>}</p>
    </>
  );
}
