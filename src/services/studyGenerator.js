// Integration point for AI generation. Nothing here calls a model or a server.
//
// To connect generation, replace these two functions and return:
//   generateSummary({ notes })          -> { summary: string }
//   generateQuiz({ notes, formats })    -> { questions: Question[] }
//
// formats contains any of: 'multiple-choice', 'true-false', 'flashcards'.
// Question is one of:
//   { format: 'multiple-choice', prompt, options: string[], answer: string }
//   { format: 'true-false', prompt, answer: boolean }
//   { format: 'flashcards', front, back }
//
// Then update the "Not connected" hint in AiStudyToolsPage.

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
