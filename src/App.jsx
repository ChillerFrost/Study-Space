import { useEffect, useState } from 'react';
import Sidebar, { SECTIONS } from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import NotesPage from './pages/NotesPage.jsx';
import AiStudyToolsPage from './pages/AiStudyToolsPage.jsx';
import CanvasPage from './pages/CanvasPage.jsx';

const DEFAULT_SECTION = SECTIONS[0];

// Reads the current hash. A missing or unknown hash is rewritten to the
// default route in place (replaceState), so it never leaves a dead entry
// in the browser history and Back/Forward keep working.
function resolveSection() {
  const match = SECTIONS.find((section) => section.hash === window.location.hash);
  if (match) return match;

  window.history.replaceState(null, '', DEFAULT_SECTION.hash);
  return DEFAULT_SECTION;
}

export default function App() {
  const [section, setSection] = useState(resolveSection);

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
        <TopBar section={section} />
        <main className="workspace">
          <div hidden={section.id !== 'notes'}>
            <NotesPage />
          </div>
          <div hidden={section.id !== 'ai-tools'}>
            <AiStudyToolsPage />
          </div>
          <div hidden={section.id !== 'canvas'}>
            <CanvasPage />
          </div>
        </main>
      </div>
    </div>
  );
}
