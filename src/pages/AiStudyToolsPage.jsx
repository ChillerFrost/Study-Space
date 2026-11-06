import { useState } from 'react';
import Banner from '../components/Banner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StudyResults from '../components/StudyResults.jsx';
import {
  GenerationNotConnectedError,
  generateQuiz,
  generateSummary,
} from '../services/studyGenerator.js';

const STUDY_FORMATS = [
  { id: 'multiple-choice', label: 'Multiple Choice' },
  { id: 'true-false', label: 'True/False' },
  { id: 'flashcards', label: 'Flashcards' },
];

const NOT_CONNECTED_HINT = 'Not connected · Future feature';
const IDLE_RESULT = { status: 'idle' };

export default function AiStudyToolsPage() {
  const [notes, setNotes] = useState('');
  const [formats, setFormats] = useState([]);
  const [result, setResult] = useState(IDLE_RESULT);

  const hasNotes = notes.trim().length > 0;
  const hasFormats = formats.length > 0;
  const isLoading = result.status === 'loading';

  const clearFailedResult = () => {
    setResult((current) =>
      current.status === 'not-connected' || current.status === 'error' ? IDLE_RESULT : current,
    );
  };

  const toggleFormat = (id) => {
    setFormats((current) =>
      current.includes(id) ? current.filter((format) => format !== id) : [...current, id],
    );
    clearFailedResult();
  };

  const run = async (kind, generate, request) => {
    setResult({ status: 'loading', kind });
    try {
      setResult({ status: 'success', kind, data: await generate(request) });
    } catch (error) {
      setResult(
        error instanceof GenerationNotConnectedError
          ? { status: 'not-connected', kind }
          : { status: 'error', kind },
      );
    }
  };

  let summaryHint = NOT_CONNECTED_HINT;
  if (isLoading) summaryHint = 'Working...';
  else if (!hasNotes) summaryHint = 'Disabled · Add notes first';

  let quizHint = NOT_CONNECTED_HINT;
  if (isLoading) quizHint = 'Working...';
  else if (!hasNotes && !hasFormats) quizHint = 'Disabled · Add notes and select a format';
  else if (!hasNotes) quizHint = 'Disabled · Add notes first';
  else if (!hasFormats) quizHint = 'Disabled · Select a study format';

  const summaryReady = hasNotes && !isLoading;
  const quizReady = hasNotes && hasFormats && !isLoading;

  return (
    <>
      <PageHeader
        title="AI Study Tools"
        description="Explore the structure for turning notes into study materials."
        tag="US-07 / AC-05"
      />

      <div className="ai-layout">
        <section className="panel ai-input-panel">
          <h2 className="section-title">01&nbsp; Add your notes</h2>
          <label className="label ai-input-label" htmlFor="ai-notes-input">
            NOTES INPUT
          </label>
          <div className="text-box ai-input-box">
            <textarea
              id="ai-notes-input"
              className="text-box-input"
              placeholder="Paste your course notes here..."
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                clearFailedResult();
              }}
            />
            <div className="caption text-box-hint">Stays on this page. Nothing is submitted.</div>
          </div>
          <h3 className="ai-future-title">Future feature</h3>
          <p className="ai-future-copy">
            Notes will provide the source for summaries and quizzes.
          </p>
        </section>

        <div className="ai-column">
          <section className="panel ai-summary-panel">
            <h2 className="section-title">02&nbsp; Summary</h2>
            <p className="ai-summary-copy">A concise overview of the key ideas in your notes.</p>
            <div className="button-row">
              <button
                type="button"
                className="button button-generate"
                disabled={!summaryReady}
                onClick={() => run('summary', generateSummary, { notes })}
              >
                Generate Summary
              </button>
              <span className="caption" role="status">
                {summaryHint}
              </span>
            </div>
          </section>

          <section className="panel ai-quiz-panel">
            <h2 className="section-title">03&nbsp; Quiz &amp; study format</h2>
            <fieldset className="ai-formats">
              <legend className="label">STUDY FORMAT</legend>
              <div className="ai-format-options">
                {STUDY_FORMATS.map((format) => (
                  <label
                    key={format.id}
                    className={formats.includes(format.id) ? 'ai-format is-selected' : 'ai-format'}
                  >
                    <span>{format.label}</span>
                    <input
                      type="checkbox"
                      checked={formats.includes(format.id)}
                      onChange={() => toggleFormat(format.id)}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="button-row">
              <button
                type="button"
                className="button button-generate"
                disabled={!quizReady}
                onClick={() => run('quiz', generateQuiz, { notes, formats })}
              >
                Generate Quiz
              </button>
              <span className="caption" role="status">
                {quizHint}
              </span>
            </div>
          </section>

          <StudyResults result={result} />
        </div>
      </div>

      <Banner heading="NO AI INTEGRATION">
        Notes input and format options work on this page. Generation is not connected: no AI requests or results.
      </Banner>
    </>
  );
}
