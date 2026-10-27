/**
 * ELVO Phase 2.3A Recurrence Engine (Client mirror)
 *
 * Deterministic calendar-date arithmetic for recurring tasks (daily, weekly, monthly).
 * Operates purely on UTC calendar date components (YYYY-MM-DD), avoiding local timestamp
 * or daylight saving time (DST) wall-clock drift.
 */

export const isValidISODate = (str) => {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
};

export const toISODateOnly = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    return dateVal;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isLeapYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

export const daysInMonth = (year, month) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const addDaysUTC = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + days));
  const ty = target.getUTCFullYear();
  const tm = String(target.getUTCMonth() + 1).padStart(2, '0');
  const td = String(target.getUTCDate()).padStart(2, '0');
  return `${ty}-${tm}-${td}`;
};

export const addMonthsUTC = (startDateStr, monthsToAdd, originalTargetDay = null) => {
  const [y, m, d] = startDateStr.split('-').map(Number);
  const targetDayBase = originalTargetDay || d;

  const totalMonths = y * 12 + (m - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  const maxDays = daysInMonth(targetYear, targetMonth);
  const finalDay = Math.min(targetDayBase, maxDays);

  const sm = String(targetMonth).padStart(2, '0');
  const sd = String(finalDay).padStart(2, '0');
  return `${targetYear}-${sm}-${sd}`;
};

export const generateOccurrenceDates = ({
  startDate,
  frequency = 'none',
  interval = 1,
  windowStart,
  windowEnd,
  until = null,
  maxOccurrences = 500,
}) => {
  const masterStartStr = toISODateOnly(startDate);
  const winStartStr = toISODateOnly(windowStart);
  const winEndStr = toISODateOnly(windowEnd);
  const untilStr = until ? toISODateOnly(until) : null;

  if (!masterStartStr || !winStartStr || !winEndStr) {
    return [];
  }

  if (!frequency || frequency === 'none') {
    if (masterStartStr >= winStartStr && masterStartStr <= winEndStr) {
      return [masterStartStr];
    }
    return [];
  }

  const validInterval = Math.max(Number(interval) || 1, 1);
  const effectiveEndBound = untilStr && untilStr < winEndStr ? untilStr : winEndStr;

  if (masterStartStr > effectiveEndBound) {
    return [];
  }

  if (untilStr && untilStr < winStartStr) {
    return [];
  }

  const occurrences = [];
  const [sy, sm, sd] = masterStartStr.split('-').map(Number);
  const originalTargetDay = sd;

  if (frequency === 'daily') {
    let current = masterStartStr;
    if (current < winStartStr) {
      const [wy, wm, wd] = winStartStr.split('-').map(Number);
      const startMs = Date.UTC(sy, sm - 1, sd);
      const winStartMs = Date.UTC(wy, wm - 1, wd);
      const diffDays = Math.floor((winStartMs - startMs) / (1000 * 60 * 60 * 24));
      const steps = Math.floor(diffDays / validInterval);
      if (steps > 0) {
        current = addDaysUTC(masterStartStr, steps * validInterval);
      }
      while (current < winStartStr) {
        current = addDaysUTC(current, validInterval);
      }
    }

    let count = 0;
    while (current <= effectiveEndBound && count < maxOccurrences) {
      if (current >= winStartStr && current >= masterStartStr) {
        occurrences.push(current);
      }
      current = addDaysUTC(current, validInterval);
      count++;
    }
  } else if (frequency === 'weekly') {
    const weekIntervalDays = validInterval * 7;
    let current = masterStartStr;

    if (current < winStartStr) {
      const [wy, wm, wd] = winStartStr.split('-').map(Number);
      const startMs = Date.UTC(sy, sm - 1, sd);
      const winStartMs = Date.UTC(wy, wm - 1, wd);
      const diffDays = Math.floor((winStartMs - startMs) / (1000 * 60 * 60 * 24));
      const steps = Math.floor(diffDays / weekIntervalDays);
      if (steps > 0) {
        current = addDaysUTC(masterStartStr, steps * weekIntervalDays);
      }
      while (current < winStartStr) {
        current = addDaysUTC(current, weekIntervalDays);
      }
    }

    let count = 0;
    while (current <= effectiveEndBound && count < maxOccurrences) {
      if (current >= winStartStr && current >= masterStartStr) {
        occurrences.push(current);
      }
      current = addDaysUTC(current, weekIntervalDays);
      count++;
    }
  } else if (frequency === 'monthly') {
    let monthStep = 0;
    if (masterStartStr < winStartStr) {
      const [wy, wm] = winStartStr.split('-').map(Number);
      const diffMonths = (wy - sy) * 12 + (wm - sm);
      const steps = Math.floor(diffMonths / validInterval) * validInterval;
      if (steps > 0) {
        monthStep = steps;
      }
    }

    let current = addMonthsUTC(masterStartStr, monthStep, originalTargetDay);
    while (monthStep > 0 && current > winStartStr) {
      monthStep -= validInterval;
      current = addMonthsUTC(masterStartStr, monthStep, originalTargetDay);
    }
    while (current < winStartStr) {
      monthStep += validInterval;
      current = addMonthsUTC(masterStartStr, monthStep, originalTargetDay);
    }

    let count = 0;
    while (current <= effectiveEndBound && count < maxOccurrences) {
      if (current >= winStartStr && current >= masterStartStr) {
        occurrences.push(current);
      }
      monthStep += validInterval;
      current = addMonthsUTC(masterStartStr, monthStep, originalTargetDay);
      count++;
    }
  }

  return occurrences;
};

export const projectTaskOccurrences = (task, windowStart, windowEnd) => {
  const plainTask = typeof task.toObject === 'function' ? task.toObject({ virtuals: true }) : { ...task };
  const frequency = plainTask.recurrence?.frequency || 'none';
  const winStartStr = toISODateOnly(windowStart);
  const winEndStr = toISODateOnly(windowEnd);

  if (frequency === 'none') {
    const taskDateStr = toISODateOnly(plainTask.startDate);
    if (taskDateStr >= winStartStr && taskDateStr <= winEndStr) {
      return [
        {
          ...plainTask,
          isOccurrence: false,
          masterTaskId: plainTask._id ? plainTask._id.toString() : null,
        },
      ];
    }
    return [];
  }

  const occurrenceDates = generateOccurrenceDates({
    startDate: plainTask.startDate,
    frequency,
    interval: plainTask.recurrence?.interval || 1,
    windowStart,
    windowEnd,
    until: plainTask.recurrence?.until || null,
  });

  const exceptions = Array.isArray(plainTask.recurrenceExceptions)
    ? plainTask.recurrenceExceptions
    : [];
  const exceptionMap = new Map();
  exceptions.forEach((ex) => {
    if (ex && ex.date) {
      exceptionMap.set(ex.date, ex);
    }
  });

  const masterIdStr = plainTask._id ? plainTask._id.toString() : '';
  const result = [];

  // 1. Process naturally generated occurrence dates within the requested window
  occurrenceDates.forEach((occDate) => {
    const ex = exceptionMap.get(occDate);
    // If skipped or cancelled, omit
    if (ex && (ex.action === 'skipped' || ex.action === 'cancelled')) {
      return;
    }
    // If rescheduled to a different date, do NOT render on original date
    if (ex && ex.rescheduledDate && ex.rescheduledDate !== occDate) {
      return;
    }

    const [y, m, d] = occDate.split('-').map(Number);
    const occurrenceStartDateUTC = new Date(Date.UTC(y, m - 1, d));

    result.push({
      ...plainTask,
      _id: plainTask._id,
      occurrenceId: `${masterIdStr}__${occDate}`,
      occurrenceDate: occDate,
      originalOccurrenceDate: occDate,
      masterTaskId: masterIdStr,
      isOccurrence: true,
      startDate: occurrenceStartDateUTC,
      status: ex?.status || plainTask.status,
      ...(ex?.overrides || {}),
    });
  });

  // 2. Project rescheduled occurrences whose destination date falls within the requested window
  exceptions.forEach((ex) => {
    if (!ex || !ex.rescheduledDate || ex.rescheduledDate === ex.date) return;
    if (ex.action === 'skipped' || ex.action === 'cancelled') return;

    const destDate = ex.rescheduledDate;
    if (destDate >= winStartStr && destDate <= winEndStr) {
      const [y, m, d] = destDate.split('-').map(Number);
      const destStartDateUTC = new Date(Date.UTC(y, m - 1, d));

      result.push({
        ...plainTask,
        _id: plainTask._id,
        occurrenceId: `${masterIdStr}__${ex.date}`,
        occurrenceDate: destDate,
        originalOccurrenceDate: ex.date,
        isRescheduled: true,
        masterTaskId: masterIdStr,
        isOccurrence: true,
        startDate: destStartDateUTC,
        status: ex.status || plainTask.status,
        startTime:
          ex.startTime !== undefined && ex.startTime !== null
            ? ex.startTime
            : ex.overrides?.startTime || plainTask.startTime,
        endTime:
          ex.endTime !== undefined && ex.endTime !== null
            ? ex.endTime
            : ex.overrides?.endTime || plainTask.endTime,
        isAllDay:
          ex.isAllDay !== undefined && ex.isAllDay !== null
            ? ex.isAllDay
            : ex.overrides?.isAllDay !== undefined
            ? ex.overrides.isAllDay
            : plainTask.isAllDay,
        ...(ex.overrides || {}),
      });
    }
  });

  return result;
};

export const expandTasksForWindow = (tasks = [], windowStart, windowEnd) => {
  if (!tasks || tasks.length === 0) return [];
  const result = [];
  tasks.forEach((task) => {
    const occurrences = projectTaskOccurrences(task, windowStart, windowEnd);
    result.push(...occurrences);
  });
  result.sort((a, b) => {
    const aDate = toISODateOnly(a.startDate);
    const bDate = toISODateOnly(b.startDate);
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aTime = a.startTime || '00:00';
    const bTime = b.startTime || '00:00';
    return aTime.localeCompare(bTime);
  });
  return result;
};
