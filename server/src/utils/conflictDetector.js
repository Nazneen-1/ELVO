import Task from '../models/Task.js';
import Workspace from '../models/Workspace.js';
import {
  toISODateOnly,
  addDaysUTC,
  projectTaskOccurrences,
} from './recurrenceEngine.js';

/**
 * Normalize title by:
 * - Trimming leading and trailing whitespace
 * - Collapsing consecutive internal whitespace into a single space
 * - Lowercasing
 */
export const normalizeTitle = (title) => {
  if (!title || typeof title !== 'string') return '';
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Deterministic exact normalized title equality check.
 * No fuzzy matching.
 */
export const titlesMatch = (title1, title2) => {
  const t1 = normalizeTitle(title1);
  const t2 = normalizeTitle(title2);
  return t1.length > 0 && t1 === t2;
};

/**
 * Return all occupied calendar dates (YYYY-MM-DD) for a given startDate and endDate.
 * - startDate is the starting date.
 * - endDate, when present and >= startDate, is the inclusive final occupied date.
 * - If endDate is absent or <= startDate, occupied date range consists of startDate only.
 * - dueDate is ignored and does not extend the range.
 */
export const getOccupiedDates = (startDate, endDate) => {
  const startStr = toISODateOnly(startDate);
  if (!startStr) return [];
  const endStr = toISODateOnly(endDate);

  if (!endStr || endStr <= startStr) {
    return [startStr];
  }

  const dates = [];
  let current = startStr;
  while (current <= endStr) {
    dates.push(current);
    current = addDaysUTC(current, 1);
  }
  return dates;
};

/**
 * Half-open interval time overlap check:
 * start1 < end2 && end1 > start2
 * Adjacent times (e.g. 09:00-10:00 and 10:00-11:00) do NOT overlap.
 */
export const checkTimeOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return start1 < end2 && end1 > start2;
};

/**
 * Verify user's access to a workspace.
 */
export const verifyWorkspaceAccess = async (workspaceId, userId) => {
  if (!workspaceId) return true;
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    $or: [{ owner: userId }, { 'members.user': userId }],
  });
  return Boolean(workspace);
};

/**
 * Authoritative task conflict detector.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} options.userId - Authenticated user ID
 * @param {string|null} [options.workspaceId] - Target workspace ID (or null for personal)
 * @param {Object} options.candidate - The proposed task payload
 * @param {string} options.candidate.title
 * @param {Date|string} options.candidate.startDate
 * @param {Date|string} [options.candidate.endDate]
 * @param {string} [options.candidate.startTime]
 * @param {string} [options.candidate.endTime]
 * @param {boolean} [options.candidate.isAllDay]
 * @param {string|null} [options.excludeTaskId] - Task ID to exclude from self-conflict
 * @param {string|null} [options.excludeOccurrenceDate] - Original occurrence date to exclude
 * @returns {Promise<Array>} Array of structured conflict records
 */
export const detectTaskConflicts = async ({
  userId,
  workspaceId = null,
  candidate,
  excludeTaskId = null,
  excludeOccurrenceDate = null,
}) => {
  if (!candidate) return [];

  // A task without a scheduled start date must not conflict solely because titles match
  const candidateStart = toISODateOnly(candidate.startDate);
  if (!candidateStart) {
    return [];
  }

  const candidateOccupiedDates = getOccupiedDates(candidate.startDate, candidate.endDate);
  if (candidateOccupiedDates.length === 0) {
    return [];
  }

  const minDate = candidateOccupiedDates[0];
  const maxDate = candidateOccupiedDates[candidateOccupiedDates.length - 1];
  const minDateStart = new Date(`${minDate}T00:00:00.000Z`);
  const maxDateEnd = new Date(`${maxDate}T23:59:59.999Z`);

  // Build workspace/personal filter
  const targetWorkspaceId =
    workspaceId && workspaceId !== 'personal' && workspaceId !== 'all' ? workspaceId : null;

  // Authorization check: ensure user has access to target workspace
  if (targetWorkspaceId) {
    const hasAccess = await verifyWorkspaceAccess(targetWorkspaceId, userId);
    if (!hasAccess) {
      const err = new Error('Access denied to workspace');
      err.statusCode = 403;
      throw err;
    }
  }

  const query = {};
  if (targetWorkspaceId) {
    // Teammates' visible tasks in this workspace
    query.workspaceId = targetWorkspaceId;
  } else {
    // Solo personal tasks for current user
    query.userId = userId;
    query.workspaceId = null;
  }

  // Date criteria: fetch tasks that could occupy dates in [minDate, maxDate]
  query.$or = [
    // 1. Non-recurring tasks overlapping window
    {
      $and: [
        {
          $or: [
            { 'recurrence.frequency': { $exists: false } },
            { 'recurrence.frequency': 'none' },
            { 'recurrence.frequency': null },
          ],
        },
        { startDate: { $lte: maxDateEnd } },
        {
          $or: [
            { endDate: { $gte: minDateStart } },
            { $and: [{ endDate: null }, { startDate: { $gte: minDateStart } }] },
            { $and: [{ endDate: { $exists: false } }, { startDate: { $gte: minDateStart } }] },
          ],
        },
      ],
    },
    // 2. Recurring series that started on or before window end and haven't ended before window start
    {
      $and: [
        { 'recurrence.frequency': { $in: ['daily', 'weekly', 'monthly'] } },
        { startDate: { $lte: maxDateEnd } },
        {
          $or: [
            { 'recurrence.until': null },
            { 'recurrence.until': { $exists: false } },
            { 'recurrence.until': { $gte: minDateStart } },
          ],
        },
      ],
    },
    // 3. Any recurring task with a rescheduled exception landing in this window
    {
      'recurrenceExceptions.rescheduledDate': { $gte: minDate, $lte: maxDate },
    },
  ];

  const dbTasks = await Task.find(query).lean();
  if (!dbTasks || dbTasks.length === 0) {
    return [];
  }

  const excludeIdStr = excludeTaskId ? excludeTaskId.toString() : null;
  const isCandidateTimed =
    !candidate.isAllDay && Boolean(candidate.startTime && candidate.endTime);

  const conflictMap = new Map();

  for (const task of dbTasks) {
    const taskIdStr = task._id.toString();

    // Self-conflict check:
    // If updating a regular or master task (no specific occurrence date):
    if (excludeIdStr && taskIdStr === excludeIdStr && !excludeOccurrenceDate) {
      continue;
    }

    const isRecurring =
      task.recurrence?.frequency && task.recurrence.frequency !== 'none';

    if (isRecurring) {
      // Expand occurrences in the [minDate, maxDate] window
      const projectedOccurrences = projectTaskOccurrences(task, minDate, maxDate);

      for (const occ of projectedOccurrences) {
        // Exclude specific occurrence currently being edited
        if (
          excludeIdStr &&
          taskIdStr === excludeIdStr &&
          excludeOccurrenceDate &&
          occ.originalOccurrenceDate === excludeOccurrenceDate
        ) {
          continue;
        }

        const occDate = occ.occurrenceDate || toISODateOnly(occ.startDate);
        if (!candidateOccupiedDates.includes(occDate)) {
          continue;
        }

        // Evaluate conflict on this date
        const isDuplicateTitle = titlesMatch(candidate.title, occ.title || task.title);
        const isOccTimed =
          !occ.isAllDay && Boolean(occ.startTime && occ.endTime);
        const hasTimeOverlap =
          isCandidateTimed &&
          isOccTimed &&
          checkTimeOverlap(
            candidate.startTime,
            candidate.endTime,
            occ.startTime,
            occ.endTime
          );

        const reasons = [];
        if (isDuplicateTitle) reasons.push('DUPLICATE_TITLE');
        if (hasTimeOverlap) reasons.push('TIME_OVERLAP');

        if (reasons.length > 0) {
          const key = occ.occurrenceId || `${taskIdStr}__${occDate}`;
          if (conflictMap.has(key)) {
            const existing = conflictMap.get(key);
            reasons.forEach((r) => {
              if (!existing.reasons.includes(r)) existing.reasons.push(r);
            });
            if (!existing.occupiedDates.includes(occDate)) {
              existing.occupiedDates.push(occDate);
            }
          } else {
            conflictMap.set(key, {
              taskId: taskIdStr,
              occurrenceId: occ.occurrenceId || `${taskIdStr}__${occDate}`,
              isOccurrence: true,
              originalOccurrenceDate: occ.originalOccurrenceDate || occDate,
              title: occ.title || task.title,
              date: occDate,
              startDate: occDate,
              endDate: null,
              occupiedDates: [occDate],
              startTime: occ.startTime || null,
              endTime: occ.endTime || null,
              isAllDay: Boolean(occ.isAllDay),
              status: occ.status || task.status || 'To Do',
              reasons,
            });
          }
        }
      }
    } else {
      // Non-recurring task
      const existingOccupiedDates = getOccupiedDates(task.startDate, task.endDate);
      const sharedDates = candidateOccupiedDates.filter((d) =>
        existingOccupiedDates.includes(d)
      );

      if (sharedDates.length === 0) {
        continue;
      }

      const isDuplicateTitle = titlesMatch(candidate.title, task.title);
      const isTaskTimed =
        !task.isAllDay && Boolean(task.startTime && task.endTime);
      const hasTimeOverlap =
        isCandidateTimed &&
        isTaskTimed &&
        checkTimeOverlap(
          candidate.startTime,
          candidate.endTime,
          task.startTime,
          task.endTime
        );

      const reasons = [];
      if (isDuplicateTitle) reasons.push('DUPLICATE_TITLE');
      if (hasTimeOverlap) reasons.push('TIME_OVERLAP');

      if (reasons.length > 0) {
        const key = taskIdStr;
        const taskStartStr = toISODateOnly(task.startDate);
        const taskEndStr = toISODateOnly(task.endDate);
        const dateDisplay =
          taskEndStr && taskEndStr !== taskStartStr
            ? `${taskStartStr} to ${taskEndStr}`
            : taskStartStr;

        if (conflictMap.has(key)) {
          const existing = conflictMap.get(key);
          reasons.forEach((r) => {
            if (!existing.reasons.includes(r)) existing.reasons.push(r);
          });
          sharedDates.forEach((d) => {
            if (!existing.occupiedDates.includes(d)) existing.occupiedDates.push(d);
          });
        } else {
          conflictMap.set(key, {
            taskId: taskIdStr,
            occurrenceId: null,
            isOccurrence: false,
            originalOccurrenceDate: null,
            title: task.title,
            date: dateDisplay,
            startDate: taskStartStr,
            endDate: taskEndStr || null,
            occupiedDates: sharedDates,
            startTime: task.startTime || null,
            endTime: task.endTime || null,
            isAllDay: Boolean(task.isAllDay),
            status: task.status || 'To Do',
            reasons,
          });
        }
      }
    }
  }

  return Array.from(conflictMap.values());
};
