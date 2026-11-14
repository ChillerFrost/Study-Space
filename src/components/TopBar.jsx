export default function TopBar({ section }) {
  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{section.label}</span>
      </nav>
      <div className="topbar-route">Current route: {section.hash}</div>
    </header>
  );
}
