import { useState } from 'react';
import PageHeader from '../PageHeader.jsx';
import { SourceCard, StudySidePanel, TipBox, topicCount } from './StudySide.jsx';

// The Notes page listens for this event and adds the summary as a new saved note.
export const SAVE_NOTE_EVENT = 'studyspace:save-note';

function summaryAsText(summary) {
  const sections = summary.sections.map(
    (section, index) => `${String(index + 1).padStart(2, '0')}  ${section.heading}\n${section.body}`,
  );
  return [
    'The big picture',
    summary.overview,
    ...sections,
    summary.reminder,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export default function SummaryView({ summary, onRegenerate, onBack }) {
  const [status, setStatus] = useState('');
  const { sections, source } = summary;
  const course = source?.course ?? source?.title;

  const saveToNotes = () => {
    window.dispatchEvent(
      new CustomEvent(SAVE_NOTE_EVENT, {
        detail: { title: summary.title ?? 'Summary', content: summaryAsText(summary) },
      }),
    );
    setStatus('Saved to Notes.');
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryAsText(summary));
      setStatus('Summary copied.');
    } catch {
      setStatus('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <>
      <PageHeader
        title={summary.title ?? 'Your summary'}
        description="The key ideas from your notes, condensed for a quick review."
        tag="GENERATED SUMMARY"
      />

      <div className="study-layout">
        <section className="panel study-main">
          <div className="study-progress-row">
            <span className="label study-kicker">
              SUMMARY{course ? ` · ${course.toUpperCase()}` : ''}
            </span>
            <span className="caption study-count">
              {sections.length} core {sections.length === 1 ? 'concept' : 'concepts'}
            </span>
          </div>

          <div className="summary-overview">
            <h2 className="summary-overview-title">The big picture</h2>
            <p>{summary.overview}</p>
          </div>

          {sections.map((section, index) => (
            <section key={index} className="summary-section">
              <h3 className="section-title">
                {String(index + 1).padStart(2, '0')}&nbsp; {section.heading}
              </h3>
              <p className="summary-section-body">{section.body}</p>
            </section>
          ))}

          {summary.reminder && <p className="summary-reminder">{summary.reminder}</p>}

          <div className="study-actions is-split">
            <button type="button" className="button button-primary" onClick={saveToNotes}>
              Save to Notes
            </button>
            <button type="button" className="button button-secondary" onClick={copySummary}>
              Copy Summary
            </button>
          </div>
          <p className="caption study-note" role="status">
            {status}
          </p>
        </section>

        <StudySidePanel
          title="Summary source"
          footer={
            <>
              <button type="button" className="button button-secondary" onClick={onRegenerate}>
                Regenerate Summary
              </button>
              <button type="button" className="text-button" onClick={onBack}>
                Back to study tools
              </button>
            </>
          }
        >
          <SourceCard source={source} topics={topicCount(source, sections)} />
          <div className="label study-side-label">WHAT&rsquo;S INCLUDED</div>
          <dl className="study-facts">
            <div>
              <dt>The key ideas</dt>
              <dd>
                {sections.length} connected {sections.length === 1 ? 'concept' : 'concepts'}
              </dd>
            </div>
            <div>
              <dt>The core formulas</dt>
              <dd>Rules to use in your practice</dd>
            </div>
            <div>
              <dt>Worked examples</dt>
              <dd>Values taken from your notes</dd>
            </div>
          </dl>
          <TipBox title="Ready to test yourself?">Use the quiz or flashcards to practice these ideas.</TipBox>
        </StudySidePanel>
      </div>
    </>
  );
}
