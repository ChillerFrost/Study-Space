import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar, { SECTIONS } from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import NotesPage from './pages/NotesPage.jsx';
import AiStudyToolsPage from './pages/AiStudyToolsPage.jsx';
import CanvasPage from './pages/CanvasPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { SessionContext, loadSession, storeSession } from './lib/session.js';
import { fetchCurrentUser, logout } from './services/auth.js';
import { AuthError } from './services/api.js';

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
  const [session, setSessionState] = useState(loadSession);

  const setSession = useCallback((next) => {
    storeSession(next);
    setSessionState(next);
  }, []);

  // Back to the login page. Online users are also signed out on the server.
  const signOut = useCallback(async () => {
    if (session?.mode === 'online') await logout();
    setSession(null);
  }, [session, setSession]);

  useEffect(() => {
    const onHashChange = () => setSection(resolveSection());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // A remembered online session may have expired; send the user back to log in if so.
  const token = session?.mode === 'online' ? session.token : null;
  useEffect(() => {
    if (!token) return;
    fetchCurrentUser().catch((error) => {
      if (error instanceof AuthError) setSession(null);
    });
  }, [token, setSession]);

  const sessionValue = useMemo(() => ({ session, setSession, signOut }), [session, setSession, signOut]);

  if (!session) return <LoginPage onContinue={setSession} />;

  // Every page stays mounted so drafts and selections survive navigation.
  return (
    <SessionContext.Provider value={sessionValue}>
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
            <div hidden={section.id !== 'settings'}>
              <SettingsPage />
            </div>
          </main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
