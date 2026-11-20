// Browser-side Canvas client. The real Canvas API call (and the API token) live in server/canvas.js;
// this only talks to our own server.
import { apiRequest, NotConnectedError } from './api.js';

export { NotConnectedError as CanvasNotConnectedError };

// Resolves to [{ id, courseCode, courseName, title, dueAt, dueDate: 'YYYY-MM-DD', url }].
// url is the assignment's page in Canvas.
export async function fetchAssignments() {
  const assignments = await apiRequest('/assignments');
  return assignments.map(({ dueAt, ...rest }) => {
    // Convert to the student's local calendar date, matching src/lib/calendar.js.
    const due = new Date(dueAt);
    const dueDate = [
      due.getFullYear(),
      String(due.getMonth() + 1).padStart(2, '0'),
      String(due.getDate()).padStart(2, '0'),
    ].join('-');
    return { ...rest, dueAt, dueDate };
  });
}
