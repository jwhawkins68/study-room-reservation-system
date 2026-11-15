// SRRS-31: the Add to Outlook link and .ics file (src/lib/calendar.js). Plain Node, no build step.
import { outlookUrl, outlookBody, icsContent } from '../src/lib/calendar.js';

let fails = 0;
const t = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails += 1; };
const b = { id: 'r1', roomName: 'Review Room 250', building: 'Architecture', start: '2026-11-18T20:00:00.000Z',
  end: '2026-11-18T22:00:00.000Z', purpose: 'Q&A <prep>', partySize: 4 };

const u = new URL(outlookUrl(b));
t('opens Outlook on the web (Microsoft 365)', u.hostname === 'outlook.office.com');
t('title names the room', u.searchParams.get('subject') === 'Study room: Review Room 250');
t('start and end are the booking times', u.searchParams.get('startdt') === b.start && u.searchParams.get('enddt') === b.end);
t('location has room, building and campus', u.searchParams.get('location') === 'Review Room 250, Architecture, Prairie View A&M University');
const body = u.searchParams.get('body');
t('notes use <br> for new lines (Outlook collapses \\n)', body.split('<br>').length === 3 && !body.includes('\n'));
t('the purpose is HTML-escaped', body.startsWith('Purpose: Q&amp;A &lt;prep&gt;') && outlookBody(b) === body);
t('notes link back to the app', body.endsWith('/student'));

const ics = icsContent(b);
t('.ics has one event with UTC times', ics.includes('DTSTART:20261118T200000Z') && ics.includes('DTEND:20261118T220000Z'));
t('.ics escapes commas in the location', ics.includes('LOCATION:Review Room 250\\, Architecture\\, Prairie View A&M University'));
t('.ics has a 30-minute reminder', ics.includes('TRIGGER:-PT30M'));
t('.ics uses CRLF line endings', ics.split('\r\n').length > 10);

if (fails) { console.error(`${fails} failed`); process.exit(1); }
console.log('All calendar checks passed.');
