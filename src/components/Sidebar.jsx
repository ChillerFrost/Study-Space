import { useEffect, useState } from 'react';
import { fetchConnectionStatus } from '../services/api.js';
import { useSession } from '../lib/session.js';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings.js';

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
  // Settings lives in the sidebar footer (Figma, AC-11.1), not the main list.
  { id: 'settings', label: 'Settings', hash: '#/settings', footer: true },
];

// AC-1.2 class names, kept alongside .is-active so QA can find them.
// The visual style itself comes from .is-active (Figma values).
const ACTIVE_CLASSES = 'nav-item is-active bg-blue-50 text-blue-600 font-semibold';

function saveCaption(session) {
  if (session.mode === 'offline') return 'Offline · notes save on this computer.';
  return session.saveTo === 'cloud'
    ? `Notes save to ${session.email}.`
    : 'Notes save on this computer.';
}

const SETTINGS = SECTIONS.find((section) => section.id === 'settings');

function GearIcon() {
  return (
    <svg className="sidebar-gear" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export default function Sidebar({ activeId }) {
  const { session } = useSession();
  const settingsActive = activeId === 'settings';
  const [status, setStatus] = useState(null);
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    const onChange = () => setSettingsVersion((version) => version + 1);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onChange);
  }, []);

  // Re-check on page change or new settings, so starting the server or adding keys shows up without a reload.
  useEffect(() => {
    let cancelled = false;
    fetchConnectionStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, settingsVersion]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-name">Studyspace</div>
        <div className="sidebar-tagline">Your study workspace</div>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        <div className="label sidebar-nav-label">WORKSPACE</div>
        {SECTIONS.filter((section) => !section.footer).map((section) => {
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

      {/* The Figma Notes frame shows only the divider and Settings here; other pages add text. */}
      <div className="sidebar-footer">
        <a
          href={SETTINGS.hash}
          className={settingsActive ? `${ACTIVE_CLASSES} sidebar-settings` : 'nav-item sidebar-settings'}
          aria-current={settingsActive ? 'page' : undefined}
        >
          <span className="nav-item-label">
            <GearIcon />
            {SETTINGS.label}
          </span>
          <span className="nav-item-route">{SETTINGS.hash}</span>
        </a>
        {settingsActive && (
          <div className="sidebar-footer-text">
            <div className="caption">StudySpace · Local workspace</div>
            <div className="caption">Settings apply to this browser.</div>
          </div>
        )}
        {activeId !== 'notes' && !settingsActive && (
          <div className="sidebar-footer-text">
            <div className="caption">{saveCaption(session)}</div>
            <div className="caption" role="status">
              {connectionCaption(status)}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
