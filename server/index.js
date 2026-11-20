// API server for Study-Space. Vite proxies /api/* here during development (see vite.config.js).
// In production (e.g. Railway) it also serves the built frontend from dist/, so the whole app
// runs as one service and every secret stays in the server's environment variables.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { askLLMForJSON, llmConfig, llmConfigured, LLMNotConfiguredError } from './llm.js';
import {
  canvasConfig,
  canvasConfigured,
  CanvasNotConfiguredError,
  getUpcomingAssignments,
} from './canvas.js';
import { databaseConfigured, DatabaseNotConfiguredError, getDb } from './db.js';
import { mailConfigured, MailNotConfiguredError } from './mail.js';
import { requestPasswordReset, resetPassword } from './passwordReset.js';
import {
  checkPassword,
  createSession,
  deleteSession,
  hashPassword,
  HttpError,
  normalizeEmail,
  publicUser,
  requireUser,
  verifyPassword,
} from './auth.js';

const PORT = Number(process.env.PORT) || 3001;
const MIN_NOTE_CHARACTERS = 10;
const MAX_NOTE_CHARACTERS = 50000;

const app = express();
// Railway (and most hosts) put one proxy in front of the app; this makes req.ip the real
// client address, which the rate limits below rely on.
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));

// Per-IP request limits, so a public deployment can't be used to guess passwords,
// spam reset emails, or run up the AI bill.
function limit(windowMinutes, max, message) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: message },
  });
}
const authLimit = limit(15, 20, 'Too many sign-in attempts. Try again in a few minutes.');
const resetEmailLimit = limit(60, 5, 'Too many reset emails requested. Try again later.');
const resetCodeLimit = limit(15, 10, 'Too many reset attempts. Try again in a few minutes.');
const aiLimit = limit(10, 30, 'Too many AI requests. Wait a few minutes and try again.');

// Wraps async routes so thrown errors become JSON responses instead of crashing the server.
// 503 + notConnected tells the frontend to show its "NOT CONNECTED" banner.
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (
      error instanceof LLMNotConfiguredError ||
      error instanceof CanvasNotConfiguredError ||
      error instanceof DatabaseNotConfiguredError ||
      error instanceof MailNotConfiguredError
    ) {
      res.status(503).json({ error: error.message, notConnected: true });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
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
  aiLimit,
  route(async (req, res) => {
    const notes = readNotes(req, res);
    if (notes === null) return;
    const data = await askLLMForJSON(SUMMARY_PROMPT, notes, { config: llmConfig(req) });
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
  aiLimit,
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

    const data = await askLLMForJSON(quizPrompt(counts), notes, { config: llmConfig(req) });
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
    res.json(await getUpcomingAssignments(canvasConfig(req)));
  }),
);

// ---- Accounts ----

app.post(
  '/api/auth/register',
  authLimit,
  route(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = checkPassword(req.body?.password);
    const db = await getDb();
    const user = {
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
    };
    try {
      const { insertedId } = await db.collection('users').insertOne(user);
      user._id = insertedId;
      console.log(`Created account ${email}`);
    } catch (error) {
      if (error?.code === 11000) throw new HttpError(409, 'An account with this email already exists');
      throw error;
    }
    res.status(201).json({ token: await createSession(user._id), user: publicUser(user) });
  }),
);

app.post(
  '/api/auth/login',
  authLimit,
  route(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'Email or password is incorrect');
    }
    res.json({ token: await createSession(user._id), user: publicUser(user) });
  }),
);

// Emails a 6-digit reset code. Answers the same whether or not the account exists.
app.post(
  '/api/auth/forgot-password',
  resetEmailLimit,
  route(async (req, res) => {
    if (!mailConfigured()) throw new MailNotConfiguredError();
    await requestPasswordReset(req.body?.email);
    res.json({ ok: true });
  }),
);

app.post(
  '/api/auth/reset-password',
  resetCodeLimit,
  route(async (req, res) => {
    res.json(await resetPassword(req.body ?? {}));
  }),
);

app.post(
  '/api/auth/logout',
  route(async (req, res) => {
    await deleteSession(req);
    res.status(204).end();
  }),
);

app.get(
  '/api/auth/me',
  route(async (req, res) => {
    res.json({ user: publicUser(await requireUser(req)) });
  }),
);

// ---- Cloud notes (one document per note in the "notes" collection) ----

const MAX_NOTES = 2000;

function cleanNote(note) {
  if (!note || typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.content !== 'string') {
    throw new HttpError(400, 'Notes are not in the expected format');
  }
  const time = (value) => (Number.isFinite(value) ? value : Date.now());
  return {
    id: note.id.slice(0, 100),
    title: note.title,
    content: note.content,
    createdAt: time(note.createdAt),
    updatedAt: time(note.updatedAt),
  };
}

app.get(
  '/api/notes',
  route(async (req, res) => {
    const user = await requireUser(req);
    const db = await getDb();
    const notes = await db
      .collection('notes')
      .find({ userId: user._id }, { projection: { _id: 0, id: 1, title: 1, content: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .toArray();
    // Accounts made before notes had their own collection kept them on the user document.
    res.json({ notes: notes.length > 0 ? notes : (user.notes ?? []) });
  }),
);

app.put(
  '/api/notes',
  route(async (req, res) => {
    const user = await requireUser(req);
    if (!Array.isArray(req.body?.notes) || req.body.notes.length > MAX_NOTES) {
      throw new HttpError(400, `Send a list of at most ${MAX_NOTES} notes`);
    }
    const notes = req.body.notes.map(cleanNote);
    const db = await getDb();
    const collection = db.collection('notes');
    // Upsert every note, then remove any of this user's notes that are no longer in the list.
    if (notes.length > 0) {
      await collection.bulkWrite(
        notes.map((note) => ({
          replaceOne: {
            filter: { userId: user._id, id: note.id },
            replacement: { userId: user._id, email: user.email, ...note },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }
    await collection.deleteMany({ userId: user._id, id: { $nin: notes.map((note) => note.id) } });
    if (user.notes) await db.collection('users').updateOne({ _id: user._id }, { $unset: { notes: '', notesUpdatedAt: '' } });
    res.json({ ok: true, updatedAt: new Date() });
  }),
);

app.get('/api/health', (req, res) => {
  const llm = llmConfig(req);
  res.json({
    ok: true,
    provider: llm.provider,
    ai: llmConfigured(llm),
    canvas: canvasConfigured(canvasConfig(req)),
    database: databaseConfigured(),
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// The built frontend (npm run build). Absent during development, where Vite serves it instead.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: 'index.html', maxAge: '1h' }));
  // The app uses #/hash routes, but send index.html for any other page path too.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Study-Space API on http://localhost:${PORT} (LLM provider: ${llmConfig().provider})`);
  // Connect now so a MongoDB problem shows in this terminal right away (getDb logs the error).
  if (databaseConfigured()) getDb().catch(() => {});
  else console.log('MongoDB is not configured (MONGODB_URI is empty); online accounts are off.');
});
