// The one function the rest of the server calls to talk to a model.
// Switch providers with LLM_PROVIDER in .env: "spark" (default), "openai", or "anthropic".
import 'dotenv/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export class LLMNotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LLMNotConfiguredError';
  }
}

function requireEnv(...names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new LLMNotConfiguredError(`Missing ${missing.join(', ')} in .env`);
  }
}

export function currentProvider() {
  return (process.env.LLM_PROVIDER || 'spark').toLowerCase();
}

const REQUIRED_ENV = {
  spark: ['LLM_BASE_URL', 'LLM_MODEL'],
  openai: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
  anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'],
};

export function llmConfigured() {
  const names = REQUIRED_ENV[currentProvider()];
  return Boolean(names) && names.every((name) => process.env[name]);
}

export async function askLLM(system, userText, { maxTokens = 4000 } = {}) {
  const provider = currentProvider();

  if (provider === 'anthropic') {
    requireEnv('ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    });
    return res.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  let apiKey;
  let baseURL;
  let model;
  if (provider === 'openai') {
    requireEnv('OPENAI_API_KEY', 'OPENAI_MODEL');
    apiKey = process.env.OPENAI_API_KEY;
    model = process.env.OPENAI_MODEL;
  } else if (provider === 'spark') {
    // DGX Spark gateway speaks the OpenAI format, so the OpenAI client works with a custom baseURL.
    requireEnv('LLM_BASE_URL', 'LLM_MODEL');
    apiKey = process.env.LLM_API_KEY || 'not-needed';
    baseURL = process.env.LLM_BASE_URL;
    model = process.env.LLM_MODEL;
  } else {
    throw new LLMNotConfiguredError(`Unknown LLM_PROVIDER "${provider}"`);
  }

  const client = new OpenAI({ apiKey, baseURL });
  const res = await client.chat.completions.create({
    model,
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
