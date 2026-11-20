import { useState } from 'react';
import { login, register, requestPasswordReset, resetPassword } from '../services/auth.js';
import { NotConnectedError } from '../services/api.js';

const MIN_PASSWORD_LENGTH = 8;

function errorMessage(caught, unavailable) {
  if (caught instanceof NotConnectedError) {
    return `${unavailable} (${caught.message || 'server not connected'}).`;
  }
  return caught.message || 'Something went wrong. Please try again.';
}

// Two steps: email a 6-digit code, then enter the code with a new password.
function ForgotPassword({ initialEmail, onDone, onBack }) {
  const [step, setStep] = useState('request'); // 'request' | 'verify'
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async (event) => {
    event?.preventDefault();
    setError('');
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStep('verify');
      setNotice(`If an account exists for ${email.trim()}, a 6-digit code is on its way. It expires in 15 minutes.`);
    } catch (caught) {
      setError(errorMessage(caught, 'Password reset is unavailable right now'));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { token, user } = await resetPassword(email, code, password);
      onDone({ mode: 'online', token, email: user.email, saveTo: 'cloud' });
    } catch (caught) {
      setBusy(false);
      setError(errorMessage(caught, 'Password reset is unavailable right now'));
    }
  };

  if (step === 'request') {
    return (
      <form className="login-form" onSubmit={sendCode} noValidate>
        <p className="page-description">Enter your account email and we&rsquo;ll send you a reset code.</p>
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
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button-primary login-submit" disabled={busy || !email}>
          {busy ? 'Sending...' : 'Send reset code'}
        </button>
        <div className="login-footer">
          <button type="button" className="text-button" onClick={onBack}>
            Back to sign in
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={submitReset} noValidate>
      <p className="page-description" role="status">
        {notice}
      </p>
      <label className="field">
        <span className="field-label">Reset code</span>
        <input
          className="field-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className="field">
        <span className="field-label">New password</span>
        <input
          type="password"
          className="field-input"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <span className="caption">At least {MIN_PASSWORD_LENGTH} characters.</span>
      </label>
      <label className="field">
        <span className="field-label">Confirm new password</span>
        <input
          type="password"
          className="field-input"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="button button-primary login-submit"
        disabled={busy || code.length !== 6 || !password}
      >
        {busy ? 'Please wait...' : 'Reset password and sign in'}
      </button>
      <div className="login-footer">
        <button type="button" className="text-button" onClick={onBack}>
          Back to sign in
        </button>
        <button type="button" className="text-button" disabled={busy} onClick={() => sendCode()}>
          Send a new code
        </button>
      </div>
    </form>
  );
}

// First screen: work online (account + cloud saves in MongoDB) or offline (local saves only).
export default function LoginPage({ onContinue }) {
  const [choice, setChoice] = useState(null); // null | 'online'
  const [mode, setMode] = useState('sign-in'); // 'sign-in' | 'create' | 'forgot'
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
      setError(errorMessage(caught, 'Online accounts are unavailable right now. You can continue offline instead'));
    }
  };

  return (
    <div className="login-screen">
      <section className="panel login-card" aria-labelledby="login-title">
        <div className="sidebar-name">Studyspace</div>
        <h1 className="login-title" id="login-title">
          {choice !== 'online'
            ? 'How do you want to study?'
            : mode === 'forgot'
              ? 'Reset your password'
              : isCreate
                ? 'Create your account'
                : 'Sign in'}
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

        {choice === 'online' && mode === 'forgot' && (
          <ForgotPassword initialEmail={email} onDone={onContinue} onBack={() => switchMode('sign-in')} />
        )}

        {choice === 'online' && mode !== 'forgot' && (
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
              {isCreate ? (
                <span className="caption">At least {MIN_PASSWORD_LENGTH} characters.</span>
              ) : (
                <button type="button" className="text-button login-forgot" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              )}
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
