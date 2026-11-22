// Settings entered on the Settings page, kept in this browser under studyspace.settings.v1.
// API keys are sent to the Study-Space server as request headers (read from storage only when a
// request is made); blank fields use the server's .env.
const STORAGE_KEY = 'studyspace.settings.v1';
export const SETTINGS_CHANGED_EVENT = 'studyspace:settings-changed';

export const MAX_INSTRUCTIONS = 1000;

// Models available on the DGX Spark gateway.
export const SPARK_MODELS = [
  'qwen3.8-27b',
  'gemma4-26b-fp8',
  'qwen3-coder-next-80b-a3b',
  'qwen3-coder-30b-fp8',
];

// AC-11.3 model choices, then the school's DGX Spark models, then Custom.
export const MODEL_OPTIONS = [
  { id: 'openai:gpt-4o', label: 'OpenAI — GPT-4o', name: 'GPT-4o', provider: 'openai', model: 'gpt-4o' },
  {
    id: 'openai:gpt-4o-mini',
    label: 'OpenAI — GPT-4o Mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  {
    id: 'anthropic:claude-3-5-sonnet',
    label: 'Anthropic — Claude 3.5 Sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
  },
  ...SPARK_MODELS.map((model) => ({
    id: `spark:${model}`,
    label: `DGX Spark — ${model}`,
    name: model,
    provider: 'spark',
    model,
  })),
  { id: 'custom', label: 'Custom (enter model name manually)', name: 'Custom model', provider: null, model: '' },
];

export const PROVIDER_KEY_FIELDS = {
  openai: 'openaiApiKey',
  anthropic: 'anthropicApiKey',
  spark: 'sparkApiKey',
};

const PROVIDER_MODEL_FIELDS = {
  openai: 'openaiModel',
  anthropic: 'anthropicModel',
  spark: 'sparkModel',
};

export const QUIZ_FORMAT_DEFAULTS = {
  mixed: ['multiple-choice', 'true-false'],
  'multiple-choice': ['multiple-choice'],
  'true-false': ['true-false'],
  flashcards: ['flashcards'],
};

export const EMPTY_SETTINGS = {
  // LLM connection
  llmModelOption: 'openai:gpt-4o',
  customModel: '',
  customInstructions: '',
  sparkApiKey: '',
  sparkModel: '',
  openaiApiKey: '',
  openaiModel: '',
  anthropicApiKey: '',
  anthropicModel: '',
  // Canvas
  canvasBaseUrl: '',
  canvasToken: '',
  // Workspace preferences
  appearance: 'light',
  autosaveNotes: true,
  // Study defaults
  defaultQuizFormat: 'mixed',
  questionsPerQuiz: 6,
};

const CHOICES = {
  llmModelOption: MODEL_OPTIONS.map((option) => option.id),
  appearance: ['light', 'dark', 'system'],
  defaultQuizFormat: Object.keys(QUIZ_FORMAT_DEFAULTS),
  questionsPerQuiz: [5, 6, 10, 15, 20],
};

// Custom model IDs: claude-* goes to Anthropic, Spark model names to the Spark gateway,
// anything else to an OpenAI-compatible endpoint.
export function providerForModel(optionId, customModel = '') {
  const option = MODEL_OPTIONS.find((item) => item.id === optionId);
  if (option?.provider) return option.provider;
  const id = customModel.trim().toLowerCase();
  if (id.startsWith('claude')) return 'anthropic';
  if (SPARK_MODELS.includes(id)) return 'spark';
  return 'openai';
}

export function modelForSettings(settings) {
  const option = MODEL_OPTIONS.find((item) => item.id === settings.llmModelOption);
  return option?.provider ? option.model : settings.customModel.trim();
}

export function modelLabel(settings) {
  const option = MODEL_OPTIONS.find((item) => item.id === settings.llmModelOption);
  return option?.provider ? option.name : settings.customModel.trim() || 'Custom model';
}

// AC-11.7: a key is usable when it is at least 8 visible ASCII characters with no spaces.
export function isUsableKey(key) {
  return /^[\x21-\x7E]{8,}$/.test(key.trim());
}

export function loadSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    const settings = { ...EMPTY_SETTINGS };
    for (const [key, fallback] of Object.entries(EMPTY_SETTINGS)) {
      const value = parsed?.[key];
      if (typeof value !== typeof fallback) continue;
      if (CHOICES[key] && !CHOICES[key].includes(value)) continue;
      settings[key] = value;
    }
    return settings;
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

// Returns false when the browser refuses the write.
// The selected model is also written to its provider's model field, which the server reads.
export function saveSettings(settings) {
  try {
    const next = {};
    for (const [key, fallback] of Object.entries(EMPTY_SETTINGS)) {
      const value = settings[key] ?? fallback;
      next[key] = typeof value === 'string' && key !== 'customInstructions' ? value.trim() : value;
    }
    const provider = providerForModel(next.llmModelOption, next.customModel);
    next[PROVIDER_MODEL_FIELDS[provider]] = modelForSettings(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

// AC-11.9: removes everything stored under studyspace.settings.v1.
export function clearSettings() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was stored, so there is nothing to clear.
  }
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

// True when the selected provider has a key saved in this browser.
export function hasSavedApiKey(settings = loadSettings()) {
  const provider = providerForModel(settings.llmModelOption, settings.customModel);
  return isUsableKey(settings[PROVIDER_KEY_FIELDS[provider]]);
}

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

const ASCII_HEADER = /^[\x20-\x7E]+$/;

// Builds request headers. Called at the moment a request is sent (AC-11.6), so keys are only
// read from storage then. Pass `settings` to send unsaved form values (Test Connection).
// X-LLM-Provider tells the server which provider the student picked.
export function settingsHeaders(settings = loadSettings()) {
  const headers = {};
  for (const [key, name] of Object.entries(HEADERS)) {
    const value = String(settings[key] ?? '').trim();
    if (value && ASCII_HEADER.test(value)) headers[name] = value;
  }
  headers['X-LLM-Provider'] = providerForModel(settings.llmModelOption, settings.customModel);
  return headers;
}
