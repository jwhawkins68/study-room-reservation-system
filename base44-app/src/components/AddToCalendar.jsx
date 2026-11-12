import { useState } from 'react';
import { outlookUrl, downloadIcs } from '../lib/calendar';

// SRRS-17: "Add to Outlook" for a booking. Outlook on the web, or a .ics file for any calendar app.
export default function AddToCalendar({ booking, compact = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`cal-menu${compact ? ' cal-menu--compact' : ''}`}>
      <button type="button" className="btn btn--quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        Add to Outlook
      </button>
      {open && (
        <div className="cal-options" role="group" aria-label="Add to calendar">
          <a className="cal-option" href={outlookUrl(booking)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Outlook on the web <span className="muted">(PVAMU Microsoft 365)</span>
          </a>
          <button type="button" className="cal-option" onClick={() => { downloadIcs(booking); setOpen(false); }}>
            Download .ics <span className="muted">(Outlook desktop, Apple, Google)</span>
          </button>
        </div>
      )}
    </div>
  );
}
