// AI generation. These call the Study-Space server (server/index.js), which calls the
// model chosen by LLM_PROVIDER in .env. They resolve with the shapes below.
// The result screens (quiz ready, multiple choice, true/false, flashcards, summary)
// render whatever comes back; the calculus content in the Figma frames is only an example.
//
// generateSummary({ notes }) -> {
//   title?: string,                       // e.g. "Your calculus summary"
//   overview: string,                     // "The big picture"
//   sections: { heading, body }[],        // core concepts
//   reminder?: string,
//   source?: Source,
// }
//
// generateQuiz({ notes, formats, counts }) -> {
//   title: string,                        // e.g. "Calculus I: limits, derivatives & integrals"
//   questions: Question[],
//   source?: Source,
// }
//   formats: any of 'multiple-choice', 'true-false', 'flashcards'
//   counts:  { 'multiple-choice'?: number, 'true-false'?: number, flashcards?: number }
//
// Question (topic, hint and whyItMatters are optional):
//   { format: 'multiple-choice', topic, prompt, options: string[], answerIndex, explanation, hint, whyItMatters }
//   { format: 'true-false', topic, prompt, answer: boolean, explanation, hint, whyItMatters }
//   { format: 'flashcards', topic, front, back, explanation }
//
// Source: { title, course?, topicCount? }  // e.g. { title: 'Calculus I · Lecture 04', course: 'MATH 101' }

import { apiRequest, NotConnectedError } from './api.js';
import { loadSettings, settingsHeaders } from '../lib/settings.js';

// The page checks `instanceof GenerationNotConnectedError` to show "RESULTS · NOT CONNECTED".
// It's thrown when the server isn't running or the LLM provider isn't configured in .env.
export { NotConnectedError as GenerationNotConnectedError };

// Custom AI Instructions from Settings ride along in the request body as `instructions`.
// They are read from storage when the request is sent.
function instructions() {
  return loadSettings().customInstructions.trim() || undefined;
}

export async function generateSummary({ notes }) {
  return apiRequest('/summarize', { method: 'POST', body: { notes, instructions: instructions() } });
}

export async function generateQuiz({ notes, formats, counts }) {
  return apiRequest('/quiz', {
    method: 'POST',
    body: { notes, formats, counts, instructions: instructions() },
  });
}

// AC-11.7 Test Connection. Sends the (possibly unsaved) form values as headers to
// POST /api/llm/test, which should send a minimal completion to the provider and answer 2xx.
// Resolves 'connected', 'failed', 'offline' (the Study-Space server isn't running), or
// 'unavailable' (the server has no test endpoint yet).
export async function testConnection(settings) {
  try {
    await apiRequest('/llm/test', { method: 'POST', headers: settingsHeaders(settings), body: {} });
    return 'connected';
  } catch (error) {
    if (!(error instanceof NotConnectedError) || error.status === 503) return 'failed';
    if (error.status === 404 || error.status === 405) return 'unavailable';
    return 'offline';
  }
}
