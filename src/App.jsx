import { useEffect, useState } from 'react';
import Sidebar, { SECTIONS } from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import NotesPage from './pages/NotesPage.jsx';
import AiStudyToolsPage from './pages/AiStudyToolsPage.jsx';
import CanvasPage from './pages/CanvasPage.jsx';

const DEFAULT_SECTION = SECTIONS[0];

// Reads the current hash. Shorthand (#notes) is rewritten to its canonical
// route (#/notes); a missing or unknown hash is rewritten to the default.
// Both use replaceState, so no dead entry is left in the browser history
// and Back/Forward keep working.
function resolveSection() {
  const { hash } = window.location;
  const match = SECTIONS.find((section) => section.hash === hash);
  if (match) return match;

  const shorthand = SECTIONS.find((section) => section.hash.replace('#/', '#') === hash);
  const target = shorthand ?? DEFAULT_SECTION;
  window.history.replaceState(null, '', target.hash);
  return target;
}

export default function App() {
  const [section, setSection] = useState(resolveSection);
  const [aiBreadcrumb, setAiBreadcrumb] = useState(null);

  useEffect(() => {
    const onHashChange = () => setSection(resolveSection());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Every page stays mounted so drafts and selections survive navigation.
  return (
    <div className="shell">
      <Sidebar activeId={section.id} />
      <div className="main">
        <TopBar section={section} detail={section.id === 'ai-tools' ? aiBreadcrumb : null} />
        <main className="workspace">
          <div hidden={section.id !== 'notes'}>
            <NotesPage />
          </div>
          <div hidden={section.id !== 'ai-tools'}>
            <AiStudyToolsPage onBreadcrumbChange={setAiBreadcrumb} />
          </div>
          <div hidden={section.id !== 'canvas'}>
            <CanvasPage />
          </div>
        </main>
      </div>
    </div>
  );
}
