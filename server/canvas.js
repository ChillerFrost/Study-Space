// Server-side Canvas API client. The token stays on the server and never reaches the browser.
// CANVAS_BASE_URL should include /api/v1, e.g. https://yourschool.instructure.com/api/v1
import 'dotenv/config';

export class CanvasNotConfiguredError extends Error {
  constructor() {
    super('Missing CANVAS_BASE_URL or CANVAS_API_TOKEN in .env');
    this.name = 'CanvasNotConfiguredError';
  }
}

export function canvasConfigured() {
  return Boolean(process.env.CANVAS_BASE_URL && process.env.CANVAS_API_TOKEN);
}

export async function canvasGet(path) {
  if (!canvasConfigured()) throw new CanvasNotConfiguredError();
  const base = process.env.CANVAS_BASE_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${process.env.CANVAS_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Canvas error ${res.status} on ${path}`);
  return res.json();
}

// "ART 1020: Digital Imaging Fundamentals (0) (10287-202710)" -> "ART 1020", so it fits calendar cells.
function shortCourseCode(code) {
  const match = /^[A-Za-z]{2,5}\s*-?\s*\d{3,4}[A-Za-z]?/.exec(code.trim());
  return match ? match[0] : code.split(':')[0].trim();
}

// Upcoming assignments from all active courses, in the shape the Canvas page expects
// (dueAt is an ISO timestamp; the browser turns it into a local calendar date).
export async function getUpcomingAssignments() {
  const courses = await canvasGet('/courses?enrollment_state=active&per_page=50');
  const perCourse = await Promise.all(
    courses
      .filter((course) => course.id && course.name)
      .map(async (course) => {
        try {
          const assignments = await canvasGet(
            `/courses/${course.id}/assignments?bucket=future&order_by=due_at&per_page=50`,
          );
          return assignments
            .filter((assignment) => assignment.due_at)
            .map((assignment) => ({
              id: `${course.id}-${assignment.id}`,
              courseCode: shortCourseCode(course.course_code ?? course.name),
              courseName: course.name,
              title: assignment.name,
              dueAt: assignment.due_at,
              url: assignment.html_url,
            }));
        } catch {
          // One course without assignment access shouldn't hide the others.
          return [];
        }
      }),
  );
  return perCourse.flat();
}
