import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import QuizReady from '../components/study/QuizReady.jsx';
import QuizSession from '../components/study/QuizSession.jsx';
import SummaryView from '../components/study/SummaryView.jsx';
import {
  GenerationNotConnectedError,
  generateQuiz,
  generateSummary,
} from '../services/studyGenerator.js';
import {
  QUIZ_FORMAT_DEFAULTS,
  SETTINGS_CHANGED_EVENT,
  hasSavedApiKey,
  loadSettings,
} from '../lib/settings.js';

const STUDY_FORMATS = [
  { id: 'multiple-choice', label: 'Multiple Choice' },
  { id: 'true-false', label: 'True/False' },
  { id: 'flashcards', label: 'Flashcards' },
];

// Flashcards are always a six-card deck (Figma). Question counts come from
// Settings › Study defaults › Questions per quiz (default 6 = 4 MC + 2 T/F).
const FLASHCARD_COUNT = 6;

function formatCounts(formats, questionsPerQuiz) {
  const mc = formats.includes('multiple-choice');
  const tf = formats.includes('true-false');
  const counts = {};
  if (mc && tf) {
    counts['multiple-choice'] = Math.round((questionsPerQuiz * 2) / 3);
    counts['true-false'] = questionsPerQuiz - counts['multiple-choice'];
  } else if (mc) counts['multiple-choice'] = questionsPerQuiz;
  else if (tf) counts['true-false'] = questionsPerQuiz;
  if (formats.includes('flashcards')) counts.flashcards = FLASHCARD_COUNT;
  return counts;
}

function studyDefaults() {
  const settings = loadSettings();
  return {
    formats: QUIZ_FORMAT_DEFAULTS[settings.defaultQuizFormat],
    questionsPerQuiz: settings.questionsPerQuiz,
  };
}

// AC-6.2: at least 10 non-whitespace characters.
const MIN_NOTE_CHARACTERS = 10;

// AC-11.8: shown instead when no API key is saved in Settings.
const ADD_KEY_COPY = 'Add your API key in Settings to enable AI generation.';

// AC-6.3 banner copy.
const NOT_CONNECTED_COPY = {
  quiz: 'AI quiz generation pipeline is scheduled for Phase 3 integration.',
  summary: 'AI summary generation pipeline is scheduled for Phase 3 integration.',
};

const BREADCRUMBS = {
  setup: 'Study setup',
  'quiz-ready': 'Generated quiz',
  'quiz-session': 'Generated quiz',
  summary: 'Generated summary',
};

const IDLE = { status: 'idle' };

function formatPlanCaption(counts) {
  const mc = counts['multiple-choice'];
  const tf = counts['true-false'];
  const questionParts = [mc && `${mc} multiple choice`, tf && `${tf} true/false`].filter(Boolean);
  const parts = [];
  if (questionParts.length > 0) parts.push(`${(mc ?? 0) + (tf ?? 0)} questions`, questionParts.join(' + '));
  if (counts.flashcards) parts.push(`${counts.flashcards} flashcards`);
  return parts.length > 0 ? parts.join(' · ') : 'Select at least one format.';
}

export default function AiStudyToolsPage({ onBreadcrumbChange }) {
  const [notes, setNotes] = useState('');
  const [formats, setFormats] = useState(() => studyDefaults().formats);
  const [questionsPerQuiz, setQuestionsPerQuiz] = useState(() => studyDefaults().questionsPerQuiz);
  const [result, setResult] = useState(IDLE);
  const [view, setView] = useState('setup');
  const counts = formatCounts(formats, questionsPerQuiz);

  // New or cleared settings: apply the study defaults and drop any old result (AC-11.9).
  useEffect(() => {
    const onSettingsChanged = () => {
      const defaults = studyDefaults();
      setFormats(defaults.formats);
      setQuestionsPerQuiz(defaults.questionsPerQuiz);
      setResult(IDLE);
      setView('setup');
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, []);

  const noteCharacters = notes.replace(/\s/g, '').length;
  const hasNotes = noteCharacters >= MIN_NOTE_CHARACTERS;
  const hasFormats = formats.length > 0;
  const isLoading = result.status === 'loading';
  // A summary only needs notes; the study formats apply to quizzes alone.
  const canSummarize = hasNotes && !isLoading;
  const canQuiz = hasNotes && hasFormats && !isLoading;

  useEffect(() => {
    onBreadcrumbChange?.(BREADCRUMBS[view]);
  }, [view, onBreadcrumbChange]);

  const showView = (next) => {
    setView(next);
    window.scrollTo(0, 0);
  };

  // AC-6.4: any change to the inputs drops the previous result and its banner.
  const resetResult = () => setResult(IDLE);

  const toggleFormat = (id) => {
    setFormats((current) =>
      current.includes(id) ? current.filter((format) => format !== id) : [...current, id],
    );
    // Formats only affect quizzes, so a summary result or banner stays put.
    setResult((current) => (current.kind === 'quiz' ? IDLE : current));
  };

  const run = async (kind) => {
    if (kind === 'summary' ? !canSummarize : !canQuiz) return;
    setResult({ status: 'loading', kind });
    try {
      if (kind === 'summary') {
        const data = await generateSummary({ notes });
        setResult({ status: 'success', kind, data });
        showView('summary');
      } else {
        const data = await generateQuiz({ notes, formats, counts });
        setResult({ status: 'success', kind, data });
        showView('quiz-ready');
      }
    } catch (error) {
      setResult({
        status: error instanceof GenerationNotConnectedError ? 'not-connected' : 'error',
        kind,
      });
      showView('setup');
    }
  };

  const backToTools = () => showView('setup');

  if (view === 'summary' && result.status === 'success') {
    return (
      <SummaryView
        summary={result.data}
        onRegenerate={() => run('summary')}
        onBack={backToTools}
      />
    );
  }

  if (view === 'quiz-ready' && result.status === 'success') {
    return (
      <QuizReady
        quiz={result.data}
        onStart={() => showView('quiz-session')}
        onRegenerate={() => run('quiz')}
      />
    );
  }

  if (view === 'quiz-session' && result.status === 'success') {
    return <QuizSession quiz={result.data} onBack={backToTools} />;
  }

  const notesHint = `Add at least ${MIN_NOTE_CHARACTERS} characters of notes`;

  let summaryHint = 'From your notes';
  if (isLoading) summaryHint = 'Working...';
  else if (!hasNotes) summaryHint = notesHint;

  let quizHint = 'From your notes';
  if (isLoading) quizHint = 'Working...';
  else if (!hasNotes && !hasFormats) quizHint = 'Add notes and select a format';
  else if (!hasNotes) quizHint = notesHint;
  else if (!hasFormats) quizHint = 'Select a study format';

  const resultBanner = (kind) => {
    if (result.kind !== kind) return null;
    if (result.status === 'not-connected') {
      return (
        <div className="status-banner is-warning" role="status">
          <span className="status-banner-label">RESULTS · NOT CONNECTED</span>
          {' — '}
          {hasSavedApiKey() ? (
            NOT_CONNECTED_COPY[kind]
          ) : (
            <a className="status-banner-link" href="#/settings">
              {ADD_KEY_COPY}
            </a>
          )}
        </div>
      );
    }
    if (result.status === 'error') {
      return (
        <div className="status-banner is-error" role="alert">
          <span className="status-banner-label">RESULTS · ERROR</span>
          {' — '}
          Generation failed. Please try again.
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <PageHeader
        title="AI Study Tools"
        description="Turn your notes into a focused study session."
        tag="STUDY SETUP"
      />

      <div className="ai-layout">
        <section className="panel ai-input-panel" aria-labelledby="ai-notes-title">
          <h2 className="section-title" id="ai-notes-title">
            01&nbsp; Add your notes
          </h2>
          <div className="label ai-input-label">STUDY NOTES</div>
          <label className="ai-input-heading" htmlFor="ai-notes-input">
            Your notes
          </label>
          <textarea
            id="ai-notes-input"
            className="ai-notes-input"
            placeholder="Paste or type your notes here. Summaries, quizzes and flashcards are built from this text."
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              resetResult();
            }}
          />
          <p className="caption ai-input-status" role="status">
            {hasNotes
              ? 'Source ready · used for all study materials'
              : `Add at least ${MIN_NOTE_CHARACTERS} characters to get started`}
          </p>
        </section>

        <div className="ai-column">
          <section className="panel ai-summary-panel" aria-labelledby="ai-summary-title">
            <h2 className="section-title" id="ai-summary-title">
              02&nbsp; Summary
            </h2>
            <p className="ai-panel-copy">Pull out the main ideas, key rules, and worked examples.</p>
            <div className="button-row">
              <button
                type="button"
                className="button button-primary"
                disabled={!canSummarize}
                onClick={() => run('summary')}
              >
                Generate Summary
              </button>
              <span className="caption">{summaryHint}</span>
            </div>
          </section>
          {resultBanner('summary')}

          <section className="panel ai-quiz-panel" aria-labelledby="ai-quiz-title">
            <h2 className="section-title" id="ai-quiz-title">
              03&nbsp; Quiz &amp; study format
            </h2>
            <fieldset className="ai-formats" aria-describedby="ai-formats-copy">
              <legend className="visually-hidden">Study format</legend>
              <p className="ai-panel-copy" id="ai-formats-copy">
                Choose one or more formats to practice.
              </p>
              <div className="ai-format-options">
                {STUDY_FORMATS.map((format) => {
                  const checked = formats.includes(format.id);
                  return (
                    <label key={format.id} className={checked ? 'ai-format is-selected' : 'ai-format'}>
                      <input
                        type="checkbox"
                        className="visually-hidden"
                        checked={checked}
                        onChange={() => toggleFormat(format.id)}
                      />
                      <span>{format.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="caption ai-format-plan">{formatPlanCaption(counts)}</p>
            <div className="button-row">
              <button
                type="button"
                className="button button-primary"
                disabled={!canQuiz}
                onClick={() => run('quiz')}
              >
                Generate Quiz
              </button>
              {!canQuiz && <span className="caption">{quizHint}</span>}
            </div>
          </section>
          {resultBanner('quiz')}

          <section className="ai-promo">
            <div className="label ai-promo-label">ONE SET OF NOTES. MORE WAYS TO LEARN.</div>
            <h2 className="ai-promo-title">Understand it. Then put it to the test.</h2>
            <p className="ai-promo-copy">
              Review a summary, practice questions, or study a six-card deck. Every result is built
              from the notes on the left.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
