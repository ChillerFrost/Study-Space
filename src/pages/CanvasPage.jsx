import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Banner from '../components/Banner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { CanvasNotConnectedError, fetchAssignments } from '../services/canvas.js';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings.js';
import {
  WEEKDAYS,
  buildMonthCells,
  formatDueDate,
  formatMonth,
  formatShortDate,
  parseDateKey,
  toDateKey,
} from '../lib/calendar.js';

function agendaSubtitle(selectedDate, assignmentsOnDate, status) {
  if (status === 'loading') return 'Loading assignments...';
  if (status !== 'live') return 'Canvas not connected';
  if (!selectedDate) return 'Upcoming assignments · From Canvas';
  const count = assignmentsOnDate.length;
  const summary = count === 0 ? 'Nothing due' : `${count} due`;
  return `${formatShortDate(selectedDate)} · ${summary} · From Canvas`;
}

const POPOVER_GAP = 6;

// Only real web links from Canvas are shown, never javascript: or other schemes.
function safeLink(url) {
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

function formatDueTime(dueAt) {
  if (!dueAt) return '';
  return new Date(dueAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Click-to-open list of everything due on one day, with links to each assignment in Canvas.
function DayPopover({ dateKey, assignments, position, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose({ restoreFocus: true });
    };
    // Clicks on a day are handled by the day itself, so it can toggle or switch days.
    const onMouseDown = (event) => {
      if (!ref.current?.contains(event.target) && !event.target.closest('.calendar-day')) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  const count = assignments.length;
  return (
    <div
      ref={ref}
      className="day-popover"
      role="dialog"
      aria-labelledby="day-popover-title"
      tabIndex={-1}
      style={position}
    >
      <div className="day-popover-header">
        <div>
          <h4 className="day-popover-title" id="day-popover-title">
            {formatDueDate(dateKey)}
          </h4>
          <div className="caption">{count === 0 ? 'Nothing due' : `${count} due`}</div>
        </div>
        <button
          type="button"
          className="day-popover-close"
          aria-label="Close"
          onClick={() => onClose({ restoreFocus: true })}
        >
          ×
        </button>
      </div>
      {count === 0 ? (
        <p className="caption day-popover-empty">No assignments are due on this day.</p>
      ) : (
        <ul className="day-popover-list">
          {assignments.map((assignment) => {
            const link = safeLink(assignment.url);
            const time = formatDueTime(assignment.dueAt);
            return (
              <li key={assignment.id} className="day-popover-item">
                <span className="assignment-course">
                  {assignment.courseCode} · {assignment.courseName}
                </span>
                {link ? (
                  <a className="day-popover-link" href={link} target="_blank" rel="noopener noreferrer">
                    {assignment.title}
                    <span className="visually-hidden"> (opens Canvas in a new tab)</span>
                  </a>
                ) : (
                  <span className="assignment-title">{assignment.title}</span>
                )}
                {time && <span className="caption">Due {time}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Loads live assignments from the server. The list stays empty until Canvas is connected.
// Reloads when the Canvas URL or token changes on the Settings page.
function useCanvasAssignments() {
  const [state, setState] = useState({ status: 'loading', assignments: [] });
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    const onChange = () => setSettingsVersion((version) => version + 1);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, status: 'loading' }));
    fetchAssignments()
      .then((assignments) => {
        if (!cancelled) setState({ status: 'live', assignments });
      })
      .catch((error) => {
        if (cancelled) return;
        if (!(error instanceof CanvasNotConnectedError)) console.error(error);
        setState({
          status: error instanceof CanvasNotConnectedError ? 'not-connected' : 'error',
          assignments: [],
        });
      });
    return () => {
      cancelled = true;
    };
  }, [settingsVersion]);
  return state;
}

export default function CanvasPage() {
  const { status, assignments } = useCanvasAssignments();
  const isLive = status === 'live';
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
  const [popover, setPopover] = useState(null); // { key, position } | null
  const gridRef = useRef(null);
  const popoverDayRef = useRef(null);

  const closePopover = useCallback(({ restoreFocus = false } = {}) => {
    setPopover(null);
    if (restoreFocus) popoverDayRef.current?.focus();
  }, []);

  // Opens the popover next to the clicked day: below it in the top half of the month, above it lower down.
  const openDay = (key, cell) => {
    if (popover?.key === key) {
      setPopover(null);
      setSelectedDate(null);
      return;
    }
    const grid = gridRef.current;
    const popoverWidth = Math.min(320, grid.clientWidth);
    const left = Math.max(0, Math.min(cell.offsetLeft, grid.clientWidth - popoverWidth));
    const position =
      cell.offsetTop + cell.offsetHeight / 2 < grid.clientHeight / 2
        ? { left, top: cell.offsetTop + cell.offsetHeight + POPOVER_GAP }
        : { left, bottom: grid.clientHeight - cell.offsetTop + POPOVER_GAP };
    popoverDayRef.current = cell;
    setSelectedDate(key);
    setPopover({ key, position: { ...position, width: popoverWidth } });
  };

  useEffect(() => {
    if (status !== 'live' || !sorted[0]) return;
    const start = parseDateKey(sorted[0].dueDate);
    setVisibleMonth({ year: start.getFullYear(), month: start.getMonth() });
  }, [status, sorted]);

  const { year, month } = visibleMonth;

  const shiftMonth = (delta) => {
    setPopover(null);
    const next = new Date(year, month + delta, 1);
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() });
  };

  const selectAssignment = (assignment) => {
    setPopover(null);
    const due = parseDateKey(assignment.dueDate);
    setVisibleMonth({ year: due.getFullYear(), month: due.getMonth() });
    setSelectedDate(assignment.dueDate);
  };

  return (
    <>
      <PageHeader
        title="Canvas"
        description="Upcoming assignments from your Canvas courses."
        tag="US-08 / AC-06"
      />

      <div className="canvas-layout">
        <section className="panel calendar-panel">
          <h2 className="section-title">Monthly Calendar</h2>
          <p className="caption calendar-subtitle">{isLive ? 'Due dates' : 'Canvas not connected'}</p>

          <div className="calendar-header">
            <h3 className="calendar-month" aria-live="polite">
              {formatMonth(year, month)}
            </h3>
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

          <div className="calendar-grid" ref={gridRef}>
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
                  aria-haspopup="dialog"
                  aria-expanded={popover?.key === key}
                  aria-label={`${formatDueDate(key)}${dueText ? `. Due: ${dueText}` : ''}`}
                  onClick={(event) => openDay(key, event.currentTarget)}
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
            {popover && (
              <DayPopover
                dateKey={popover.key}
                assignments={byDate.get(popover.key) ?? []}
                position={popover.position}
                onClose={closePopover}
              />
            )}
          </div>
        </section>

        <section className="panel agenda-panel">
          <h2 className="section-title">Agenda</h2>
          <p className="caption agenda-subtitle" role="status">
            {agendaSubtitle(selectedDate, byDate.get(selectedDate) ?? [], status)}
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

      {status === 'not-connected' && (
        <Banner heading="Canvas is not connected." headingClassName="banner-title">
          Add your Canvas base URL and API token on the Settings page (or CANVAS_BASE_URL and
          CANVAS_API_TOKEN in .env), and start the server (npm run server) to load your real assignments.
        </Banner>
      )}
      {status === 'error' && (
        <Banner heading="Couldn't load Canvas assignments." headingClassName="banner-title">
          Check the server log for the Canvas error.
        </Banner>
      )}
    </>
  );
}
