import { SETTINGS_CHANGED_EVENT, loadSettings } from './settings.js';

// Applies the Appearance setting (Light / Dark / System) as data-theme on <html>.
const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

function applyTheme() {
  const { appearance } = loadSettings();
  const dark = appearance === 'dark' || (appearance === 'system' && Boolean(darkQuery?.matches));
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function startTheme() {
  applyTheme();
  window.addEventListener(SETTINGS_CHANGED_EVENT, applyTheme);
  darkQuery?.addEventListener?.('change', applyTheme);
}
