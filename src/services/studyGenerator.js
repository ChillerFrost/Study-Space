// Integration point for AI generation (Phase 3). Nothing here calls a model,
// a server, or the network: both functions reject with GenerationNotConnectedError,
// which the AI Study Tools page shows as "RESULTS · NOT CONNECTED".
//
// To connect generation, replace these two functions and resolve with the shapes below.
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

export class GenerationNotConnectedError extends Error {
  constructor() {
    super('AI generation is not connected.');
    this.name = 'GenerationNotConnectedError';
  }
}

export async function generateSummary() {
  throw new GenerationNotConnectedError();
}

export async function generateQuiz() {
  throw new GenerationNotConnectedError();
}
