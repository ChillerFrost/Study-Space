export default function TopBar({ section }) {
  // The Figma Notes frame has no route label in its top bar; AI and Canvas do.
  const showRoute = section.id !== 'notes';

  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{section.label}</span>
      </nav>
      {showRoute && <div className="topbar-route">Current route: {section.hash}</div>}
    </header>
  );
}
