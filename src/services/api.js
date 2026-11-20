// Browser-side helper for calling the Study-Space server (server/index.js).
// Vite proxies /api to the server in development, so these are same-origin requests.
import { sessionToken } from '../lib/session.js';
import { settingsHeaders } from '../lib/settings.js';

export class NotConnectedError extends Error {
  constructor(message = 'Service is not connected.') {
    super(message);
    this.name = 'NotConnectedError';
  }
}

// 401 from the server: not signed in, or the session expired.
export class AuthError extends Error {
  constructor(message = 'Sign in again to continue.') {
    super(message);
    this.name = 'AuthError';
  }
}

// Resolves to { ai, canvas, database } booleans. All false if the server isn't running.
export async function fetchConnectionStatus() {
  try {
    const { ai, canvas, database } = await apiRequest('/health');
    return { ai: Boolean(ai), canvas: Boolean(canvas), database: Boolean(database) };
  } catch {
    return { ai: false, canvas: false, database: false };
  }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { ...settingsHeaders() };
  const token = sessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure: the API server isn't running.
    throw new NotConnectedError('Study-Space server is not running.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  // 503 = server is up but the provider isn't configured. Vite's proxy answers 500/502/504
  // with an empty body when the API server is down, which also means "not connected".
  if (res.status === 503 || (!res.ok && data === null)) {
    throw new NotConnectedError(data?.error);
  }
  if (res.status === 401) throw new AuthError(data?.error);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
