export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CELLS_PER_MONTH = 42;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// Parses YYYY-MM-DD as a local date. new Date(string) would read it as UTC and can shift the day.
export function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatMonth(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatDueDate(key) {
  return parseDateKey(key).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(key) {
  return parseDateKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Six Monday-first rows, so the grid keeps its size in every month. Blank cells are null.
export function buildMonthCells(year, month) {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: CELLS_PER_MONTH }, (_, index) => {
    const day = index - leading + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}
