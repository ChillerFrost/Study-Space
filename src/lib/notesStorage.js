import { fetchCloudNotes, saveCloudNotes } from '../services/auth.js';
import { readNotesFromFolder, writeNotesToFolder } from './localFolder.js';

const STORAGE_KEY = 'studyspace.notes.v1';

function isNote(value) {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.content === 'string'
  );
}

export function loadNotes() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter(isNote) : [];
  } catch {
    return [];
  }
}

// Returns false when the browser refuses the write (storage blocked or full).
export function writeNotes(notes) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

// Where notes are read from and saved to:
//   { kind: 'cloud' }            the signed-in account in MongoDB
//   { kind: 'folder', handle }   a folder chosen on this computer
//   { kind: 'browser' }          this browser's storage
export async function loadNotesFrom(target) {
  if (target.kind === 'cloud') return (await fetchCloudNotes()).filter(isNote);
  if (target.kind === 'folder') return (await readNotesFromFolder(target.handle)).filter(isNote);
  return loadNotes();
}

// Throws when the save fails.
export async function saveNotesTo(target, notes) {
  if (target.kind === 'cloud') {
    await saveCloudNotes(notes);
    return;
  }
  if (target.kind === 'folder') {
    await writeNotesToFolder(target.handle, notes);
    return;
  }
  if (!writeNotes(notes)) throw new Error('Browser storage is blocked or full.');
}

export function describeTarget(target) {
  if (target.kind === 'cloud') return 'your account';
  if (target.kind === 'folder') return `folder “${target.handle.name}”`;
  return 'this browser';
}
