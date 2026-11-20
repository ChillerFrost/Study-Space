import { createContext, useContext } from 'react';

// How the user entered the app, remembered in this browser:
//   { mode: 'online', token, email, saveTo: 'cloud' | 'local' }
//   { mode: 'offline', saveTo: 'local' }
// null means the login page hasn't been answered yet.
const STORAGE_KEY = 'studyspace.session.v1';

function isSession(value) {
  if (value?.mode === 'offline') return true;
  return value?.mode === 'online' && typeof value.token === 'string' && typeof value.email === 'string';
}

export function loadSession() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (!isSession(parsed)) return null;
    // Offline sessions can only save locally.
    const saveTo = parsed.mode === 'online' && parsed.saveTo !== 'local' ? 'cloud' : 'local';
    return { ...parsed, saveTo };
  } catch {
    return null;
  }
}

export function storeSession(session) {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the session still works until the page reloads.
  }
}

export function sessionToken() {
  const session = loadSession();
  return session?.mode === 'online' ? session.token : null;
}

// { session, setSession, signOut } provided by App.
export const SessionContext = createContext(null);

export function useSession() {
  return useContext(SessionContext);
}
