import { useEffect, useState } from 'react';
import Sidebar, { SECTIONS } from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import NotesPage from './pages/NotesPage.jsx';
import AiStudyToolsPage from './pages/AiStudyToolsPage.jsx';
import CanvasPage from './pages/CanvasPage.jsx';

function sectionFromHash() {
  const id = window.location.hash.replace('#/', '');
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0];
}

export default function App() {
  const [section, setSection] = useState(sectionFromHash);

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Every page stays mounted so drafts and selections survive navigation.
  return (
    <div className="shell">
      <Sidebar activeId={section.id} />
      <div className="main">
        <TopBar sectionLabel={section.label} />
        <main className="workspace">
          <div hidden={section.id !== 'notes'}>
            <NotesPage />
          </div>
          <div hidden={section.id !== 'ai-study-tools'}>
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
