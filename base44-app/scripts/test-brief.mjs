// SRRS-22: the AI daily brief may only name rooms from its facts. Run after bundling base44/shared/brief.ts
// to /tmp/brief.mjs (see .github/workflows/ci.yml).
import { onlyKnownRooms, checkedBrief, roomsInFacts } from '/tmp/brief.mjs';

const facts = {
  bookingsToday: 0, roomsInUseNow: 0, closuresToday: 0, rejectedYesterday: 0,
  busiestRoomsToday: [], mostUsedRoom: 'Review Room 250 (Architecture)', peakStartTime: '2 PM',
  leastUsedRooms: ['Study Room 105', 'Collab Room B', 'Study Lounge A'],
};
const allowed = roomsInFacts(facts);
let fails = 0;
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails += 1; };

t('rooms in the facts are allowed', onlyKnownRooms('Review Room 250 was busiest; Study Room 105 and Collab Room B sat empty.', allowed));
t('a shortened name is allowed', onlyKnownRooms('Room 105 was quiet.', allowed));
t('a room name that is not in the facts is caught', !onlyKnownRooms(
  'Please focus on promoting the underused areas, such as Study Room 105, the Seminar Room, and Study Room 9Z.', allowed));
t('a real room that is not in the facts is caught', !onlyKnownRooms('Study Room 230 is popular.', allowed));
t('no room names at all is fine', onlyKnownRooms('No bookings yet today. Peak is 2 PM.', allowed));
t('"Rooms in use" is not read as a room name', onlyKnownRooms('Rooms in use: 0.', allowed));

const bad = checkedBrief('Promote the Seminar Room this week.', facts);
t('text naming an unlisted room falls back to the facts', bad.source === 'facts' && bad.text.includes('No bookings yet today') && !bad.text.includes('Seminar'));
const good = checkedBrief('Quiet morning; Review Room 250 has been the most used.', facts);
t('good AI text is kept', good.source === 'ai');

console.log(fails ? `${fails} failed` : 'all 8 passed');
process.exit(fails ? 1 : 0);
