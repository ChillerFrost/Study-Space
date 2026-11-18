import { useState } from 'react';
import PageHeader from '../PageHeader.jsx';
import { ProgressHeader, SourceCard, StudySidePanel, TipBox, topicCount } from './StudySide.jsx';

const STAGES = [
  {
    format: 'multiple-choice',
    label: 'MULTIPLE CHOICE',
    title: 'Multiple choice',
    description: 'Choose the best answer, then check your understanding.',
  },
  {
    format: 'true-false',
    label: 'TRUE / FALSE',
    title: 'True / False',
    description: 'Test the concepts behind your notes.',
  },
  {
    format: 'flashcards',
    label: 'FLASHCARDS',
    title: 'Flashcards',
    description: 'Review a concept, recall the answer, then rate your confidence.',
  },
];

const LETTERS = 'ABCDEFGHIJ';

function pageTag(source) {
  return source?.course ? source.course.toUpperCase() : 'GENERATED QUIZ';
}

function BackButton({ onBack }) {
  return (
    <button type="button" className="button button-secondary" onClick={onBack}>
      Back to study tools
    </button>
  );
}

function SessionOutline({ items }) {
  return (
    <ol className="session-outline">
      {items.map((item, index) => (
        <li key={index}>
          <span className="session-outline-number">{String(index + 1).padStart(2, '0')}</span>
          {item.topic ?? `Question ${index + 1}`}
        </li>
      ))}
    </ol>
  );
}

function scoreCaption({ correct, incorrect }) {
  return `${correct} correct · ${incorrect} incorrect`;
}

function QuestionStage({ stage, questions, source, nextLabel, onDone, onBack }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });

  const question = questions[index];
  const isTrueFalse = stage.format === 'true-false';
  const options = isTrueFalse ? [true, false] : question.options;
  const correctValue = isTrueFalse ? question.answer : question.answerIndex;
  const optionValue = (option, optionIndex) => (isTrueFalse ? option : optionIndex);
  const isLast = index === questions.length - 1;
  const isCorrect = selected === correctValue;

  const advance = () => {
    if (isLast) {
      onDone(score);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setChecked(false);
  };

  const check = () => {
    setChecked(true);
    setScore((current) =>
      isCorrect
        ? { ...current, correct: current.correct + 1 }
        : { ...current, incorrect: current.incorrect + 1 },
    );
  };

  const optionState = (value) => {
    if (!checked) return value === selected ? { className: 'is-selected', note: 'Selected' } : null;
    if (value === selected) {
      return isCorrect
        ? { className: 'is-correct', note: 'Your answer · correct' }
        : { className: 'is-incorrect', note: 'Your answer · incorrect' };
    }
    if (value === correctValue) return { className: 'is-correct', note: 'Correct answer' };
    return null;
  };

  return (
    <>
      <PageHeader title={stage.title} description={stage.description} tag={pageTag(source)} />
      <div className="study-layout">
        <section className="panel study-main" aria-live="polite">
          <ProgressHeader label={stage.label} position={[index + 1, questions.length]} />

          {question.topic && <div className="study-topic">{question.topic}</div>}
          <h2 className="study-prompt">{question.prompt}</h2>
          <p className="study-instruction">
            {isTrueFalse ? 'Decide whether the statement is true or false.' : 'Select one answer.'}
          </p>

          <div
            className={isTrueFalse ? 'answer-options is-true-false' : 'answer-options'}
            role="radiogroup"
            aria-label="Answers"
          >
            {options.map((option, optionIndex) => {
              const value = optionValue(option, optionIndex);
              const state = optionState(value);
              const text = isTrueFalse ? (option ? 'True' : 'False') : option;
              return (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={value === selected}
                  disabled={checked}
                  className={`answer-option ${state?.className ?? ''}`}
                  onClick={() => setSelected(value)}
                >
                  {!isTrueFalse && <span className="answer-letter">{LETTERS[optionIndex]}</span>}
                  <span className="answer-text">{text}</span>
                  {state && <span className="answer-note">{state.note}</span>}
                </button>
              );
            })}
          </div>

          {checked && (
            <div className={isCorrect ? 'feedback-box is-correct' : 'feedback-box is-incorrect'}>
              <h3 className="feedback-title">
                {isCorrect ? 'Correct' : 'Not quite'}
                {question.takeaway ? ` — ${question.takeaway}` : '.'}
              </h3>
              {question.explanation && <p className="feedback-body">{question.explanation}</p>}
            </div>
          )}

          <p className="caption study-note">
            {checked
              ? `Based on: ${source?.title ?? 'your notes'}`
              : 'You can change your answer before checking.'}
          </p>

          <div className="study-actions">
            {checked ? (
              <>
                <button type="button" className="button button-primary" onClick={advance}>
                  {isLast ? nextLabel : 'Next question'}
                </button>
                <span className="caption study-score">{scoreCaption(score)}</span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={selected === null}
                  onClick={check}
                >
                  Check answer
                </button>
                <button type="button" className="text-button" onClick={advance}>
                  Skip question
                </button>
              </>
            )}
          </div>
        </section>

        <StudySidePanel title="Your study session" footer={<BackButton onBack={onBack} />}>
          <SourceCard source={source} topics={topicCount(source, questions)} />
          <div className="label study-side-label">SESSION OUTLINE</div>
          <SessionOutline items={questions} />
          {checked ? (
            <TipBox title="Why it matters">{question.whyItMatters}</TipBox>
          ) : (
            <TipBox title="Try it on paper">{question.hint}</TipBox>
          )}
        </StudySidePanel>
      </div>
    </>
  );
}

function FlashcardStage({ stage, cards, source, nextLabel, onDone, onBack }) {
  const [queue, setQueue] = useState(() => cards.map((_, cardIndex) => cardIndex));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [requeued, setRequeued] = useState(() => new Set());
  const [gotIt, setGotIt] = useState(0);

  const card = cards[queue[position]];
  const topics = [...new Set(cards.map((item) => item.topic).filter(Boolean))];

  const move = (nextPosition) => {
    setPosition(nextPosition);
    setRevealed(false);
  };

  const rate = (remembered) => {
    let nextQueue = queue;
    if (remembered) setGotIt((count) => count + 1);
    else if (!requeued.has(queue[position])) {
      nextQueue = [...queue, queue[position]];
      setQueue(nextQueue);
      setRequeued(new Set(requeued).add(queue[position]));
    }
    if (position + 1 >= nextQueue.length) {
      onDone({ correct: gotIt + (remembered ? 1 : 0), incorrect: 0, cards: true });
      return;
    }
    move(position + 1);
  };

  return (
    <>
      <PageHeader title={stage.title} description={stage.description} tag={pageTag(source)} />
      <div className="study-layout">
        <section className="panel study-main" aria-live="polite">
          <ProgressHeader label={stage.label} position={[position + 1, queue.length]} />

          <div className="flashcard">
            <div className="label study-kicker">
              {[card.topic?.toUpperCase(), revealed && 'ANSWER REVEALED'].filter(Boolean).join(' · ') ||
                'FLASHCARD'}
            </div>
            <h2 className="flashcard-front">{card.front}</h2>
            {revealed && (
              <>
                <div className="label flashcard-answer-label">ANSWER</div>
                <div className="flashcard-back">{card.back}</div>
                {card.explanation && <p className="flashcard-explanation">{card.explanation}</p>}
              </>
            )}
            <button type="button" className="text-button is-primary" onClick={() => setRevealed(!revealed)}>
              {revealed ? 'Hide answer' : 'Show answer'}
            </button>
          </div>

          <h3 className="flashcard-question">How well did you remember this?</h3>
          <div className="study-actions is-split">
            <button
              type="button"
              className="button button-secondary"
              disabled={!revealed}
              onClick={() => rate(false)}
            >
              Review again
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!revealed}
              onClick={() => rate(true)}
            >
              {position + 1 >= queue.length ? nextLabel : 'Got it'}
            </button>
          </div>
          <div className="study-actions is-split flashcard-footer">
            <button
              type="button"
              className="text-button"
              disabled={position === 0}
              onClick={() => move(position - 1)}
            >
              Previous card
            </button>
            <span className="caption">
              {revealed ? 'Rate your recall to continue' : 'Reveal the answer, then rate your recall'}
            </span>
          </div>
        </section>

        <StudySidePanel title="Your flashcard deck" footer={<BackButton onBack={onBack} />}>
          <SourceCard source={source} topics={topicCount(source, cards)} />
          <div className="label study-side-label">
            DECK TOPICS · {cards.length} {cards.length === 1 ? 'CARD' : 'CARDS'}
          </div>
          <ul className="session-outline is-plain">
            {topics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
          <TipBox title="Use active recall">Try to say the answer before revealing the other side.</TipBox>
        </StudySidePanel>
      </div>
    </>
  );
}

function SessionComplete({ results, source, onBack }) {
  return (
    <>
      <PageHeader
        title="Session complete"
        description="Here is how this practice session went."
        tag={pageTag(source)}
      />
      <div className="study-layout">
        <section className="panel study-main">
          <div className="study-hero">
            <div className="label study-kicker">SESSION COMPLETE</div>
            <h2 className="study-hero-title">Nice work. Keep practicing.</h2>
          </div>
          <dl className="study-facts is-results">
            {results.map(({ stage, score }) => (
              <div key={stage.format}>
                <dt>{stage.title}</dt>
                <dd>
                  {score.cards ? `${score.correct} cards remembered` : scoreCaption(score)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="study-actions">
            <button type="button" className="button button-primary" onClick={onBack}>
              Back to study tools
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export default function QuizSession({ quiz, onBack }) {
  const stages = STAGES.map((stage) => ({
    stage,
    items: quiz.questions.filter((question) => question.format === stage.format),
  })).filter(({ items }) => items.length > 0);

  const [stageIndex, setStageIndex] = useState(0);
  const [results, setResults] = useState([]);

  const finishStage = (score) => {
    setResults((current) => [...current, { stage: stages[stageIndex].stage, score }]);
    setStageIndex(stageIndex + 1);
    window.scrollTo(0, 0);
  };

  if (stageIndex >= stages.length) {
    return <SessionComplete results={results} source={quiz.source} onBack={onBack} />;
  }

  const { stage, items } = stages[stageIndex];
  const next = stages[stageIndex + 1];
  const props = {
    stage,
    source: quiz.source,
    nextLabel: next ? `Continue to ${next.stage.title.toLowerCase()}` : 'Finish session',
    onDone: finishStage,
    onBack,
  };

  return stage.format === 'flashcards' ? (
    <FlashcardStage key={stage.format} {...props} cards={items} />
  ) : (
    <QuestionStage key={stage.format} {...props} questions={items} />
  );
}
