// SRRS-17: put a booking on the user's calendar. Nothing is sent anywhere until the user clicks.
const APP_URL = 'https://study-room-reservation-system-5f98d0e0.base44.app';

const title = (b) => `Study room: ${b.roomName || 'Room'}`;
const where = (b) => [b.roomName, b.building, 'Prairie View A&M University'].filter(Boolean).join(', ');
const notes = (b) =>
  [b.purpose && `Purpose: ${b.purpose}`, b.partySize && `Group of ${b.partySize}`, `Manage this booking: ${APP_URL}/student`]
    .filter(Boolean)
    .join('\n');

// Outlook on the web (Microsoft 365, which PVAMU uses): opens a prefilled new event.
export function outlookUrl(b) {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title(b),
    startdt: new Date(b.start).toISOString(),
    enddt: new Date(b.end).toISOString(),
    location: where(b),
    body: notes(b),
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${p.toString()}`;
}

// .ics times in UTC ("Z"), so every calendar shows them in the viewer's own time zone.
const icsTime = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function icsContent(b) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PVAMU CINS 5318 Group 1//Study Room Reservation System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:srrs-${b.id || Date.parse(b.start)}@study-room-reservation-system`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(b.start)}`,
    `DTEND:${icsTime(b.end)}`,
    `SUMMARY:${icsText(title(b))}`,
    `LOCATION:${icsText(where(b))}`,
    `DESCRIPTION:${icsText(notes(b))}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Study room booking in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(b) {
  const blob = new Blob([icsContent(b)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(b.roomName || 'study-room').replace(/[^A-Za-z0-9]+/g, '-')}-${new Date(b.start).toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
