export const SECTIONS = [
  { id: 'notes', label: 'Notes', hash: '#/notes' },
  { id: 'ai-tools', label: 'AI Study Tools', hash: '#/ai-tools' },
  { id: 'canvas', label: 'Canvas', hash: '#/canvas' },
];

// AC-1.2 class names, kept alongside .is-active so QA can find them.
// The visual style itself comes from .is-active (Figma values).
const ACTIVE_CLASSES = 'nav-item is-active bg-blue-50 text-blue-600 font-semibold';

export default function Sidebar({ activeId }) {
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
            <div className="caption">AI and Canvas are not connected.</div>
          </>
        )}
      </div>
    </aside>
  );
}
