import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { useSession } from '../lib/session.js';
import {
  EMPTY_SETTINGS,
  MAX_INSTRUCTIONS,
  MODEL_OPTIONS,
  PROVIDER_KEY_FIELDS,
  SETTINGS_CHANGED_EVENT,
  clearSettings,
  isUsableKey,
  loadSettings,
  modelLabel,
  providerForModel,
  saveSettings,
} from '../lib/settings.js';
import { fetchConnectionStatus } from '../services/api.js';
import { testConnection } from '../services/studyGenerator.js';

const INSTRUCTIONS_PLACEHOLDER =
  'e.g. Always respond in bullet points. Focus on exam-style questions. Keep answers under 100 words.';

const APPEARANCE_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const QUIZ_FORMAT_OPTIONS = [
  { id: 'mixed', label: 'Multiple Choice + True/False' },
  { id: 'multiple-choice', label: 'Multiple Choice' },
  { id: 'true-false', label: 'True / False' },
  { id: 'flashcards', label: 'Flashcards' },
];

const QUESTION_COUNTS = [5, 6, 10, 15, 20];

const TEST_MESSAGES = {
  idle: 'Not tested yet',
  testing: 'Testing...',
  failed: '❌ Connection failed — check your API key and model selection',
  offline: '❌ Connection failed — the Study-Space server is not running',
  unavailable: 'Connection test is not available on the server yet',
};

const TOAST_MS = 3000;

function EyeIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

// AC-11.6: the input is uncontrolled, so the key never becomes a value="" attribute in the DOM.
// Its text is set through the DOM property whenever `syncKey` changes (load, cancel, clear,
// switching provider).
function SecretInput({ id, value, syncKey, onChange, placeholder, label, describedBy }) {
  const inputRef = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = value;
    setShown(false);
    // Only re-sync on syncKey changes; typing updates the DOM directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  return (
    <div className="settings-input-wrap">
      <input
        ref={inputRef}
        id={id}
        type={shown ? 'text' : 'password'}
        className="settings-input has-icon"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="settings-input-icon"
        aria-label={shown ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={shown}
        onClick={() => setShown(!shown)}
      >
        <EyeIcon open={!shown} />
      </button>
    </div>
  );
}

function Select({ id, value, onChange, children, className = '' }) {
  return (
    <div className={`settings-select-wrap ${className}`}>
      <select id={id} className="settings-input settings-select" value={value} onChange={onChange}>
        {children}
      </select>
      <svg className="settings-select-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export default function SettingsPage() {
  const { session, signOut } = useSession();
  const [form, setForm] = useState(loadSettings);
  const [syncKey, setSyncKey] = useState(0);
  const [testState, setTestState] = useState('idle');
  const [toast, setToast] = useState('');
  const [saveError, setSaveError] = useState('');
  const [aiOnline, setAiOnline] = useState(false);
  const dialogRef = useRef(null);
  const toastTimer = useRef(null);

  const provider = providerForModel(form.llmModelOption, form.customModel);
  const keyField = PROVIDER_KEY_FIELDS[provider];
  const apiKey = form[keyField];
  const isCustom = form.llmModelOption === 'custom';
  const customMissing = isCustom && !form.customModel.trim();
  const instructionsLength = form.customInstructions.length;
  const instructionsTooLong = instructionsLength > MAX_INSTRUCTIONS;
  const canTest = isUsableKey(apiKey) && !customMissing && testState !== 'testing';
  const canSave = !instructionsTooLong && !customMissing;
  const isOnline = session?.mode === 'online';

  // Load fresh values into the form (first visit, Cancel, Clear, or settings saved elsewhere).
  const reload = () => {
    setForm(loadSettings());
    setSyncKey((key) => key + 1);
    setTestState('idle');
  };

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetchConnectionStatus().then((status) => {
        if (!cancelled) setAiOnline(status.ai);
      });
    check();
    window.addEventListener(SETTINGS_CHANGED_EVENT, check);
    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_CHANGED_EVENT, check);
    };
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveError('');
    if (['llmModelOption', 'customModel', keyField].includes(key)) setTestState('idle');
  };

  const changeModel = (optionId) => {
    update('llmModelOption', optionId);
    // The key field shows the key for the newly selected provider.
    setSyncKey((key) => key + 1);
  };

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
  };

  const save = (event) => {
    event.preventDefault();
    if (!canSave) return;
    if (saveSettings(form)) {
      setForm(loadSettings());
      showToast('Settings saved successfully');
    } else {
      setSaveError('Could not save. Browser storage is blocked or full.');
    }
  };

  const runTest = async () => {
    if (!canTest) return;
    setTestState('testing');
    setTestState(await testConnection(form));
  };

  const confirmClear = () => {
    clearSettings();
    dialogRef.current?.close();
    setForm({ ...EMPTY_SETTINGS });
    setSyncKey((key) => key + 1);
    setTestState('idle');
    showToast('Settings cleared');
  };

  const testMessage =
    testState === 'connected'
      ? `✅ Connected — ${modelLabel(form)} is responding`
      : TEST_MESSAGES[testState];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Make StudySpace work the way you study."
        tag="PREFERENCES & AI"
      />

      {/* AC-11.6 warning banner */}
      <div className="settings-warning" role="note">
        <p className="settings-warning-title">
          <span aria-hidden="true">⚠️ </span>
          Your API key is stored in your browser&rsquo;s local storage. Do not use this on a shared or
          public computer.
        </p>
        <p className="settings-warning-copy">
          Use a personal key with spending limits. Your provider may charge for AI requests.
        </p>
      </div>

      <form className="settings-form" onSubmit={save} noValidate>
        <div className="settings-grid">
          <div className="settings-column">
            <section className="panel settings-card" aria-labelledby="settings-llm-title">
              <div className="settings-card-header">
                <h2 className="settings-card-title" id="settings-llm-title">
                  LLM connection
                </h2>
                <span className={aiOnline ? 'settings-chip is-online' : 'settings-chip'}>
                  {aiOnline ? 'AI TOOLS ONLINE' : 'AI TOOLS OFFLINE'}
                </span>
              </div>
              <p className="settings-copy">Bring your own key to power quizzes and summaries.</p>

              <label className="settings-label" htmlFor="settings-api-key">
                LLM API Key
              </label>
              <SecretInput
                id="settings-api-key"
                label="API key"
                value={apiKey}
                syncKey={`${syncKey}:${keyField}`}
                placeholder="Paste your OpenAI, Anthropic, or compatible API key here"
                describedBy="settings-api-key-hint"
                onChange={(value) => update(keyField, value)}
              />
              <p className="settings-hint" id="settings-api-key-hint">
                Paste your OpenAI, Anthropic, or compatible API key here
              </p>

              <label className="settings-label" htmlFor="settings-model">
                Model
              </label>
              <Select
                id="settings-model"
                value={form.llmModelOption}
                onChange={(event) => changeModel(event.target.value)}
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="settings-hint">GPT-4o · GPT-4o Mini · Claude 3.5 Sonnet · Custom model ID</p>

              {isCustom && (
                <>
                  <label className="settings-label" htmlFor="settings-custom-model">
                    Custom model ID
                  </label>
                  <input
                    id="settings-custom-model"
                    className="settings-input"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="e.g. gpt-4.1 or claude-sonnet-5-5"
                    value={form.customModel}
                    aria-invalid={customMissing}
                    onChange={(event) => update('customModel', event.target.value)}
                  />
                  <p className={customMissing ? 'settings-hint is-error' : 'settings-hint'}>
                    {customMissing
                      ? 'Enter a model ID to save or test.'
                      : 'Model IDs starting with “claude” use Anthropic; others use an OpenAI-compatible API.'}
                  </p>
                </>
              )}

              <div className="settings-label-row">
                <label className="settings-label" htmlFor="settings-instructions">
                  Custom AI Instructions
                </label>
                <span className="caption">Optional</span>
              </div>
              <textarea
                id="settings-instructions"
                className={instructionsTooLong ? 'settings-input settings-textarea is-invalid' : 'settings-input settings-textarea'}
                placeholder={INSTRUCTIONS_PLACEHOLDER}
                value={form.customInstructions}
                aria-invalid={instructionsTooLong}
                aria-describedby="settings-instructions-count"
                onChange={(event) => update('customInstructions', event.target.value)}
              />
              <div className="settings-hint-row">
                <span className="settings-hint">Used for both Generate Quiz and Generate Summary.</span>
                <span
                  id="settings-instructions-count"
                  className={instructionsTooLong ? 'settings-hint is-error' : 'settings-hint'}
                >
                  {instructionsLength.toLocaleString('en-US')} / {MAX_INSTRUCTIONS.toLocaleString('en-US')}
                </span>
              </div>
              {instructionsTooLong && (
                <p className="settings-hint is-error" role="alert">
                  Instructions are over the {MAX_INSTRUCTIONS.toLocaleString('en-US')} character limit.
                  Shorten them to save.
                </p>
              )}

              <div className="settings-test-row">
                <button
                  type="button"
                  className="settings-button"
                  disabled={!canTest}
                  onClick={runTest}
                >
                  Test Connection
                </button>
                <span
                  className={`settings-test-status is-${testState}`}
                  role="status"
                  aria-live="polite"
                >
                  {testMessage}
                </span>
              </div>
              <p className="settings-hint settings-test-hint">
                Add and test a key before using AI generation.
              </p>
            </section>

            <section className="panel settings-card" aria-labelledby="settings-canvas-title">
              <h2 className="settings-card-title" id="settings-canvas-title">
                Canvas connection
              </h2>
              <p className="settings-copy">
                Create a token in Canvas under Account &rsaquo; Settings &rsaquo; New Access Token.
              </p>
              <label className="settings-label" htmlFor="settings-canvas-url">
                Canvas base URL
              </label>
              <input
                id="settings-canvas-url"
                className="settings-input"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://yourschool.instructure.com/api/v1"
                value={form.canvasBaseUrl}
                onChange={(event) => update('canvasBaseUrl', event.target.value)}
              />
              <label className="settings-label" htmlFor="settings-canvas-token">
                Canvas API token
              </label>
              <SecretInput
                id="settings-canvas-token"
                label="Canvas token"
                value={form.canvasToken}
                syncKey={syncKey}
                placeholder="Uses the server .env value when blank"
                onChange={(value) => update('canvasToken', value)}
              />
            </section>
          </div>

          <div className="settings-column">
            <section className="panel settings-card" aria-labelledby="settings-workspace-title">
              <h2 className="settings-card-title" id="settings-workspace-title">
                Workspace preferences
              </h2>
              <fieldset className="settings-fieldset">
                <legend className="settings-label">Appearance</legend>
                <div className="segmented">
                  {APPEARANCE_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={form.appearance === option.id ? 'segmented-option is-selected' : 'segmented-option'}
                    >
                      <input
                        type="radio"
                        name="appearance"
                        className="visually-hidden"
                        checked={form.appearance === option.id}
                        onChange={() => update('appearance', option.id)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="settings-divider" />
              <div className="settings-toggle-row">
                <div>
                  <div className="settings-label" id="settings-autosave-label">
                    Autosave notes
                  </div>
                  <p className="settings-hint" id="settings-autosave-hint">
                    Keep your latest edits in this browser.
                  </p>
                </div>
                <label className="switch-row settings-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch-input"
                    checked={form.autosaveNotes}
                    aria-labelledby="settings-autosave-label"
                    aria-describedby="settings-autosave-hint"
                    onChange={() => update('autosaveNotes', !form.autosaveNotes)}
                  />
                  <span className="switch" aria-hidden="true" />
                </label>
              </div>
            </section>

            <section className="panel settings-card" aria-labelledby="settings-study-title">
              <h2 className="settings-card-title" id="settings-study-title">
                Study defaults
              </h2>
              <label className="settings-label" htmlFor="settings-quiz-format">
                Default quiz format
              </label>
              <Select
                id="settings-quiz-format"
                value={form.defaultQuizFormat}
                onChange={(event) => update('defaultQuizFormat', event.target.value)}
              >
                {QUIZ_FORMAT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="settings-inline-row">
                <label className="settings-label" htmlFor="settings-question-count">
                  Questions per quiz
                </label>
                <Select
                  id="settings-question-count"
                  className="is-compact"
                  value={form.questionsPerQuiz}
                  onChange={(event) => update('questionsPerQuiz', Number(event.target.value))}
                >
                  {QUESTION_COUNTS.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="settings-hint settings-study-hint">Used when starting a new study session.</p>
            </section>

            <section className="panel settings-card" aria-labelledby="settings-reset-title">
              <h2 className="settings-card-title" id="settings-reset-title">
                Local data &amp; reset
              </h2>
              <p className="settings-copy">Remove your saved key and preferences.</p>
              <div className="settings-test-row">
                <button
                  type="button"
                  className="settings-button is-danger"
                  onClick={() => dialogRef.current?.showModal()}
                >
                  Clear Settings
                </button>
                <span className="caption">Confirmation required</span>
              </div>
            </section>

            <section className="panel settings-card" aria-labelledby="settings-account-title">
              <h2 className="settings-card-title" id="settings-account-title">
                Account
              </h2>
              <p className="settings-copy">
                {isOnline ? (
                  <>
                    Signed in as <strong>{session.email}</strong>. Notes save to{' '}
                    {session.saveTo === 'cloud' ? 'your account (cloud)' : 'this computer (local)'}.
                  </>
                ) : (
                  'You are working offline. Notes save only to this computer.'
                )}
              </p>
              <button type="button" className="settings-button settings-account-button" onClick={signOut}>
                {isOnline ? 'Sign out' : 'Sign in or create an account'}
              </button>
            </section>
          </div>
        </div>

        <section className="panel settings-savebar">
          <div>
            <h2 className="settings-savebar-title">Your preferences, your workspace.</h2>
            <p className="settings-hint">
              {saveError || 'Saved locally on this device. No changes to your notes.'}
            </p>
          </div>
          <div className="settings-savebar-actions">
            <button type="button" className="settings-button" onClick={reload}>
              Cancel
            </button>
            <button type="submit" className="settings-button is-primary" disabled={!canSave}>
              Save Settings
            </button>
          </div>
        </section>
      </form>

      <p className="settings-footnote">
        Your notes and study materials stay unchanged when you update these preferences.
      </p>

      <dialog
        ref={dialogRef}
        className="settings-dialog"
        aria-labelledby="settings-dialog-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <h2 className="settings-card-title" id="settings-dialog-title">
          Clear all settings?
        </h2>
        <p className="settings-copy">
          This removes your saved API key, model, custom instructions, Canvas connection and
          preferences from this browser. Your notes are not affected.
        </p>
        <div className="settings-dialog-actions">
          <button type="button" className="settings-button" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="button" className="settings-button is-danger-filled" onClick={confirmClear}>
            Clear Settings
          </button>
        </div>
      </dialog>

      {toast && (
        <div className="toast" role="status">
          <span aria-hidden="true">✓ </span>
          {toast}
        </div>
      )}
    </>
  );
}
