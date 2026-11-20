import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { useSession } from '../lib/session.js';
import { EMPTY_SETTINGS, SPARK_MODELS, loadSettings, saveSettings } from '../lib/settings.js';

const KEY_GROUPS = [
  {
    title: 'DGX Spark gateway',
    fields: [
      { key: 'sparkApiKey', label: 'API key', secret: true },
      { key: 'sparkModel', label: 'Model', options: SPARK_MODELS },
    ],
  },
  {
    title: 'OpenAI (ChatGPT)',
    fields: [
      { key: 'openaiApiKey', label: 'API key', secret: true, placeholder: 'sk-...' },
      { key: 'openaiModel', label: 'Model', placeholder: 'OpenAI model ID' },
    ],
  },
  {
    title: 'Anthropic (Claude)',
    fields: [
      { key: 'anthropicApiKey', label: 'API key', secret: true, placeholder: 'sk-ant-...' },
      { key: 'anthropicModel', label: 'Model', placeholder: 'e.g. claude-sonnet-5-5' },
    ],
  },
];

function Field({ field, value, onChange }) {
  const [shown, setShown] = useState(false);
  if (field.options) {
    return (
      <label className="field">
        <span className="field-label">{field.label}</span>
        <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="field">
      <span className="field-label">{field.label}</span>
      <span className="field-row">
        <input
          type={field.secret && !shown ? 'password' : 'text'}
          className="field-input"
          autoComplete="off"
          spellCheck={false}
          placeholder={field.placeholder ?? 'Uses server .env value'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.secret && (
          <button type="button" className="button button-secondary field-toggle" onClick={() => setShown(!shown)}>
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const { session, signOut } = useSession();
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(settings);
  const [status, setStatus] = useState('');

  const dirty = Object.keys(EMPTY_SETTINGS).some((key) => settings[key] !== saved[key]);
  const update = (key) => (value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatus('');
  };

  const save = (event) => {
    event.preventDefault();
    if (saveSettings(settings)) {
      const stored = loadSettings();
      setSettings(stored);
      setSaved(stored);
      setStatus('Settings saved in this browser.');
    } else {
      setStatus('Could not save. Browser storage is blocked or full.');
    }
  };

  const clearAll = () => {
    setSettings({ ...EMPTY_SETTINGS });
    setStatus('Fields cleared. Select Save settings to apply.');
  };

  const isOnline = session.mode === 'online';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account, AI model keys and Canvas connection."
        tag="SETTINGS"
      />

      <div className="settings-layout">
        <section className="panel settings-panel" aria-labelledby="settings-account-title">
          <h2 className="section-title" id="settings-account-title">
            Account
          </h2>
          {isOnline ? (
            <p className="settings-copy">
              Signed in as <strong>{session.email}</strong>. Notes save to{' '}
              {session.saveTo === 'cloud' ? 'your account (cloud)' : 'this computer (local)'}; switch this on
              the Notes page.
            </p>
          ) : (
            <p className="settings-copy">
              You are working offline. Notes save only to this computer and cloud saves are turned off.
            </p>
          )}
          <button type="button" className="button button-secondary" onClick={signOut}>
            {isOnline ? 'Sign out' : 'Sign in or create an account'}
          </button>
        </section>

        <form className="panel settings-panel" onSubmit={save} aria-labelledby="settings-ai-title">
          <h2 className="section-title" id="settings-ai-title">
            AI models
          </h2>
          <p className="settings-copy">
            Add your own API keys and models. Leave a field blank to use the value in the server&rsquo;s
            .env file.
          </p>

          {KEY_GROUPS.map((group) => (
            <fieldset key={group.title} className="settings-group">
              <legend className="label">{group.title.toUpperCase()}</legend>
              {group.fields.map((field) => (
                <Field key={field.key} field={field} value={settings[field.key]} onChange={update(field.key)} />
              ))}
            </fieldset>
          ))}

          <h2 className="section-title settings-subtitle">Canvas</h2>
          <p className="settings-copy">
            Create a token in Canvas under Account &rsaquo; Settings &rsaquo; New Access Token.
          </p>
          <Field
            field={{ key: 'canvasBaseUrl', label: 'Canvas base URL', placeholder: 'https://yourschool.instructure.com/api/v1' }}
            value={settings.canvasBaseUrl}
            onChange={update('canvasBaseUrl')}
          />
          <Field
            field={{ key: 'canvasToken', label: 'Canvas API token', secret: true }}
            value={settings.canvasToken}
            onChange={update('canvasToken')}
          />

          <p className="caption settings-note">
            Keys are stored in this browser and only sent to your Study-Space server.
          </p>
          <div className="button-row">
            <button type="submit" className="button button-primary" disabled={!dirty}>
              Save settings
            </button>
            <button type="button" className="text-button" onClick={clearAll}>
              Clear all
            </button>
          </div>
          <p className="caption" role="status">
            {status || (dirty ? 'Unsaved changes' : '')}
          </p>
        </form>
      </div>
    </>
  );
}
