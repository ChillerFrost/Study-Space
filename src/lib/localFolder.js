// Saving notes to a folder the user picks, using the File System Access API
// (Chrome, Edge and other Chromium browsers). The chosen folder is remembered in IndexedDB;
// after a reload the browser asks for permission again the first time it is used.
const DB_NAME = 'studyspace';
const STORE = 'handles';
const FOLDER_KEY = 'notes-folder';
export const NOTES_FILE = 'studyspace-notes.json';

export const folderPickerSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function getSavedFolder() {
  if (!folderPickerSupported) return null;
  try {
    return (await withStore('readonly', (store) => store.get(FOLDER_KEY))) ?? null;
  } catch {
    return null;
  }
}

// Opens the folder picker. Rejects with AbortError if the user cancels.
export async function chooseFolder() {
  const handle = await window.showDirectoryPicker({ id: 'studyspace-notes', mode: 'readwrite' });
  await withStore('readwrite', (store) => store.put(handle, FOLDER_KEY));
  return handle;
}

export async function forgetFolder() {
  try {
    await withStore('readwrite', (store) => store.delete(FOLDER_KEY));
  } catch {
    // Nothing saved.
  }
}

// 'granted' | 'prompt' | 'denied'. `request` must come from a click.
export async function folderPermission(handle, request = false) {
  const options = { mode: 'readwrite' };
  const state = await handle.queryPermission(options);
  if (state !== 'prompt' || !request) return state;
  return handle.requestPermission(options);
}

export async function readNotesFromFolder(handle) {
  try {
    const file = await (await handle.getFileHandle(NOTES_FILE)).getFile();
    const parsed = JSON.parse(await file.text());
    return Array.isArray(parsed?.notes) ? parsed.notes : [];
  } catch (error) {
    if (error?.name === 'NotFoundError') return []; // New folder: no notes saved yet.
    throw error;
  }
}

export async function writeNotesToFolder(handle, notes) {
  const fileHandle = await handle.getFileHandle(NOTES_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify({ app: 'studyspace', version: 1, notes }, null, 2));
  await writable.close();
}
