import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { exportNoteAsDocx, exportNoteAsPdf } from '../lib/exportNote.js';
import { loadNotes, writeNotes } from '../lib/notesStorage.js';

const SAVE_ERROR = 'Could not save. Browser storage is blocked or full.';
const EXPORT_HINT = 'Export formats: PDF / DOCX. Files download to this device.';

function formatSavedAt(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function previewOf(note) {
  return note.content.trim().split('\n')[0] || 'No content yet';
}

export default function NotesPage() {
  const [notes, setNotes] = useState(loadNotes);
  const [savedNotes, setSavedNotes] = useState(notes);
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(EXPORT_HINT);
  const titleInputRef = useRef(null);
  const exportRef = useRef(null);
  const focusTitleOnCreate = useRef(false);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const savedById = new Map(savedNotes.map((note) => [note.id, note]));

  const isDirty = (note) => {
    const saved = savedById.get(note.id);
    return !saved || saved.title !== note.title || saved.content !== note.content;
  };
  const hasUnsavedNotes = notes.some(isDirty);

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

  return (
    <>
      <PageHeader
        title="Notes"
        description="A dedicated space to collect and organize your course notes."
        tag="US-06 / AC-04"
      />

      <div className="notes-layout">
        <section className="panel notes-list-panel">
          <h2 className="section-title">Your notes</h2>
          <button type="button" className="button button-primary notes-new" onClick={createNote}>
            New Note
          </button>
          <p className="caption notes-count">
            {notes.length === 1 ? '1 note' : `${notes.length} notes`} · this browser only
          </p>

          <div className="notes-list">
            {notes.length === 0 ? (
              <div className="notes-empty">
                <div className="notes-item-title">No notes yet</div>
                <div className="caption">Select New Note to create your first one.</div>
              </div>
            ) : (
              notes.map((note) => (
                <button
                  type="button"
                  key={note.id}
                  className={note.id === selectedId ? 'notes-item is-selected' : 'notes-item'}
                  aria-current={note.id === selectedId ? 'true' : undefined}
                  onClick={() => selectNote(note.id)}
                >
                  <span className="notes-item-title">{note.title.trim() || 'Untitled note'}</span>
                  <span className="caption notes-item-preview">
                    {isDirty(note) ? 'Unsaved · ' : ''}
                    {previewOf(note)}
                  </span>
                </button>
              ))
            )}
          </div>

          <p className="caption notes-list-footer">
            Notes are stored in this browser only. They are not synced to an account or the cloud.
          </p>
        </section>

        <section className="panel notes-editor">
          <div className="label">NOTE EDITOR</div>
          <input
            ref={titleInputRef}
            className="notes-title-input"
            aria-label="Note title"
            placeholder="Note title"
            disabled={!selected}
            value={selected?.title ?? ''}
            onChange={(event) => updateSelected({ title: event.target.value })}
          />
          <p
            className={saveFailed ? 'caption notes-save-status is-error' : 'caption notes-save-status'}
            role="status"
          >
            {saveStatus}
          </p>

          <div className="text-box notes-content-box">
            <textarea
              className="text-box-input"
              aria-label="Note content"
              placeholder="Write or paste your notes here..."
              disabled={!selected}
              value={selected?.content ?? ''}
              onChange={(event) => updateSelected({ content: event.target.value })}
            />
            <div className="caption text-box-hint">
              {selected ? 'Changes are kept when you select Save.' : 'No note selected.'}
            </div>
          </div>

          <div className="notes-actions">
            <button type="button" className="button button-outline" disabled={!selected} onClick={saveSelected}>
              Save
            </button>
            <div className="export-menu-anchor" ref={exportRef}>
              <button
                type="button"
                className="button button-outline"
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

          <p className="caption notes-export-hint" role="status">
            {exportMessage}
          </p>
        </section>
      </div>
    </>
  );
}
