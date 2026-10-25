import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from 'date-fns';

export {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
};

/**
 * Extract a YYYY-MM-DD calendar date string from a value produced by the server.
 *
 * The server stores startDate/endDate/dueDate as MongoDB Date objects, which are
 * serialized to JSON as ISO-8601 UTC timestamps (e.g. "2026-10-25T00:00:00.000Z").
 * Parsing such a string into a JS Date and then formatting it with date-fns'
 * `format()` uses the browser's LOCAL timezone, which shifts the date back by
 * one day in UTC-negative timezones (UTC-1 through UTC-12).
 *
 * This helper avoids that shift by reading the date components directly from the
 * UTC portion of the ISO string when the input is a timestamp, or from the string
 * itself when it is already a date-only value (YYYY-MM-DD).
 *
 * Use this function whenever you need the calendar date that the user originally
 * selected, as stored in the database. Do NOT use it for wall-clock computations.
 */
export const toISODate = (date) => {
  if (!date) return '';

  // Already a YYYY-MM-DD calendar-date string — use as-is to avoid any parsing.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  // A full ISO timestamp string (e.g. "2026-10-25T00:00:00.000Z").
  // Extract the UTC date portion directly without local-timezone conversion.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(date)) {
    return date.slice(0, 10);
  }

  // A native Date object (from date-fns operations on calendar cells).
  // These are always created in local time by date-fns, so format() is correct.
  if (date instanceof Date) {
    return format(date, 'yyyy-MM-dd');
  }

  // Fallback: try parseISO for any other string form.
  try {
    const d = parseISO(String(date));
    return format(d, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

// Generate complete 35 or 42 grid slots for a given month
export const getCalendarMatrix = (currentDate, weekStartsOn = 0) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn });
  const endDate = endOfWeek(monthEnd, { weekStartsOn });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return days.map((day) => ({
    date: day,
    isoString: format(day, 'yyyy-MM-dd'),
    dayNumber: format(day, 'd'),
    isCurrentMonth: isSameMonth(day, monthStart),
    isToday: isToday(day),
  }));
};

// Format 24-hour time "14:30" to friendly "2:30 PM"
export const formatDisplayTime = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${ampm}`;
};

/**
 * Compare two HH:mm time strings. Returns negative if a < b, 0 if equal, positive if a > b.
 */
export const compareTime = (a, b) => {
  if (!a || !b) return 0;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah * 60 + am - (bh * 60 + bm);
};

/**
 * Validate the date/time fields of a task form before submission.
 * Returns an array of validation error message strings (empty array = valid).
 *
 * Rules:
 * - startDate is always required (caller should pre-check and not pass empty).
 * - endDate, if provided, must be >= startDate.
 * - dueDate, if provided, must be >= startDate.
 * - startTime and endTime are optional. If BOTH are provided on the SAME calendar day,
 *   endTime must be strictly later than startTime.
 * - For multi-day tasks (endDate > startDate), endTime ordering is not enforced
 *   since the end timestamp is unambiguously later overall.
 * - An absent endTime with a present startTime is valid (open-ended timed task).
 * - isAllDay is not changed here; the caller controls that field.
 */
export const validateTaskDates = ({ startDate, endDate, dueDate, startTime, endTime }) => {
  const errors = [];

  const startDay = toISODate(startDate);
  const endDay = toISODate(endDate);
  const dueDay = toISODate(dueDate);

  if (!startDay) {
    errors.push('Start date is required.');
    return errors; // Can't validate further without startDate
  }

  if (endDay && endDay < startDay) {
    errors.push('End date cannot be earlier than start date.');
  }

  if (dueDay && dueDay < startDay) {
    errors.push('Due date cannot be earlier than start date.');
  }

  // Time validation: only applies when both times are on the same calendar day.
  if (startTime && endTime) {
    const sameDay = !endDay || endDay === startDay;
    if (sameDay && compareTime(endTime, startTime) <= 0) {
      errors.push('End time must be later than start time.');
    }
  }

  return errors;
};

/**
 * Generate 7 days for the week containing currentDate, respecting weekStartsOn (0 = Sun, 1 = Mon).
 */
export const getWeekDays = (currentDate, weekStartsOn = 0) => {
  const start = startOfWeek(currentDate, { weekStartsOn });
  const end = endOfWeek(currentDate, { weekStartsOn });
  const days = eachDayOfInterval({ start, end });

  return days.map((day) => ({
    date: day,
    isoString: format(day, 'yyyy-MM-dd'),
    dayNumber: format(day, 'd'),
    dayName: format(day, 'EEE'),
    dayFullName: format(day, 'EEEE'),
    isToday: isToday(day),
    isSameMonth: isSameMonth(day, currentDate),
  }));
};

/**
 * Format the top-level calendar header label depending on active view mode.
 */
export const formatViewLabel = (date, viewMode = 'month', weekStartsOn = 0) => {
  if (viewMode === 'day') {
    return format(date, 'EEEE, MMMM d, yyyy');
  }

  if (viewMode === 'week') {
    const start = startOfWeek(date, { weekStartsOn });
    const end = endOfWeek(date, { weekStartsOn });
    const sameMonth = isSameMonth(start, end);
    const sameYear = format(start, 'yyyy') === format(end, 'yyyy');

    if (sameMonth) {
      return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
    }
    if (sameYear) {
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
  }

  return format(date, 'MMMM yyyy');
};

/**
 * Partition tasks for a day into all-day tasks and timed tasks,
 * computing overlap-safe layout coordinates for the timed tasks.
 */
export const computeTimedTasksLayout = (tasks = []) => {
  if (!tasks || tasks.length === 0) {
    return { allDayTasks: [], timedTasks: [] };
  }

  const allDayTasks = [];
  const timedRaw = [];

  tasks.forEach((task) => {
    if (task.isAllDay || !task.startTime) {
      allDayTasks.push(task);
    } else {
      timedRaw.push(task);
    }
  });

  if (timedRaw.length === 0) {
    return { allDayTasks, timedTasks: [] };
  }

  const timedItems = timedRaw.map((task) => {
    const [sh, sm] = (task.startTime || '00:00').split(':').map(Number);
    const startMinutes = (isNaN(sh) ? 0 : sh) * 60 + (isNaN(sm) ? 0 : sm);
    let endMinutes;
    if (task.endTime) {
      const [eh, em] = task.endTime.split(':').map(Number);
      const parsedEnd = (isNaN(eh) ? 0 : eh) * 60 + (isNaN(em) ? 0 : em);
      endMinutes = parsedEnd > startMinutes ? parsedEnd : startMinutes + 30;
    } else {
      const est = Number(task.estimatedMinutes);
      endMinutes = startMinutes + (est > 0 ? est : 45);
    }
    // Cap at 24:00 (1440 min)
    endMinutes = Math.min(endMinutes, 1440);
    // Minimum visual duration of 20 minutes
    const duration = Math.max(endMinutes - startMinutes, 20);

    return {
      task,
      startMinutes,
      endMinutes: Math.min(startMinutes + duration, 1440),
      duration,
    };
  });

  // Sort by startMinutes asc, then by duration desc
  timedItems.sort((a, b) => a.startMinutes - b.startMinutes || b.duration - a.duration);

  // Group into overlapping clusters
  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -1;

  for (const item of timedItems) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      clusterEnd = item.endMinutes;
    } else if (item.startMinutes < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMinutes;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const timedTasks = [];

  for (const cluster of clusters) {
    const columns = []; // Track the latest end time for each parallel column

    for (const item of cluster) {
      let assignedCol = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= item.startMinutes) {
          assignedCol = i;
          columns[i] = item.endMinutes;
          break;
        }
      }
      if (assignedCol === -1) {
        assignedCol = columns.length;
        columns.push(item.endMinutes);
      }
      item.column = assignedCol;
    }

    const totalColumns = columns.length;

    for (const item of cluster) {
      timedTasks.push({
        task: item.task,
        startMinutes: item.startMinutes,
        endMinutes: item.endMinutes,
        duration: item.duration,
        column: item.column,
        totalColumns,
        topPercent: (item.startMinutes / 1440) * 100,
        heightPercent: (item.duration / 1440) * 100,
        leftPercent: (item.column / totalColumns) * 100,
        widthPercent: (1 / totalColumns) * 100,
      });
    }
  }

  return { allDayTasks, timedTasks };
};
