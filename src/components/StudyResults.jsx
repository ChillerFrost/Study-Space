const KIND_LABELS = { summary: 'Summary', quiz: 'Quiz' };

const STATUS_LABELS = {
  idle: 'EMPTY STATE',
  loading: 'LOADING',
  'not-connected': 'NOT CONNECTED',
  error: 'ERROR',
  success: 'READY',
};

function QuestionGroup({ title, children }) {
  return (
    <div className="results-group">
      <h3 className="results-group-title">{title}</h3>
      <ol className="results-list">{children}</ol>
    </div>
  );
}

function QuizResult({ questions }) {
  const byFormat = (format) => questions.filter((question) => question.format === format);
  const multipleChoice = byFormat('multiple-choice');
  const trueFalse = byFormat('true-false');
  const flashcards = byFormat('flashcards');

  return (
    <>
      {multipleChoice.length > 0 && (
        <QuestionGroup title="Multiple Choice">
          {multipleChoice.map((question, index) => (
            <li key={index}>
              <div>{question.prompt}</div>
              <ul className="results-options">
                {question.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
              <div className="caption">Answer: {question.answer}</div>
            </li>
          ))}
        </QuestionGroup>
      )}
      {trueFalse.length > 0 && (
        <QuestionGroup title="True/False">
          {trueFalse.map((question, index) => (
            <li key={index}>
              <div>{question.prompt}</div>
              <div className="caption">Answer: {question.answer ? 'True' : 'False'}</div>
            </li>
          ))}
        </QuestionGroup>
      )}
      {flashcards.length > 0 && (
        <QuestionGroup title="Flashcards">
          {flashcards.map((card, index) => (
            <li key={index}>
              <div>{card.front}</div>
              <div className="caption">{card.back}</div>
            </li>
          ))}
        </QuestionGroup>
      )}
    </>
  );
}

export default function StudyResults({ result }) {
  const { status, kind, data } = result;
  const kindLabel = KIND_LABELS[kind];

  return (
    <section className="panel results-panel" aria-live="polite">
      <div className="label">RESULTS · {STATUS_LABELS[status]}</div>
      {status === 'idle' && <p className="results-message">Generated study materials will appear here.</p>}
      {status === 'loading' && <p className="results-message">Generating {kindLabel.toLowerCase()}...</p>}
      {status === 'not-connected' && (
        <p className="results-message">
          {kindLabel} generation is not connected yet. No request was sent and nothing was generated.
        </p>
      )}
      {status === 'error' && (
        <p className="results-message is-error">{kindLabel} generation failed. Please try again.</p>
      )}
      {status === 'success' && kind === 'summary' && <p className="results-body">{data.summary}</p>}
      {status === 'success' && kind === 'quiz' && <QuizResult questions={data.questions} />}
    </section>
  );
}
