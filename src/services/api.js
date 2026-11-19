// Browser-side helper for calling the Study-Space server (server/index.js).
// Vite proxies /api to the server in development, so these are same-origin requests.

export class NotConnectedError extends Error {
  constructor(message = 'Service is not connected.') {
    super(message);
    this.name = 'NotConnectedError';
  }
}

// Resolves to { ai: boolean, canvas: boolean }. Both false if the server isn't running.
export async function fetchConnectionStatus() {
  try {
    const { ai, canvas } = await apiRequest('/health');
    return { ai: Boolean(ai), canvas: Boolean(canvas) };
  } catch {
    return { ai: false, canvas: false };
  }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure: the API server isn't running.
    throw new NotConnectedError('Study-Space server is not running.');
  }

  const data = await res.json().catch(() => null);
  // 503 = server is up but the provider isn't configured. Vite's proxy answers 500/502/504
  // with an empty body when the API server is down, which also means "not connected".
  if (res.status === 503 || (!res.ok && data === null)) {
    throw new NotConnectedError(data?.error);
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
