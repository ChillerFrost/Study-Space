// API server for Study-Space. Vite proxies /api/* here during development (see vite.config.js).
import express from 'express';
import { askLLMForJSON, currentProvider, llmConfigured, LLMNotConfiguredError } from './llm.js';
import { canvasConfigured, CanvasNotConfiguredError, getUpcomingAssignments } from './canvas.js';

const PORT = Number(process.env.PORT) || 3001;
const MIN_NOTE_CHARACTERS = 10;
const MAX_NOTE_CHARACTERS = 50000;

const app = express();
app.use(express.json({ limit: '1mb' }));

// Wraps async routes so thrown errors become JSON responses instead of crashing the server.
// 503 + notConnected tells the frontend to show its "NOT CONNECTED" banner.
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (error instanceof LLMNotConfiguredError || error instanceof CanvasNotConfiguredError) {
      res.status(503).json({ error: error.message, notConnected: true });
      return;
    }
    console.error(`${req.method} ${req.path} failed:`, error);
    res.status(502).json({ error: 'Upstream request failed' });
  }
};

function readNotes(req, res) {
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';
  if (notes.replace(/\s/g, '').length < MIN_NOTE_CHARACTERS) {
    res.status(400).json({ error: `Notes must have at least ${MIN_NOTE_CHARACTERS} characters` });
    return null;
  }
  return notes.slice(0, MAX_NOTE_CHARACTERS);
}

const SUMMARY_PROMPT = `You are a study assistant. Summarize the student's notes clearly and accurately, using only what the notes contain.
Return JSON with this shape:
{
  "title": string,            // short, e.g. "Your calculus summary"
  "overview": string,         // 2-4 sentences: the big picture
  "sections": [{ "heading": string, "body": string }],  // 3-6 core concepts
  "reminder": string          // one sentence of study advice
}`;

app.post(
  '/api/summarize',
  route(async (req, res) => {
    const notes = readNotes(req, res);
    if (notes === null) return;
    const data = await askLLMForJSON(SUMMARY_PROMPT, notes);
    res.json({
      title: data.title,
      overview: String(data.overview ?? ''),
      sections: Array.isArray(data.sections) ? data.sections : [],
      reminder: data.reminder,
    });
  }),
);

const FORMAT_SHAPES = {
  'multiple-choice':
    '{ "format": "multiple-choice", "topic": string, "prompt": string, "options": [4 strings], "answerIndex": number (0-based), "explanation": string, "hint": string, "whyItMatters": string }',
  'true-false':
    '{ "format": "true-false", "topic": string, "prompt": string, "answer": boolean, "explanation": string, "hint": string, "whyItMatters": string }',
  flashcards:
    '{ "format": "flashcards", "topic": string, "front": string, "back": string, "explanation": string }',
};

function quizPrompt(counts) {
  const wanted = Object.entries(counts)
    .map(([format, count]) => `- exactly ${count} items of format "${format}": ${FORMAT_SHAPES[format]}`)
    .join('\n');
  return `You are a study assistant. Write practice questions based only on the student's notes.
Return JSON with this shape:
{ "title": string, "questions": [ ...items ] }
Include:
${wanted}`;
}

function isValidQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  if (q.format === 'multiple-choice') {
    return (
      Array.isArray(q.options) &&
      Number.isInteger(q.answerIndex) &&
      q.answerIndex >= 0 &&
      q.answerIndex < q.options.length
    );
  }
  if (q.format === 'true-false') return typeof q.answer === 'boolean';
  if (q.format === 'flashcards') return Boolean(q.front && q.back);
  return false;
}

app.post(
  '/api/quiz',
  route(async (req, res) => {
    const notes = readNotes(req, res);
    if (notes === null) return;

    const counts = {};
    for (const [format, count] of Object.entries(req.body?.counts ?? {})) {
      if (FORMAT_SHAPES[format] && Number.isInteger(count) && count > 0) {
        counts[format] = Math.min(count, 20);
      }
    }
    if (Object.keys(counts).length === 0) {
      res.status(400).json({ error: 'Select at least one study format' });
      return;
    }

    const data = await askLLMForJSON(quizPrompt(counts), notes);
    const questions = (Array.isArray(data.questions) ? data.questions : []).filter(
      (q) => counts[q?.format] && isValidQuestion(q),
    );
    if (questions.length === 0) throw new Error('Model returned no usable questions');
    res.json({ title: String(data.title ?? 'Practice quiz'), questions });
  }),
);

app.get(
  '/api/assignments',
  route(async (req, res) => {
    res.json(await getUpcomingAssignments());
  }),
);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    provider: currentProvider(),
    ai: llmConfigured(),
    canvas: canvasConfigured(),
  });
});

app.listen(PORT, () => {
  console.log(`Study-Space API on http://localhost:${PORT} (LLM provider: ${currentProvider()})`);
});
