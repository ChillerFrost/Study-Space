export default function TopBar({ section, detail }) {
  // The Figma Notes and AI Study Tools frames have no route label in the top bar; Canvas does.
  const showRoute = section.id === 'canvas';

  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span aria-current={detail ? undefined : 'page'}>{section.label}</span>
        {detail && (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{detail}</span>
          </>
        )}
      </nav>
      {showRoute && <div className="topbar-route">Current route: {section.hash}</div>}
    </header>
  );
}
