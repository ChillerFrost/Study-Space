import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import SplitDivider from '../components/SplitDivider.jsx';
import { exportNoteAsDocx, exportNoteAsPdf } from '../lib/exportNote.js';
import { loadNotes, writeNotes } from '../lib/notesStorage.js';

const SAVE_ERROR = 'Could not save. Browser storage is blocked or full.';
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

export default function NotesPage() {
  const [notes, setNotes] = useState(loadNotes);
  const [savedNotes, setSavedNotes] = useState(notes);
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(EXPORT_HINT);
  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_DEFAULT);
  const [explorerMax, setExplorerMax] = useState(EXPLORER_MAX);
  const splitRef = useRef(null);
  const titleInputRef = useRef(null);
  const exportRef = useRef(null);
  const focusTitleOnCreate = useRef(false);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const savedById = new Map(savedNotes.map((note) => [note.id, note]));
  const visibleNotes = notes.filter((note) => matchesSearch(note, query));

  const isDirty = (note) => {
    const saved = savedById.get(note.id);
    return !saved || saved.title !== note.title || saved.content !== note.content;
  };
  const hasUnsavedNotes = notes.some(isDirty);

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
    setSaveFailed(false);
    setExportMenuOpen(false);
    setExportMessage(EXPORT_HINT);
  };

  // Writes the given notes to storage, keeping the last saved version of any other note with unsaved edits.
  const persist = (workingNotes, noteIdToSave) => {
    const next = workingNotes.map((note) =>
      note.id === noteIdToSave ? note : (savedById.get(note.id) ?? note),
    );
    const ok = writeNotes(next);
    if (ok) setSavedNotes(next);
    setSaveFailed(!ok);
  };

  const createNote = () => {
    const note = { id: crypto.randomUUID(), title: '', content: '', updatedAt: Date.now() };
    const next = [note, ...notes];
    setNotes(next);
    persist(next, note.id);
    setQuery('');
    focusTitleOnCreate.current = true;
    setSelectedId(note.id);
    setExportMenuOpen(false);
    setExportMessage(EXPORT_HINT);
  };

  const updateSelected = (changes) => {
    setNotes((current) =>
      current.map((note) => (note.id === selectedId ? { ...note, ...changes } : note)),
    );
  };

  const saveSelected = () => {
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
  if (selected) {
    if (saveFailed) saveStatus = SAVE_ERROR;
    else if (isDirty(selected)) saveStatus = 'Unsaved changes';
    else saveStatus = `Saved in this browser · ${formatSavedAt(selected.updatedAt)}`;
  }

  let listContent;
  if (notes.length === 0) {
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
          <button type="button" className="button button-primary notes-new" onClick={createNote}>
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
          <p className="caption notes-list-footer">
            Notes are stored in this browser only. They are not synced to an account or the cloud.
          </p>
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
              className="button button-outline button-pill"
              disabled={!selected}
              onClick={saveSelected}
            >
              Save
            </button>
            <div className="export-menu-anchor" ref={exportRef}>
              <button
                type="button"
                className="button button-outline button-pill"
                disabled={!selected || exporting}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              {exportMenuOpen && (
                <div className="export-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => runExport(exportNoteAsPdf)}>
                    PDF (.pdf)
                  </button>
                  <button type="button" role="menuitem" onClick={() => runExport(exportNoteAsDocx)}>
                    Word (.docx)
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
            className={saveFailed ? 'caption notes-save-status is-error' : 'caption notes-save-status'}
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
