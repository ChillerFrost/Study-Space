// API keys and Canvas settings entered on the Settings page. They are kept in this browser
// and sent to the Study-Space server as request headers; blank fields use the server's .env.
const STORAGE_KEY = 'studyspace.settings.v1';
export const SETTINGS_CHANGED_EVENT = 'studyspace:settings-changed';

// Models available on the DGX Spark gateway.
export const SPARK_MODELS = [
  'qwen3.8-27b',
  'gemma4-26b-fp8',
  'qwen3-coder-next-80b-a3b',
  'qwen3-coder-30b-fp8',
];
const DEFAULT_SPARK_MODEL = 'gemma4-26b-fp8';

export const EMPTY_SETTINGS = {
  sparkApiKey: '',
  sparkModel: DEFAULT_SPARK_MODEL,
  openaiApiKey: '',
  openaiModel: '',
  anthropicApiKey: '',
  anthropicModel: '',
  canvasBaseUrl: '',
  canvasToken: '',
};

const HEADERS = {
  sparkApiKey: 'X-Spark-Api-Key',
  sparkModel: 'X-Spark-Model',
  openaiApiKey: 'X-OpenAI-Api-Key',
  openaiModel: 'X-OpenAI-Model',
  anthropicApiKey: 'X-Anthropic-Api-Key',
  anthropicModel: 'X-Anthropic-Model',
  canvasBaseUrl: 'X-Canvas-Base-Url',
  canvasToken: 'X-Canvas-Token',
};

export function loadSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    const settings = { ...EMPTY_SETTINGS };
    for (const key of Object.keys(EMPTY_SETTINGS)) {
      if (typeof parsed?.[key] === 'string') settings[key] = parsed[key];
    }
    if (!SPARK_MODELS.includes(settings.sparkModel)) settings.sparkModel = DEFAULT_SPARK_MODEL;
    return settings;
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

// Returns false when the browser refuses the write.
export function saveSettings(settings) {
  try {
    const trimmed = Object.fromEntries(
      Object.keys(EMPTY_SETTINGS).map((key) => [key, String(settings[key] ?? '').trim()]),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// Header values must be plain ASCII, so anything else is left out.
export function settingsHeaders() {
  const settings = loadSettings();
  const headers = {};
  for (const [key, name] of Object.entries(HEADERS)) {
    const value = settings[key];
    if (value && /^[\x20-\x7E]+$/.test(value)) headers[name] = value;
  }
  return headers;
}
