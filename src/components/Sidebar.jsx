import { useEffect, useState } from 'react';
import { fetchConnectionStatus } from '../services/api.js';

function connectionCaption(status) {
  if (!status) return 'Checking connections...';
  if (status.ai && status.canvas) return 'AI and Canvas are connected.';
  if (status.ai) return 'AI is connected. Canvas is not connected.';
  if (status.canvas) return 'Canvas is connected. AI is not connected.';
  return 'AI and Canvas are not connected.';
}

export const SECTIONS = [
  { id: 'notes', label: 'Notes', hash: '#/notes' },
  { id: 'ai-tools', label: 'AI Study Tools', hash: '#/ai-tools' },
  { id: 'canvas', label: 'Canvas', hash: '#/canvas' },
];

// AC-1.2 class names, kept alongside .is-active so QA can find them.
// The visual style itself comes from .is-active (Figma values).
const ACTIVE_CLASSES = 'nav-item is-active bg-blue-50 text-blue-600 font-semibold';

export default function Sidebar({ activeId }) {
  const [status, setStatus] = useState(null);

  // Re-check on page change, so starting the server or editing .env shows up without a reload.
  useEffect(() => {
    let cancelled = false;
    fetchConnectionStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-name">Studyspace</div>
        <div className="sidebar-tagline">Your study workspace</div>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        <div className="label sidebar-nav-label">WORKSPACE</div>
        {SECTIONS.map((section) => {
          const isActive = section.id === activeId;
          return (
            <a
              key={section.id}
              href={section.hash}
              className={isActive ? ACTIVE_CLASSES : 'nav-item'}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-item-label">{section.label}</span>
              <span className="nav-item-route">{section.hash}</span>
            </a>
          );
        })}
      </nav>

      {/* The Figma Notes frame shows only the divider here; AI and Canvas show text. */}
      <div className="sidebar-footer">
        {activeId !== 'notes' && (
          <>
            <div className="caption">Notes save in this browser.</div>
            <div className="caption" role="status">
              {connectionCaption(status)}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
