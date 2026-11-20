// The one function the rest of the server calls to talk to a model.
// API keys and models come from the Settings page (sent as request headers)
// and fall back to .env. The provider is LLM_PROVIDER in .env: "spark" (default), "openai", or "anthropic".
import 'dotenv/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export class LLMNotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LLMNotConfiguredError';
  }
}

const header = (req, name) => req?.get?.(name)?.trim() || '';

// Builds the model settings for one request. Header values win over .env values.
// The Spark base URL is only read from .env so the browser can't point the server at other hosts.
export function llmConfig(req) {
  const env = process.env;
  return {
    provider: (env.LLM_PROVIDER || 'spark').toLowerCase(),
    spark: {
      baseURL: env.LLM_BASE_URL,
      apiKey: header(req, 'x-spark-api-key') || env.LLM_API_KEY,
      model: header(req, 'x-spark-model') || env.LLM_MODEL,
    },
    openai: {
      apiKey: header(req, 'x-openai-api-key') || env.OPENAI_API_KEY,
      model: header(req, 'x-openai-model') || env.OPENAI_MODEL,
    },
    anthropic: {
      apiKey: header(req, 'x-anthropic-api-key') || env.ANTHROPIC_API_KEY,
      model: header(req, 'x-anthropic-model') || env.ANTHROPIC_MODEL,
    },
  };
}

const REQUIRED = {
  spark: { baseURL: 'LLM_BASE_URL in .env', model: 'a Spark model' },
  openai: { apiKey: 'an OpenAI API key', model: 'an OpenAI model' },
  anthropic: { apiKey: 'an Anthropic API key', model: 'an Anthropic model' },
};

function missingFields(config) {
  const required = REQUIRED[config.provider];
  if (!required) return null;
  return Object.entries(required)
    .filter(([field]) => !config[config.provider][field])
    .map(([, label]) => label);
}

export function llmConfigured(config) {
  const missing = missingFields(config);
  return Boolean(missing) && missing.length === 0;
}

function requireConfigured(config) {
  const missing = missingFields(config);
  if (!missing) throw new LLMNotConfiguredError(`Unknown LLM provider "${config.provider}"`);
  if (missing.length > 0) {
    throw new LLMNotConfiguredError(`Missing ${missing.join(', ')}. Add it on the Settings page or in .env.`);
  }
}

export async function askLLM(system, userText, { maxTokens = 4000, config = llmConfig() } = {}) {
  requireConfigured(config);
  const { provider } = config;

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: config.anthropic.apiKey });
    const res = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    });
    return res.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  // DGX Spark gateway speaks the OpenAI format, so the OpenAI client works with a custom baseURL.
  const settings = config[provider];
  const client = new OpenAI({
    apiKey: settings.apiKey || 'not-needed',
    baseURL: provider === 'spark' ? settings.baseURL : undefined,
  });
  const res = await client.chat.completions.create({
    model: settings.model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ],
  });
  return res.choices[0]?.message?.content ?? '';
}

// Asks for JSON and parses it. Models sometimes wrap JSON in ```fences``` or add a sentence,
// so this pulls out the outermost {...} before parsing.
export async function askLLMForJSON(system, userText, options) {
  const text = await askLLM(
    `${system}\n\nRespond with a single JSON object only. No markdown, no code fences, no commentary.`,
    userText,
    options,
  );
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('Model did not return JSON');
  }
  return JSON.parse(text.slice(start, end + 1));
}
