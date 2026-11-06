import { useMemo, useState } from 'react';
import Banner from '../components/Banner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { demoAssignments } from '../data/demoAssignments.js';
import {
  WEEKDAYS,
  buildMonthCells,
  formatDueDate,
  formatMonth,
  formatShortDate,
  parseDateKey,
  toDateKey,
} from '../lib/calendar.js';

function agendaSubtitle(selectedDate, assignmentsOnDate) {
  if (!selectedDate) return 'Sample assignments · Demo data';
  const count = assignmentsOnDate.length;
  const summary = count === 0 ? 'Nothing due' : `${count} due`;
  return `${formatShortDate(selectedDate)} · ${summary} · Demo data`;
}

export default function CanvasPage({ assignments = demoAssignments }) {
  const sorted = useMemo(
    () => [...assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [assignments],
  );
  const byDate = useMemo(() => {
    const map = new Map();
    sorted.forEach((assignment) => {
      map.set(assignment.dueDate, [...(map.get(assignment.dueDate) ?? []), assignment]);
    });
    return map;
  }, [sorted]);

  // Opens on the first assignment's month so the sample data is always visible.
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const start = sorted[0] ? parseDateKey(sorted[0].dueDate) : new Date();
    return { year: start.getFullYear(), month: start.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);

  const { year, month } = visibleMonth;

  const shiftMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() });
  };

  const selectAssignment = (assignment) => {
    const due = parseDateKey(assignment.dueDate);
    setVisibleMonth({ year: due.getFullYear(), month: due.getMonth() });
    setSelectedDate(assignment.dueDate);
  };

  return (
    <>
      <PageHeader
        title="Canvas"
        description="Assignment planning concepts for a future Canvas connection."
        tag="US-08 / AC-06"
      />

      <div className="canvas-layout">
        <section className="panel calendar-panel">
          <h2 className="section-title">Monthly Calendar</h2>
          <p className="caption calendar-subtitle">Select a date to find its assignments</p>

          <div className="calendar-header">
            <h3 className="calendar-month" aria-live="polite">
              {formatMonth(year, month)}
            </h3>
            <span className="demo-label calendar-demo">Demo data</span>
            <div className="calendar-nav">
              <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                ‹
              </button>
              <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
                ›
              </button>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className="calendar-grid">
            {buildMonthCells(year, month).map((day, index) => {
              if (day === null) return <div key={`blank-${index}`} className="calendar-day" />;

              const key = toDateKey(year, month, day);
              const due = byDate.get(key) ?? [];
              const classes = ['calendar-day'];
              if (due.length > 0) classes.push('has-assignment');
              if (key === selectedDate) classes.push('is-selected');
              const dueText = due.map((item) => `${item.courseCode}: ${item.title}`).join(', ');

              return (
                <button
                  type="button"
                  key={key}
                  className={classes.join(' ')}
                  aria-pressed={key === selectedDate}
                  aria-label={`${formatDueDate(key)}${dueText ? `. Due: ${dueText}` : ''}`}
                  onClick={() => setSelectedDate(key === selectedDate ? null : key)}
                >
                  <span className="calendar-day-number">{day}</span>
                  {due.length > 0 && (
                    <span className="calendar-day-course">
                      {due[0].courseCode}
                      {due.length > 1 ? ` +${due.length - 1}` : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel agenda-panel">
          <h2 className="section-title">Agenda</h2>
          <p className="caption agenda-subtitle" role="status">
            {agendaSubtitle(selectedDate, byDate.get(selectedDate) ?? [])}
          </p>
          <div className="agenda-list">
            {sorted.length === 0 ? (
              <p className="caption">No upcoming assignments.</p>
            ) : (
              sorted.map((assignment) => (
                <button
                  type="button"
                  key={assignment.id}
                  className={
                    assignment.dueDate === selectedDate ? 'assignment-card is-selected' : 'assignment-card'
                  }
                  aria-pressed={assignment.dueDate === selectedDate}
                  onClick={() => selectAssignment(assignment)}
                >
                  <span className="demo-label assignment-demo">Demo data</span>
                  <span className="assignment-course">
                    {assignment.courseCode} · {assignment.courseName}
                  </span>
                  <span className="assignment-title">{assignment.title}</span>
                  <span className="assignment-due">Due {formatDueDate(assignment.dueDate)}</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <Banner heading="Canvas is not connected." headingClassName="banner-title">
        Demo data only. No authentication, course sync, or live assignment data is included.
      </Banner>
    </>
  );
}
