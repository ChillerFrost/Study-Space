// Shared pieces of the right-hand panel on the generated study screens.

export function topicCount(source, items) {
  if (source?.topicCount) return source.topicCount;
  return new Set(items.map((item) => item.topic ?? item.heading).filter(Boolean)).size;
}

export function SourceCard({ source, topics }) {
  return (
    <div className="source-card">
      <div className="source-card-title">{source?.title ?? 'Your notes'}</div>
      {source?.course && <span className="source-card-chip">{source.course}</span>}
      <div className="caption source-card-meta">
        Source notes{topics > 0 ? ` · ${topics} ${topics === 1 ? 'topic' : 'topics'}` : ''}
      </div>
    </div>
  );
}

export function TipBox({ title, children }) {
  if (!children) return null;
  return (
    <div className="tip-box">
      <div className="tip-box-title">{title}</div>
      <p className="tip-box-body">{children}</p>
    </div>
  );
}

export function StudySidePanel({ title, children, footer }) {
  return (
    <aside className="panel study-side">
      <h2 className="study-side-title">{title}</h2>
      {children}
      <div className="study-side-footer">{footer}</div>
    </aside>
  );
}

export function ProgressHeader({ label, position }) {
  const [current, total] = position;
  return (
    <>
      <div className="study-progress-row">
        <span className="label study-kicker">{label}</span>
        <span className="caption study-count">
          {label === 'FLASHCARDS' ? 'Card' : 'Question'} {current} of {total}
        </span>
      </div>
      <div
        className="study-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`${current} of ${total}`}
      >
        <div className="study-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </>
  );
}
