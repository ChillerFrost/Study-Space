export default function TopBar({ sectionLabel }) {
  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{sectionLabel}</span>
      </nav>
    </header>
  );
}
