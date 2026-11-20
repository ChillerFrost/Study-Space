import { useState } from 'react';
import { login, register } from '../services/auth.js';
import { NotConnectedError } from '../services/api.js';

const MIN_PASSWORD_LENGTH = 8;

// First screen: work online (account + cloud saves in MongoDB) or offline (local saves only).
export default function LoginPage({ onContinue }) {
  const [choice, setChoice] = useState(null); // null | 'online'
  const [mode, setMode] = useState('sign-in'); // 'sign-in' | 'create'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isCreate = mode === 'create';

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setConfirm('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (isCreate && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (isCreate && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { token, user } = await (isCreate ? register : login)(email, password);
      onContinue({ mode: 'online', token, email: user.email, saveTo: 'cloud' });
    } catch (caught) {
      setBusy(false);
      if (caught instanceof NotConnectedError) {
        setError(
          `Online accounts are unavailable right now (${caught.message || 'server not connected'}). You can continue offline instead.`,
        );
      } else {
        setError(caught.message || 'Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="login-screen">
      <section className="panel login-card" aria-labelledby="login-title">
        <div className="sidebar-name">Studyspace</div>
        <h1 className="login-title" id="login-title">
          {choice === 'online' ? (isCreate ? 'Create your account' : 'Sign in') : 'How do you want to study?'}
        </h1>

        {choice === null && (
          <>
            <p className="page-description">
              Go online to save notes to your account and reach them from any device, or stay offline
              and keep everything on this computer.
            </p>
            <div className="login-choices">
              <button type="button" className="login-choice" onClick={() => setChoice('online')}>
                <span className="login-choice-title">Continue online</span>
                <span className="caption">Sign in or create an account. Notes can save to the cloud.</span>
              </button>
              <button
                type="button"
                className="login-choice"
                onClick={() => onContinue({ mode: 'offline', saveTo: 'local' })}
              >
                <span className="login-choice-title">Continue offline</span>
                <span className="caption">No account. Notes save to this browser or a folder you choose.</span>
              </button>
            </div>
          </>
        )}

        {choice === 'online' && (
          <form className="login-form" onSubmit={submit} noValidate>
            <div className="login-tabs" role="tablist" aria-label="Account">
              <button
                type="button"
                role="tab"
                aria-selected={!isCreate}
                className={isCreate ? 'login-tab' : 'login-tab is-active'}
                onClick={() => switchMode('sign-in')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isCreate}
                className={isCreate ? 'login-tab is-active' : 'login-tab'}
                onClick={() => switchMode('create')}
              >
                Create account
              </button>
            </div>

            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                className="field-input"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <input
                type="password"
                className="field-input"
                autoComplete={isCreate ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {isCreate && <span className="caption">At least {MIN_PASSWORD_LENGTH} characters.</span>}
            </label>
            {isCreate && (
              <label className="field">
                <span className="field-label">Confirm password</span>
                <input
                  type="password"
                  className="field-input"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
            )}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="button button-primary login-submit" disabled={busy || !email || !password}>
              {busy ? 'Please wait...' : isCreate ? 'Create account' : 'Sign in'}
            </button>
            <div className="login-footer">
              <button type="button" className="text-button" onClick={() => setChoice(null)}>
                Back
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onContinue({ mode: 'offline', saveTo: 'local' })}
              >
                Continue offline instead
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
