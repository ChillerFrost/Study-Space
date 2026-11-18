import PageHeader from '../PageHeader.jsx';
import { SourceCard, StudySidePanel, TipBox, topicCount } from './StudySide.jsx';

const FORMAT_NAMES = {
  'multiple-choice': 'Multiple choice',
  'true-false': 'True / False',
  flashcards: 'Flashcard',
};

const SECONDS_PER_ITEM = 50;

export function quizBreakdown(questions) {
  const count = (format) => questions.filter((question) => question.format === format).length;
  const mc = count('multiple-choice');
  const tf = count('true-false');
  const cards = count('flashcards');
  const parts = [];
  if (mc + tf > 0) {
    parts.push(`${mc + tf} questions`);
    parts.push([mc && `${mc} multiple choice`, tf && `${tf} true/false`].filter(Boolean).join(' + '));
  }
  if (cards) parts.push(`${cards} flashcards`);
  return { mc, tf, cards, parts };
}

export default function QuizReady({ quiz, onStart, onRegenerate }) {
  const { questions, source } = quiz;
  const { mc, tf, cards, parts } = quizBreakdown(questions);
  const minutes = Math.max(1, Math.round((questions.length * SECONDS_PER_ITEM) / 60));
  const formatNames = [
    mc && 'Multiple choice',
    tf && 'True / False',
    cards && 'Flashcards',
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Your quiz is ready"
        description="A practice quiz generated from your notes."
        tag={source?.course ? source.course.toUpperCase() : 'GENERATED QUIZ'}
      />

      <div className="study-layout">
        <section className="panel study-main">
          <div className="study-hero">
            <div className="label study-kicker">READY TO PRACTICE</div>
            <h2 className="study-hero-title">{quiz.title}</h2>
            <div className="caption study-hero-meta">
              {[...parts, `about ${minutes} min`].join(' · ')}
            </div>
          </div>

          <div className="label study-list-label">INCLUDED IN YOUR QUIZ</div>
          <ol className="quiz-outline">
            {questions.map((question, index) => (
              <li key={index} className="quiz-outline-item">
                <span className="quiz-outline-number">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <span className="quiz-outline-prompt">{question.prompt ?? question.front}</span>
                  <span className="caption quiz-outline-format">{FORMAT_NAMES[question.format]}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="caption study-note">Answers are hidden until you check each question.</p>
          <div className="study-actions">
            <button type="button" className="button button-primary" onClick={onStart}>
              Start Quiz
            </button>
            <span className="caption">Practice at your own pace</span>
          </div>
        </section>

        <StudySidePanel
          title="Quiz details"
          footer={
            <button type="button" className="button button-secondary" onClick={onRegenerate}>
              Regenerate Quiz
            </button>
          }
        >
          <SourceCard source={source} topics={topicCount(source, questions)} />
          <div className="label study-side-label">YOUR QUIZ</div>
          <dl className="study-facts">
            <div>
              <dt>Formats</dt>
              <dd>{formatNames.join(' + ')}</dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>
                {mc + tf > 0 ? `${mc + tf} generated from your notes` : 'None selected'}
                {cards > 0 && ` · ${cards} flashcards`}
              </dd>
            </div>
            <div>
              <dt>Pace</dt>
              <dd>Untimed practice</dd>
            </div>
          </dl>
          <TipBox title="Learn as you go">Check each answer for a short explanation.</TipBox>
        </StudySidePanel>
      </div>
    </>
  );
}
