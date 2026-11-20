import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import SplitDivider from '../components/SplitDivider.jsx';
import { canExportNote, exportNoteAsDocx, exportNoteAsPdf } from '../lib/exportNote.js';
import { describeTarget, loadNotesFrom, saveNotesTo } from '../lib/notesStorage.js';
import {
  chooseFolder,
  folderPermission,
  folderPickerSupported,
  forgetFolder,
  getSavedFolder,
} from '../lib/localFolder.js';
import { useSession } from '../lib/session.js';
import { AuthError } from '../services/api.js';
import { SAVE_NOTE_EVENT } from '../components/study/SummaryView.jsx';

const UNSAVED_SWITCH_WARNING =
  'You have unsaved changes. Switching where notes are saved will discard them. Continue?';
const EXPORT_HINT = 'Export formats: PDF / DOCX. Files download to this device.';

// Split-pane limits from the Figma design notes.
const EXPLORER_DEFAULT = 280;
const EXPLORER_MIN = 240;
const EXPLORER_MAX = 400;
const EDITOR_MIN = 480;
const DIVIDER_WIDTH = 16;

function formatSavedAt(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Card timestamp in the Figma style: "Today, 10:42 AM".
function formatCardTime(timestamp) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

function matchesSearch(note, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return note.title.toLowerCase().includes(needle) || note.content.toLowerCase().includes(needle);
}

// The folder chosen for local saves (remembered between visits) and whether we may write to it.
function useNotesFolder() {
  const [folder, setFolder] = useState({
    handle: null,
    permission: null,
    ready: !folderPickerSupported,
    version: 0,
  });

  useEffect(() => {
    if (!folderPickerSupported) return;
    let cancelled = false;
    (async () => {
      const handle = await getSavedFolder();
      const permission = handle ? await folderPermission(handle).catch(() => 'denied') : null;
      if (!cancelled) setFolder((current) => ({ ...current, handle, permission, ready: true }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (handle, permission) =>
    setFolder((current) => ({ handle, permission, ready: true, version: current.version + 1 }));

  return {
    ...folder,
    choose: async () => {
      const handle = await chooseFolder();
      set(handle, await folderPermission(handle, true));
    },
    reconnect: async () => set(folder.handle, await folderPermission(folder.handle, true)),
    forget: async () => {
      await forgetFolder();
      set(null, null);
    },
  };
}

export default function NotesPage() {
  const { session, setSession, signOut } = useSession();
  const folder = useNotesFolder();
  const [notes, setNotes] = useState([]);
  const [savedNotes, setSavedNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadState, setLoadState] = useState({ status: 'loading' });
  const [reloadCount, setReloadCount] = useState(0);
  const [query, setQuery] = useState('');
  const [saveError, setSaveError] = useState('');
  const [storageMessage, setStorageMessage] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(EXPORT_HINT);
  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_DEFAULT);
  const [explorerMax, setExplorerMax] = useState(EXPLORER_MAX);
  const splitRef = useRef(null);
  const titleInputRef = useRef(null);
  const exportRef = useRef(null);
  const focusTitleOnCreate = useRef(false);
  const addNoteRef = useRef(null);
  const savedRef = useRef(savedNotes);
  const saveQueue = useRef(Promise.resolve());
  const targetKeyRef = useRef(null);

  const isOnline = session.mode === 'online';
  const cloudOn = isOnline && session.saveTo === 'cloud';
  const folderLocked = Boolean(folder.handle) && folder.permission !== 'granted';

  // Where notes are read from and saved to right now.
  const target = useMemo(() => {
    if (cloudOn) return { kind: 'cloud', key: `cloud:${session.token}` };
    if (folder.handle && folder.permission === 'granted') {
      return { kind: 'folder', handle: folder.handle, key: `folder:${folder.version}` };
    }
    if (folder.handle) return { kind: 'locked', key: `locked:${folder.version}` };
    return { kind: 'browser', key: 'browser' };
  }, [cloudOn, session.token, folder.handle, folder.permission, folder.version]);
  targetKeyRef.current = target.key;
  const isReady = loadState.status === 'ready';

  const markSaved = (list) => {
    savedRef.current = list;
    setSavedNotes(list);
  };

  // Load the notes whenever the save location changes.
  useEffect(() => {
    if (!folder.ready) return undefined;
    let cancelled = false;
    const show = (list, state) => {
      setNotes(list);
      markSaved(list);
      setSelectedId(list[0]?.id ?? null);
      setLoadState(state);
      setSaveError('');
    };
    if (target.kind === 'locked') {
      show([], { status: 'locked' });
      return undefined;
    }
    setLoadState({ status: 'loading' });
    loadNotesFrom(target)
      .then((list) => {
        if (!cancelled) show(list, { status: 'ready' });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof AuthError) {
          signOut();
          return;
        }
        console.error(error);
        show([], {
          status: 'error',
          message: `Could not load notes from ${describeTarget(target)}. ${error.message ?? ''}`.trim(),
        });
      });
    return () => {
      cancelled = true;
    };
    // `target` is identified by its key.
  }, [target.key, folder.ready, reloadCount]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const savedById = new Map(savedNotes.map((note) => [note.id, note]));
  const visibleNotes = notes.filter((note) => matchesSearch(note, query));

  const isDirty = (note) => {
    const saved = savedById.get(note.id);
    return !saved || saved.title !== note.title || saved.content !== note.content;
  };
  const hasUnsavedNotes = notes.some(isDirty);
  const exportDisabled = !canExportNote(selected) || exporting;
  // Save lights up only when the selected note has changes to save.
  const saveDisabled = !isReady || !selected || !isDirty(selected);

  // Switching location reloads the list, so unsaved edits would be lost.
  const confirmSwitch = () => !hasUnsavedNotes || window.confirm(UNSAVED_SWITCH_WARNING);

  const toggleCloud = () => {
    if (!isOnline || !confirmSwitch()) return;
    setStorageMessage('');
    setSession({ ...session, saveTo: cloudOn ? 'local' : 'cloud' });
  };

  const runFolderAction = async (action) => {
    if (!confirmSwitch()) return;
    setStorageMessage('');
    try {
      await action();
    } catch (error) {
      if (error?.name === 'AbortError') return; // Picker closed.
      setStorageMessage(`Could not use that folder. ${error?.message ?? ''}`.trim());
    }
  };

  // Keep the editor at least EDITOR_MIN wide as the window resizes.
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const room = entry.contentRect.width - DIVIDER_WIDTH - EDITOR_MIN;
      setExplorerMax(Math.max(EXPLORER_MIN, Math.min(EXPLORER_MAX, room)));
    });
    observer.observe(splitRef.current);
    return () => observer.disconnect();
  }, []);

  const shownExplorerWidth = Math.min(Math.max(explorerWidth, EXPLORER_MIN), explorerMax);
  const resizeExplorer = (width) => {
    setExplorerWidth(Math.min(Math.max(Math.round(width), EXPLORER_MIN), explorerMax));
  };

  useEffect(() => {
    if (!hasUnsavedNotes) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedNotes]);

  useEffect(() => {
    if (!exportMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!exportRef.current?.contains(event.target)) setExportMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (focusTitleOnCreate.current) {
      focusTitleOnCreate.current = false;
      titleInputRef.current?.focus();
    }
  }, [selectedId]);

  const selectNote = (id) => {
    setSelectedId(id);
    setSaveError('');
    setExportMenuOpen(false);
    setExportMessage(EXPORT_HINT);
  };

  // Writes the given notes to the current location, keeping the last saved version of any
  // other note with unsaved edits. Saves run one at a time so they land in order.
  const persist = (workingNotes, noteIdToSave) => {
    const saveTarget = target;
    saveQueue.current = saveQueue.current.then(async () => {
      if (targetKeyRef.current !== saveTarget.key) return;
      const lastSaved = new Map(savedRef.current.map((note) => [note.id, note]));
      const next = workingNotes.map((note) =>
        note.id === noteIdToSave ? note : (lastSaved.get(note.id) ?? note),
      );
      try {
        await saveNotesTo(saveTarget, next);
        if (targetKeyRef.current !== saveTarget.key) return;
        markSaved(next);
        setSaveError('');
      } catch (error) {
        if (targetKeyRef.current !== saveTarget.key) return;
        setSaveError(
          error instanceof AuthError
            ? 'Could not save: your session expired. Sign in again from Settings.'
            : `Could not save to ${describeTarget(saveTarget)}. ${error?.message ?? ''}`.trim(),
        );
      }
    });
  };

  const createNote = () => {
    if (!isReady) return;
    const now = Date.now();
    const note = { id: crypto.randomUUID(), title: '', content: '', createdAt: now, updatedAt: now };
    const next = [note, ...notes];
    setNotes(next);
    persist(next, note.id);
    setQuery('');
    focusTitleOnCreate.current = true;
    setSelectedId(note.id);
    setExportMenuOpen(false);
    setExportMessage(EXPORT_HINT);
  };

  // "Save to Notes" on the AI summary screen adds a saved note here.
  addNoteRef.current = ({ title, content }) => {
    if (!isReady) return;
    const now = Date.now();
    const note = { id: crypto.randomUUID(), title, content, createdAt: now, updatedAt: now };
    const next = [note, ...notes];
    setNotes(next);
    persist(next, note.id);
  };

  useEffect(() => {
    const onSaveNote = (event) => addNoteRef.current(event.detail);
    window.addEventListener(SAVE_NOTE_EVENT, onSaveNote);
    return () => window.removeEventListener(SAVE_NOTE_EVENT, onSaveNote);
  }, []);

  const updateSelected = (changes) => {
    setNotes((current) =>
      current.map((note) => (note.id === selectedId ? { ...note, ...changes } : note)),
    );
  };

  const saveSelected = () => {
    if (saveDisabled) return;
    const stamped = { ...selected, updatedAt: isDirty(selected) ? Date.now() : selected.updatedAt };
    const next = notes.map((note) => (note.id === stamped.id ? stamped : note));
    setNotes(next);
    persist(next, stamped.id);
  };

  const runExport = async (exportNote) => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const { fileName, replacedCharacters } = await exportNote(selected);
      setExportMessage(
        replacedCharacters > 0
          ? `Downloaded ${fileName}. ${replacedCharacters} unsupported character(s) became "?". Use DOCX to keep them.`
          : `Downloaded ${fileName}.`,
      );
    } catch {
      setExportMessage('Export failed. No file was downloaded. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  let saveStatus = 'Create a note to start writing.';
  if (loadState.status === 'loading') saveStatus = `Loading notes from ${describeTarget(target)}...`;
  else if (loadState.status === 'locked') saveStatus = 'Reconnect your notes folder to keep writing.';
  else if (loadState.status === 'error') saveStatus = loadState.message;
  else if (saveError) saveStatus = saveError;
  else if (selected) {
    if (isDirty(selected)) saveStatus = 'Unsaved changes';
    else saveStatus = `Saved to ${describeTarget(target)} · ${formatSavedAt(selected.updatedAt)}`;
  }
  const statusIsError = Boolean(saveError) || loadState.status === 'error';

  let locationCaption;
  if (!isOnline) locationCaption = 'Offline mode · cloud saves are off.';
  else if (cloudOn) locationCaption = `Saving to your account (${session.email}).`;
  else locationCaption = 'Saving on this computer.';

  let listContent;
  if (loadState.status === 'loading') {
    listContent = <p className="caption">Loading notes...</p>;
  } else if (loadState.status === 'locked') {
    listContent = (
      <div className="notes-empty">
        <div className="notes-card-title">Folder needs permission</div>
        <div className="caption">Select Reconnect folder below to load your notes.</div>
      </div>
    );
  } else if (loadState.status === 'error') {
    listContent = (
      <div className="notes-empty">
        <div className="notes-card-title">Notes did not load</div>
        <button type="button" className="text-button is-primary" onClick={() => setReloadCount((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  } else if (notes.length === 0) {
    listContent = (
      <div className="notes-empty">
        <div className="notes-card-title">No notes yet</div>
        <div className="caption">Select New Note to create your first one.</div>
      </div>
    );
  } else if (visibleNotes.length === 0) {
    listContent = <p className="caption">No notes match your search.</p>;
  } else {
    listContent = visibleNotes.map((note) => (
      <button
        type="button"
        key={note.id}
        className={note.id === selectedId ? 'notes-card is-selected' : 'notes-card'}
        aria-current={note.id === selectedId ? 'true' : undefined}
        onClick={() => selectNote(note.id)}
      >
        <span className="notes-card-title">{note.title.trim() || 'Untitled note'}</span>
        <span className="caption notes-card-meta">
          {isDirty(note) ? 'Unsaved · ' : ''}
          {formatCardTime(note.updatedAt)}
        </span>
      </button>
    ));
  }

  return (
    <>
      <PageHeader
        title="Notes"
        description="A dedicated space to collect and organize your course notes."
        tag="US-06 / AC-04"
      />

      <div
        className="notes-split"
        ref={splitRef}
        style={{ '--explorer-width': `${shownExplorerWidth}px` }}
      >
        <section className="notes-explorer" id="notes-explorer" aria-labelledby="notes-explorer-title">
          <h2 className="label" id="notes-explorer-title">
            YOUR NOTES
          </h2>
          <button
            type="button"
            className="button button-primary notes-new"
            disabled={!isReady}
            onClick={createNote}
          >
            + New Note
          </button>
          <input
            type="search"
            className="notes-search"
            aria-label="Search notes"
            placeholder="Search notes..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="label notes-recent-label">RECENT NOTES</div>
          <div className="notes-list">{listContent}</div>
          <div className="notes-storage">
            <div className="label">SAVE LOCATION</div>
            <label className={isOnline ? 'switch-row' : 'switch-row is-disabled'}>
              <input
                type="checkbox"
                role="switch"
                className="switch-input"
                checked={cloudOn}
                disabled={!isOnline}
                onChange={toggleCloud}
              />
              <span className="switch" aria-hidden="true" />
              <span>Cloud saves</span>
            </label>
            <p className="caption">{locationCaption}</p>

            {!cloudOn &&
              (folderPickerSupported ? (
                <>
                  <p className="caption notes-folder-name">
                    {folder.handle ? `Folder: ${folder.handle.name}` : 'Location: this browser'}
                  </p>
                  <div className="notes-folder-actions">
                    {folderLocked ? (
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => runFolderAction(folder.reconnect)}
                      >
                        Reconnect folder
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => runFolderAction(folder.choose)}
                      >
                        {folder.handle ? 'Change folder' : 'Choose folder'}
                      </button>
                    )}
                    {folder.handle && (
                      <button type="button" className="text-button" onClick={() => runFolderAction(folder.forget)}>
                        Use browser
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="caption">
                  Saving in this browser. Choosing a save folder needs Chrome or Edge.
                </p>
              ))}
            {storageMessage && (
              <p className="caption is-error" role="alert">
                {storageMessage}
              </p>
            )}
          </div>
        </section>

        <SplitDivider
          value={shownExplorerWidth}
          min={EXPLORER_MIN}
          max={explorerMax}
          onChange={resizeExplorer}
          label="Resize note list"
          controls="notes-explorer"
        />

        <section className="notes-editor" aria-labelledby="notes-editor-title">
          <h2 className="label" id="notes-editor-title">
            NOTE EDITOR
          </h2>
          <div className="notes-editor-toolbar">
            <input
              ref={titleInputRef}
              className="notes-title-input"
              aria-label="Note title"
              placeholder="Untitled note"
              disabled={!selected}
              value={selected?.title ?? ''}
              onChange={(event) => updateSelected({ title: event.target.value })}
            />
            <button
              type="button"
              className="button button-primary button-pill"
              disabled={saveDisabled}
              onClick={saveSelected}
            >
              Save
            </button>
            <div className="export-menu-anchor" ref={exportRef}>
              <button
                type="button"
                className="button button-primary button-pill"
                disabled={exportDisabled}
                title={selected && !exporting && exportDisabled ? 'Add a title or text to export' : undefined}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              {exportMenuOpen && !exportDisabled && (
                <div className="export-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => runExport(exportNoteAsPdf)}>
                    Export as PDF
                  </button>
                  <button type="button" role="menuitem" onClick={() => runExport(exportNoteAsDocx)}>
                    Export as DOCX
                  </button>
                </div>
              )}
            </div>
          </div>

          <textarea
            className="notes-content"
            aria-label="Note content"
            placeholder="Write or paste your notes here..."
            disabled={!selected}
            value={selected?.content ?? ''}
            onChange={(event) => updateSelected({ content: event.target.value })}
          />

          <p
            className={statusIsError ? 'caption notes-save-status is-error' : 'caption notes-save-status'}
            role="status"
          >
            {saveStatus}
          </p>
          <p className="caption notes-export-hint" role="status">
            {exportMessage}
          </p>
        </section>
      </div>
    </>
  );
}
