import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AssistantChat } from '../pages/Assistant';

// SRRS-21: "Ask the assistant" on every signed-in page. It knows which page you are on,
// so "is this room free tomorrow at 3?" works on a room's page.
export default function AssistantLauncher() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState('');
  const btn = useRef(null);
  const panel = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    panel.current?.querySelector('input')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (pathname.endsWith('/assistant')) return null;

  function toggle() {
    if (!open) {
      const h1 = document.querySelector('main h1')?.textContent?.trim();
      const sub = document.querySelector('main .room-meta, main h1 + p')?.textContent?.trim();
      setContext(h1 ? `Viewing "${h1}"${sub ? ` (${sub.slice(0, 50)})` : ''}` : '');
    }
    setOpen(!open);
  }

  return (
    <>
      {open && (
        <div className="ai-float" ref={panel} role="dialog" aria-modal="false" aria-labelledby="ai-float-title">
          <div className="ai-float-head">
            <h2 id="ai-float-title">Booking assistant</h2>
            <button type="button" className="link-btn" onClick={() => { setOpen(false); btn.current?.focus(); }}>Close</button>
          </div>
          <AssistantChat compact context={context} />
        </div>
      )}
      <button ref={btn} type="button" className="ai-fab" aria-expanded={open} onClick={toggle}>
        <span aria-hidden="true">✦</span> {open ? 'Hide assistant' : 'Ask the assistant'}
      </button>
    </>
  );
}
