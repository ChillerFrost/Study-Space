export const SECTIONS = [
  { id: 'notes', label: 'Notes' },
  { id: 'ai-study-tools', label: 'AI Study Tools' },
  { id: 'canvas', label: 'Canvas' },
];

export default function Sidebar({ activeId }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-name">Studyspace</div>
        <div className="sidebar-tagline">Your study workspace</div>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        <div className="label sidebar-nav-label">WORKSPACE</div>
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#/${section.id}`}
            className={section.id === activeId ? 'nav-item is-active' : 'nav-item'}
            aria-current={section.id === activeId ? 'page' : undefined}
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="caption">Notes save in this browser.</div>
        <div className="caption">AI and Canvas are not connected.</div>
      </div>
    </aside>
  );
}
