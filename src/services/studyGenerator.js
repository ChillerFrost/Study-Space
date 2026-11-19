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

// The page checks `instanceof GenerationNotConnectedError` to show "RESULTS · NOT CONNECTED".
// It's thrown when the server isn't running or the LLM provider isn't configured in .env.
export { NotConnectedError as GenerationNotConnectedError };

export async function generateSummary({ notes }) {
  return apiRequest('/summarize', { method: 'POST', body: { notes } });
}

export async function generateQuiz({ notes, formats, counts }) {
  return apiRequest('/quiz', { method: 'POST', body: { notes, formats, counts } });
}
