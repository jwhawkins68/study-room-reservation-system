// SRRS-22: keep the AI daily brief honest. The model may only name rooms that exist and that appear
// in the facts it was given; if it names any other room, we show a plain summary built from the facts.

const ROOM_WORDS = '(?:Room|Lounge|Studio|Lab|Suite|Hall)';
// "Study Room 105", "Collab Room B", "Media Room", "Study Lounge A", "Studio Room 140"
const ROOM_RE = new RegExp(`\\b(?:[A-Z][A-Za-z]*\\s+){0,2}${ROOM_WORDS}(?:\\s+[A-Z0-9][A-Za-z0-9]{0,3})?\\b`, 'g');

export function roomMentions(text: string): string[] {
  return [...String(text || '').matchAll(ROOM_RE)].map((m) => m[0].trim());
}

// True when every room-like phrase in the text is (part of) one of the allowed room names.
export function onlyKnownRooms(text: string, allowed: string[]): boolean {
  const names = allowed.map((n) => n.toLowerCase());
  return roomMentions(text).every((m) => {
    const t = m.toLowerCase();
    // exact, a shortened form ("Room 105"), or with a capitalised word in front ("Busiest Study Room 105")
    return names.some((n) => n === t || n.endsWith(' ' + t) || t.endsWith(' ' + n));
  });
}

export function factsBrief(f: any): string {
  const parts: string[] = [];
  parts.push(f.bookingsToday
    ? `${f.bookingsToday} booking${f.bookingsToday === 1 ? '' : 's'} today, ${f.roomsInUseNow} room${f.roomsInUseNow === 1 ? '' : 's'} in use right now.`
    : 'No bookings yet today, so every room is open.');
  if (f.closuresToday) parts.push(`${f.closuresToday} closure${f.closuresToday === 1 ? '' : 's'} scheduled today.`);
  if (f.rejectedYesterday) parts.push(`${f.rejectedYesterday} booking attempt${f.rejectedYesterday === 1 ? ' was' : 's were'} turned away yesterday.`);
  if (f.mostUsedRoom) parts.push(`Most used lately: ${f.mostUsedRoom}.`);
  if (f.peakStartTime) parts.push(`Busiest start time: ${f.peakStartTime}.`);
  return parts.join(' ');
}

// The rooms the brief may name: the ones in its facts.
export function roomsInFacts(f: any): string[] {
  const strip = (s: string) => String(s || '').replace(/\s*\(.*\)\s*$/, '');
  return [...(f.busiestRoomsToday || []), f.mostUsedRoom, ...(f.leastUsedRooms || [])].filter(Boolean).map(strip);
}

export function checkedBrief(aiText: string, facts: any): { text: string; source: 'ai' | 'facts' } {
  const t = String(aiText || '').trim();
  if (t && onlyKnownRooms(t, roomsInFacts(facts))) return { text: t, source: 'ai' };
  return { text: factsBrief(facts), source: 'facts' };
}
