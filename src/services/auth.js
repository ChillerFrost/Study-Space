// Account and cloud-notes calls. Accounts and notes are stored in MongoDB by the server.
import { apiRequest } from './api.js';

export function register(email, password) {
  return apiRequest('/auth/register', { method: 'POST', body: { email, password } });
}

export function login(email, password) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password } });
}

export function requestPasswordReset(email) {
  return apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword(email, code, password) {
  return apiRequest('/auth/reset-password', { method: 'POST', body: { email, code, password } });
}

export async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Signing out locally still works if the server can't be reached.
  }
}

export function fetchCurrentUser() {
  return apiRequest('/auth/me');
}

export async function fetchCloudNotes() {
  const { notes } = await apiRequest('/notes');
  return Array.isArray(notes) ? notes : [];
}

export function saveCloudNotes(notes) {
  return apiRequest('/notes', { method: 'PUT', body: { notes } });
}
