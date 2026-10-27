import Task from '../models/Task.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Notification from '../models/Notification.js';
import ReminderJob from '../models/ReminderJob.js';
import { config } from '../config/env.js';
import { sendTaskReminderEmail } from './emailService.js';
import { projectTaskOccurrences, toISODateOnly, addDaysUTC } from './recurrenceEngine.js';

/**
 * Validate an IANA timezone identifier safely.
 */
export const isValidTimezone = (tz) => {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
};

/**
 * Format minutes before into a friendly human-readable label.
 * E.g. 5 -> "5m reminder", 60 -> "1h reminder", 1440 -> "1d reminder"
 */
export const formatReminderLeadTime = (minutes) => {
  const m = Number(minutes);
  if (!m || isNaN(m) || m <= 0) return 'Reminder';
  if (m < 60) return `${m}m reminder`;
  if (m < 1440) {
    const hours = Math.round(m / 60);
    return `${hours}h reminder`;
  }
  const days = Math.round(m / 1440);
  return `${days}d reminder`;
};

/**
 * Combine a calendar date (YYYY-MM-DD) and a local time (HH:mm) in a specified timezone,
 * returning the exact UTC Date instant using two-pass convergence and explicit DST policies:
 *
 * DST Edge-Case Policies:
 * 1. Nonexistent local times during spring-forward (gap):
 *    - Advance the requested local time by the DST gap.
 *    - Example: 2026-03-08 02:30 in America/New_York advances across the 1-hour gap
 *      to 03:30 EDT, resolving to 2026-03-08T07:30:00.000Z.
 * 2. Ambiguous local times during fall-back (overlap):
 *    - Select the earlier occurrence (e.g. Daylight Time occurrence).
 *    - Example: 2026-11-01 01:30 in America/New_York selects the first occurrence (01:30 EDT),
 *      resolving to 2026-11-01T05:30:00.000Z.
 */
export const calculateEventInstant = ({ dateStr, timeStr = '00:00', timezone = 'UTC' }) => {
  const tz = isValidTimezone(timezone) ? timezone.trim() : 'UTC';
  let cleanDate = '';
  if (typeof dateStr === 'string') {
    cleanDate = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  } else if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    cleanDate = dateStr.toISOString().slice(0, 10);
  } else if (dateStr) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) cleanDate = d.toISOString().slice(0, 10);
    } catch {
      cleanDate = '';
    }
  }
  if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    cleanDate = new Date().toISOString().slice(0, 10);
  }

  const cleanTime = timeStr && /^\d{1,2}:\d{2}$/.test(timeStr) ? timeStr.padStart(5, '0') : '00:00';
  const [year, month, day] = cleanDate.split('-').map(Number);
  const [hour, minute] = cleanTime.split(':').map(Number);

  // Initial UTC guess
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  if (tz.toUpperCase() === 'UTC' || tz === 'Etc/UTC') {
    return guessUtc;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const getParts = (d) => {
      const parts = formatter.formatToParts(d);
      const m = {};
      for (const p of parts) m[p.type] = p.value;
      const h = parseInt(m.hour === '24' ? '0' : m.hour, 10);
      const min = parseInt(m.minute, 10);
      const dy = parseInt(m.day, 10);
      const mo = parseInt(m.month, 10);
      const yr = parseInt(m.year, 10);
      const inTzUtcTime = Date.UTC(yr, mo - 1, dy, h, min, 0, 0);
      return {
        inTzUtcTime,
        offsetMs: inTzUtcTime - d.getTime(),
        matchesTarget: yr === year && mo === month && dy === day && h === hour && min === minute,
      };
    };

    // Pass 1: sample offset at guessUtc
    const p1 = getParts(guessUtc);
    const candidateUtc = new Date(guessUtc.getTime() - p1.offsetMs);
    const p2 = getParts(candidateUtc);

    // Pass 2: check candidate with updated offset
    const pass2Utc = new Date(guessUtc.getTime() - p2.offsetMs);
    const p3 = getParts(pass2Utc);

    // Collect candidates that match requested local time exactly
    const exactMatches = [];
    if (p2.matchesTarget) exactMatches.push(candidateUtc);
    if (p3.matchesTarget && pass2Utc.getTime() !== candidateUtc.getTime()) {
      exactMatches.push(pass2Utc);
    }

    if (exactMatches.length > 0) {
      // Ambiguous fall-back policy: Select the earlier occurrence
      exactMatches.sort((a, b) => a.getTime() - b.getTime());
      return exactMatches[0];
    }

    // Nonexistent local time policy (spring-forward gap):
    // Advance requested local time by the DST gap.
    // Between candidateUtc and pass2Utc, one retreated before the gap (inTzUtcTime < guessUtc),
    // and the other advanced after the gap (inTzUtcTime > guessUtc). Select the advanced one.
    if (p2.inTzUtcTime > guessUtc.getTime()) {
      return candidateUtc;
    }
    if (p3.inTzUtcTime > guessUtc.getTime()) {
      return pass2Utc;
    }

    return candidateUtc;
  } catch {
    return guessUtc;
  }
};

/**
 * Calculate the exact UTC Date instant when a reminder should fire.
 * All-day policy: anchored to 09:00 AM in the specified timezone.
 */
export const calculateReminderFireTime = ({
  startDate,
  startTime = null,
  isAllDay = false,
  minutesBefore = 15,
  timezone = 'UTC',
}) => {
  const leadMinutes = Number(minutesBefore) || 15;
  const isValidTime = startTime && /^\d{1,2}:\d{2}$/.test(startTime);
  const effectiveTime = isAllDay || !isValidTime ? '09:00' : startTime;
  const eventInstant = calculateEventInstant({
    dateStr: startDate,
    timeStr: effectiveTime,
    timezone,
  });
  return new Date(eventInstant.getTime() - leadMinutes * 60 * 1000);
};

/**
 * Extract recipient user IDs (creator and assignee), deduplicating if creator == assignee.
 */
export const getEligibleRecipientIds = (task) => {
  const creatorId = task.userId?._id ? task.userId._id.toString() : task.userId?.toString();
  const assigneeId = task.assignedTo?._id ? task.assignedTo._id.toString() : task.assignedTo?.toString();
  const set = new Set();
  if (creatorId) set.add(creatorId);
  if (assigneeId) set.add(assigneeId);
  return Array.from(set);
};

/**
 * Synchronize ReminderJob records for a task upon create, update, or patch.
 * Ensures obsolete jobs from previous dates or unassigned recipients are cancelled.
 */
export const syncTaskReminders = async (task, options = {}) => {
  if (!task || !task._id) return;

  const taskId = task._id;

  // 1. If master task is completed or reminders are disabled, clean up pending jobs and cancel in-flight ones
  if (task.status === 'Done' || !task.reminder?.enabled) {
    await ReminderJob.deleteMany({
      taskId,
      status: 'pending',
    });
    await ReminderJob.updateMany(
      {
        taskId,
        status: { $in: ['processing', 'failed'] },
      },
      {
        $set: {
          status: 'cancelled',
          failedReason: task.status === 'Done' ? 'Task completed' : 'Reminders disabled',
          lockedAt: null,
          lockedBy: null,
        },
      }
    );
    return;
  }

  // 2. Resolve eligible recipients
  const recipientIds = getEligibleRecipientIds(task);
  if (recipientIds.length === 0) return;

  // Clean up any pending jobs for recipients who are no longer assigned
  await ReminderJob.deleteMany({
    taskId,
    userId: { $nin: recipientIds },
    status: 'pending',
  });
  await ReminderJob.updateMany(
    {
      taskId,
      userId: { $nin: recipientIds },
      status: { $in: ['processing', 'failed'] },
    },
    {
      $set: {
        status: 'cancelled',
        failedReason: 'Recipient unassigned from task',
        lockedAt: null,
        lockedBy: null,
      },
    }
  );

  // 3. Resolve task owner's persistent timezone preference (with UTC fallback)
  let timezone = 'UTC';
  if (task.userId) {
    if (task.userId.preferences?.timezone && isValidTimezone(task.userId.preferences.timezone)) {
      timezone = task.userId.preferences.timezone;
    } else {
      const owner = await User.findById(task.userId).select('preferences.timezone');
      if (owner?.preferences?.timezone && isValidTimezone(owner.preferences.timezone)) {
        timezone = owner.preferences.timezone;
      }
    }
  }

  const leadMinutes = Number(task.reminder.minutesBefore) || 15;
  const isRecurring = Boolean(task.recurrence?.frequency && task.recurrence.frequency !== 'none');

  if (!isRecurring) {
    // -------------------------------------------------------------
    // NON-RECURRING TASK LOGIC (Preserve 100% of existing behavior)
    // -------------------------------------------------------------
    const startDateStr = typeof task.startDate === 'string'
      ? (task.startDate.includes('T') ? task.startDate.slice(0, 10) : task.startDate)
      : new Date(task.startDate).toISOString().slice(0, 10);

    const isAllDay = Boolean(task.isAllDay || (!task.startTime && !task.endTime));

    const fireTime = calculateReminderFireTime({
      startDate: startDateStr,
      startTime: task.startTime || null,
      isAllDay,
      minutesBefore: leadMinutes,
      timezone,
    });

    // Clean up any obsolete pending jobs for previous dates or old recurrence series
    await ReminderJob.deleteMany({
      taskId,
      $or: [
        { taskStartDate: { $ne: startDateStr } },
        { occurrenceKey: { $ne: 'single' } },
      ],
      status: 'pending',
    });
    await ReminderJob.updateMany(
      {
        taskId,
        $or: [
          { taskStartDate: { $ne: startDateStr } },
          { occurrenceKey: { $ne: 'single' } },
        ],
        status: { $in: ['processing', 'failed'] },
      },
      {
        $set: {
          status: 'cancelled',
          failedReason: 'Task schedule or recurrence changed',
          lockedAt: null,
          lockedBy: null,
        },
      }
    );

    for (const recipientId of recipientIds) {
      const existingJob = await ReminderJob.findOne({
        taskId,
        userId: recipientId,
        occurrenceKey: 'single',
      });

      if (existingJob) {
        const dateChanged = existingJob.taskStartDate !== startDateStr;
        const timeChanged = existingJob.fireTime.getTime() !== fireTime.getTime();
        const tzChanged = existingJob.timezone !== timezone;
        const titleChanged = existingJob.taskTitle !== task.title;

        if (existingJob.status !== 'sent' || dateChanged || timeChanged || tzChanged) {
          existingJob.taskStartDate = startDateStr;
          existingJob.taskTitle = task.title;
          existingJob.taskStartTime = task.startTime || null;
          existingJob.isAllDay = isAllDay;
          existingJob.minutesBefore = leadMinutes;
          existingJob.fireTime = fireTime;
          existingJob.timezone = timezone;
          existingJob.status = 'pending';
          existingJob.channelStatus = {
            inApp: { status: 'pending', sentAt: null, notificationId: null, error: null },
            email: { status: 'pending', sentAt: null, error: null },
          };
          existingJob.attemptCount = 0;
          existingJob.nextAttemptAt = null;
          existingJob.lockedAt = null;
          existingJob.lockedBy = null;
          existingJob.failedReason = null;
          existingJob.isRecurring = false;
          existingJob.occurrenceDate = null;
          existingJob.originalOccurrenceDate = null;
          existingJob.occurrenceKey = 'single';
          await existingJob.save();
        } else if (titleChanged) {
          existingJob.taskTitle = task.title;
          await existingJob.save();
        }
      } else {
        try {
          await ReminderJob.create({
            taskId,
            userId: recipientId,
            taskStartDate: startDateStr,
            taskStartTime: task.startTime || null,
            isAllDay,
            taskTitle: task.title,
            minutesBefore: leadMinutes,
            fireTime,
            timezone,
            status: 'pending',
            isRecurring: false,
            occurrenceKey: 'single',
            nextAttemptAt: null,
          });
        } catch (err) {
          if (err.code === 11000) {
            // Concurrent duplicate write race: update existing
            await ReminderJob.updateOne(
              { taskId, userId: recipientId, occurrenceKey: 'single' },
              {
                $set: {
                  taskStartDate: startDateStr,
                  taskStartTime: task.startTime || null,
                  isAllDay,
                  taskTitle: task.title,
                  minutesBefore: leadMinutes,
                  fireTime,
                  timezone,
                  status: 'pending',
                  isRecurring: false,
                },
              }
            );
          } else {
            throw err;
          }
        }
      }
    }
  } else {
    // -------------------------------------------------------------
    // RECURRING TASK LOGIC (Stage 3.2 Occurrence Reminders & Stage 3.4 Queue Identity)
    // -------------------------------------------------------------
    const now = new Date();
    const todayStr = toISODateOnly(now);
    const masterStartStr = toISODateOnly(task.startDate);
    const windowStartStr = masterStartStr && masterStartStr > todayStr ? masterStartStr : todayStr;
    const windowDays = Number(options.windowDays) || 60;
    const windowEndStr = addDaysUTC(windowStartStr, windowDays);

    // Project occurrences in the bounded rolling window
    const projectedOccurrences = projectTaskOccurrences(task, windowStartStr, windowEndStr);

    const eligibleOccurrences = [];
    for (const occ of projectedOccurrences) {
      // Exclude completed or skipped occurrences
      if (occ.status === 'Done') continue;
      if (occ.action === 'skipped' || occ.action === 'cancelled') continue;

      const occDate = occ.occurrenceDate || toISODateOnly(occ.startDate);
      if (!occDate) continue;

      const occTime = occ.startTime || null;
      const isAllDay = Boolean(occ.isAllDay || (!occ.startTime && !occ.endTime));

      const fireTime = calculateReminderFireTime({
        startDate: occDate,
        startTime: occTime,
        isAllDay,
        minutesBefore: leadMinutes,
        timezone,
      });

      // Avoid creating new jobs for occurrences whose fire time has already passed long ago (>2h)
      if (fireTime.getTime() < now.getTime() - 2 * 60 * 60 * 1000) {
        continue;
      }

      const occurrenceKey = occ.originalOccurrenceDate || occDate;

      eligibleOccurrences.push({
        occDate,
        originalOccurrenceDate: occ.originalOccurrenceDate || occDate,
        occurrenceKey,
        occTime,
        isAllDay,
        fireTime,
        title: occ.title || task.title,
      });
    }

    const eligibleKeysSet = new Set(eligibleOccurrences.map((o) => o.occurrenceKey));

    // Clean up any pending jobs inside the active projection window that are no longer eligible
    // (e.g. occurrence completed, skipped, cancelled, or rescheduled).
    // Scoped strictly to the active window [windowStartStr, windowEndStr] so jobs outside the window survive.
    await ReminderJob.deleteMany({
      taskId,
      taskStartDate: {
        $gte: windowStartStr,
        $lte: windowEndStr,
      },
      occurrenceKey: { $nin: Array.from(eligibleKeysSet) },
      status: 'pending',
    });
    await ReminderJob.updateMany(
      {
        taskId,
        taskStartDate: {
          $gte: windowStartStr,
          $lte: windowEndStr,
        },
        occurrenceKey: { $nin: Array.from(eligibleKeysSet) },
        status: { $in: ['processing', 'failed'] },
      },
      {
        $set: {
          status: 'cancelled',
          failedReason: 'Occurrence completed, skipped, or rescheduled',
          lockedAt: null,
          lockedBy: null,
        },
      }
    );

    // Keep taskTitle up-to-date across all jobs for this task
    await ReminderJob.updateMany(
      { taskId, taskTitle: { $ne: task.title } },
      { $set: { taskTitle: task.title } }
    );

    // Synchronize reminder jobs for each eligible occurrence and recipient
    for (const occ of eligibleOccurrences) {
      for (const recipientId of recipientIds) {
        const existingJob = await ReminderJob.findOne({
          taskId,
          userId: recipientId,
          occurrenceKey: occ.occurrenceKey,
        });

        if (existingJob) {
          const dateChanged = existingJob.taskStartDate !== occ.occDate;
          const timeChanged = existingJob.fireTime.getTime() !== occ.fireTime.getTime();
          const tzChanged = existingJob.timezone !== timezone;
          const titleChanged = existingJob.taskTitle !== occ.title;
          const origDateChanged = existingJob.originalOccurrenceDate !== occ.originalOccurrenceDate;

          if (existingJob.status !== 'sent' || dateChanged || timeChanged || tzChanged) {
            existingJob.taskStartDate = occ.occDate;
            existingJob.taskTitle = occ.title;
            existingJob.taskStartTime = occ.occTime;
            existingJob.isAllDay = occ.isAllDay;
            existingJob.minutesBefore = leadMinutes;
            existingJob.fireTime = occ.fireTime;
            existingJob.timezone = timezone;
            existingJob.status = 'pending';
            existingJob.channelStatus = {
              inApp: { status: 'pending', sentAt: null, notificationId: null, error: null },
              email: { status: 'pending', sentAt: null, error: null },
            };
            existingJob.attemptCount = 0;
            existingJob.nextAttemptAt = null;
            existingJob.lockedAt = null;
            existingJob.lockedBy = null;
            existingJob.failedReason = null;
            existingJob.isRecurring = true;
            existingJob.occurrenceDate = occ.occDate;
            existingJob.originalOccurrenceDate = occ.originalOccurrenceDate;
            existingJob.occurrenceKey = occ.occurrenceKey;
            await existingJob.save();
          } else if (titleChanged || origDateChanged) {
            existingJob.taskTitle = occ.title;
            existingJob.originalOccurrenceDate = occ.originalOccurrenceDate;
            await existingJob.save();
          }
        } else {
          try {
            await ReminderJob.create({
              taskId,
              userId: recipientId,
              taskStartDate: occ.occDate,
              taskStartTime: occ.occTime,
              isAllDay: occ.isAllDay,
              taskTitle: occ.title,
              minutesBefore: leadMinutes,
              fireTime: occ.fireTime,
              timezone,
              status: 'pending',
              isRecurring: true,
              occurrenceDate: occ.occDate,
              originalOccurrenceDate: occ.originalOccurrenceDate,
              occurrenceKey: occ.occurrenceKey,
              nextAttemptAt: null,
            });
          } catch (err) {
            if (err.code === 11000) {
              // Concurrent duplicate write race: update existing
              await ReminderJob.updateOne(
                { taskId, userId: recipientId, occurrenceKey: occ.occurrenceKey },
                {
                  $set: {
                    taskStartDate: occ.occDate,
                    taskStartTime: occ.occTime,
                    isAllDay: occ.isAllDay,
                    taskTitle: occ.title,
                    minutesBefore: leadMinutes,
                    fireTime: occ.fireTime,
                    timezone,
                    status: 'pending',
                    isRecurring: true,
                    occurrenceDate: occ.occDate,
                    originalOccurrenceDate: occ.originalOccurrenceDate,
                  },
                }
              );
            } else {
              throw err;
            }
          }
        }
      }
    }
  }
};

/**
 * Remove all reminder jobs when a task is permanently deleted.
 */
export const cleanupTaskReminders = async (taskId) => {
  if (!taskId) return;
  await ReminderJob.deleteMany({ taskId });
};

let isShuttingDown = false;
let activeProcessingCount = 0;

export const isSchedulerShuttingDown = () => isShuttingDown;
export const getActiveProcessingCount = () => activeProcessingCount;

export const resetSchedulerShutdown = () => {
  isShuttingDown = false;
};

/**
 * Gracefully wait for any active reminder processing to complete.
 * Allows in-flight processing batches to complete cleanly without interrupting them.
 */
export const gracefulSchedulerShutdown = async ({ timeoutMs = 10000 } = {}) => {
  isShuttingDown = true;
  const start = Date.now();
  while (activeProcessingCount > 0 && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return {
    completedCleanly: activeProcessingCount === 0,
    remainingActive: activeProcessingCount,
  };
};

/**
 * Process due and overdue reminder jobs in batches using atomic conditional claims.
 * Handles catch-up after downtime, channel-specific retry isolation, bounded exponential backoff,
 * and stale job invalidation if task schedule changed while claimed.
 */
export const processReminderJobs = async ({
  batchSize = 50,
  leaseDurationMs = 5 * 60 * 1000,
  workerId = `worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
} = {}) => {
  const stats = {
    processed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  if (isShuttingDown) {
    return { ...stats, shutdown: true };
  }

  activeProcessingCount++;
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - leaseDurationMs);

  try {
    const candidates = await ReminderJob.find({
      $or: [
        {
          status: 'pending',
          fireTime: { $lte: now },
          $or: [
            { nextAttemptAt: null },
            { nextAttemptAt: { $lte: now } },
          ],
        },
        { status: 'processing', lockedAt: { $lte: leaseCutoff } },
      ],
    })
      .sort({ fireTime: 1 })
      .limit(batchSize)
      .lean();

    if (!candidates || candidates.length === 0) {
      return stats;
    }

    for (const candidate of candidates) {
      const job = await ReminderJob.findOneAndUpdate(
        {
          _id: candidate._id,
          $or: [
            {
              status: 'pending',
              fireTime: { $lte: now },
              $or: [
                { nextAttemptAt: null },
                { nextAttemptAt: { $lte: now } },
              ],
            },
            { status: 'processing', lockedAt: { $lte: leaseCutoff } },
          ],
        },
        {
          $set: {
            status: 'processing',
            lockedAt: now,
            lockedBy: workerId,
            lastAttemptAt: now,
          },
          $inc: { attemptCount: 1 },
        },
        { new: true }
      );

      if (!job) {
        continue; // Claimed by concurrent worker or not yet eligible
      }

      stats.processed += 1;

      // Verify task still exists and is active
      const task = await Task.findById(job.taskId);
      if (!task || task.status === 'Done' || !task.reminder?.enabled) {
        job.status = 'cancelled';
        job.failedReason = !task
          ? 'Task no longer exists'
          : task.status === 'Done'
          ? 'Task already completed'
          : 'Reminders disabled';
        job.lockedAt = null;
        job.lockedBy = null;
        await job.save();
        stats.failed += 1;
        continue;
      }

      // Schedule revalidation: ensure task or occurrence schedule hasn't changed
      const isTaskRecurring = Boolean(task.recurrence?.frequency && task.recurrence.frequency !== 'none');
      const currentLeadMinutes = Number(task.reminder?.minutesBefore) || 15;

      if (!isTaskRecurring) {
        const currentStartDateStr = typeof task.startDate === 'string'
          ? (task.startDate.includes('T') ? task.startDate.slice(0, 10) : task.startDate)
          : new Date(task.startDate).toISOString().slice(0, 10);
        const currentStartTime = task.startTime || null;

        if (
          job.taskStartDate !== currentStartDateStr ||
          job.taskStartTime !== currentStartTime ||
          job.minutesBefore !== currentLeadMinutes
        ) {
          job.status = 'cancelled';
          job.failedReason = 'Task schedule changed while reminder was queued';
          job.lockedAt = null;
          job.lockedBy = null;
          await job.save();
          stats.failed += 1;
          continue;
        }
      } else {
        // Recurring task: verify occurrence exception state
        // 1. Check if recurrence series ended before this occurrence
        const effectiveOrigDate =
          job.occurrenceKey && job.occurrenceKey !== 'single'
            ? job.occurrenceKey
            : (job.originalOccurrenceDate || job.taskStartDate);
        if (task.recurrence?.until && toISODateOnly(task.recurrence.until) < effectiveOrigDate) {
          job.status = 'cancelled';
          job.failedReason = 'Recurrence series ended before occurrence date';
          job.lockedAt = null;
          job.lockedBy = null;
          await job.save();
          stats.failed += 1;
          continue;
        }

        // 2. Check if occurrence has an exception
        const exceptions = Array.isArray(task.recurrenceExceptions) ? task.recurrenceExceptions : [];
        const ex = exceptions.find(
          (e) =>
            e &&
            ((job.occurrenceKey && job.occurrenceKey !== 'single' && e.date === job.occurrenceKey) ||
              (job.originalOccurrenceDate && e.date === job.originalOccurrenceDate) ||
              (!job.originalOccurrenceDate && e.date === job.taskStartDate))
        );

        if (ex) {
          if (ex.status === 'Done' || ex.action === 'completed') {
            job.status = 'cancelled';
            job.failedReason = 'Occurrence already completed';
            job.lockedAt = null;
            job.lockedBy = null;
            await job.save();
            stats.failed += 1;
            continue;
          }
          if (ex.action === 'skipped' || ex.action === 'cancelled') {
            job.status = 'cancelled';
            job.failedReason = 'Occurrence skipped or cancelled';
            job.lockedAt = null;
            job.lockedBy = null;
            await job.save();
            stats.failed += 1;
            continue;
          }
          if (ex.rescheduledDate && ex.rescheduledDate !== job.taskStartDate) {
            job.status = 'cancelled';
            job.failedReason = 'Occurrence rescheduled to a different date';
            job.lockedAt = null;
            job.lockedBy = null;
            await job.save();
            stats.failed += 1;
            continue;
          }
        }

        // 3. Check lead minutes
        if (job.minutesBefore !== currentLeadMinutes) {
          job.status = 'cancelled';
          job.failedReason = 'Reminder lead time changed';
          job.lockedAt = null;
          job.lockedBy = null;
          await job.save();
          stats.failed += 1;
          continue;
        }
      }

      // Re-check if job was cancelled while claimed
      const jobStateCheck = await ReminderJob.findById(job._id).select('status');
      if (jobStateCheck?.status === 'cancelled') {
        stats.failed += 1;
        continue;
      }

      // Workspace access validation
      if (task.workspaceId) {
        const hasAccess = await Workspace.exists({
          _id: task.workspaceId,
          $or: [{ owner: job.userId }, { 'members.user': job.userId }],
        });
        if (!hasAccess) {
          job.status = 'failed';
          job.failedReason = 'Recipient no longer has access to workspace';
          job.lockedAt = null;
          job.lockedBy = null;
          await job.save();
          stats.failed += 1;
          continue;
        }
      }

      // 1. In-App Notification Delivery
      let inAppSuccess = job.channelStatus?.inApp?.status === 'sent';
      if (!inAppSuccess) {
        try {
          const occKey = job.occurrenceKey || (job.isRecurring ? job.taskStartDate : 'single');
          let notif = null;

          if (occKey && occKey !== 'single') {
            // Occurrence-level deduplication: distinct occurrences create separate notifications,
            // while retries of the same occurrence match the existing notification.
            notif = await Notification.findOne({
              userId: job.userId,
              relatedTaskId: job.taskId,
              type: 'task_reminder',
              occurrenceKey: occKey,
            });
          } else {
            // Single / non-recurring task: deduplicate within 24h rolling window (matching occurrenceKey: 'single' or legacy null)
            notif = await Notification.findOne({
              userId: job.userId,
              relatedTaskId: job.taskId,
              type: 'task_reminder',
              $or: [
                { occurrenceKey: 'single' },
                { occurrenceKey: null },
              ],
              createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            });
          }

          if (!notif) {
            notif = await Notification.create({
              userId: job.userId,
              title: `⏰ Reminder: ${job.taskTitle}`,
              message: job.isAllDay
                ? `Your all-day task is scheduled for today.`
                : `Your task starts in ${job.minutesBefore} minute${job.minutesBefore !== 1 ? 's' : ''}.`,
              type: 'task_reminder',
              relatedTaskId: job.taskId,
              occurrenceKey: occKey,
            });
          }

          job.channelStatus.inApp = {
            status: 'sent',
            sentAt: new Date(),
            notificationId: notif._id,
            error: null,
          };
          inAppSuccess = true;
        } catch (inAppErr) {
          job.channelStatus.inApp = {
            status: 'failed',
            sentAt: null,
            notificationId: null,
            error: inAppErr.message,
          };
        }
      }

      // 2. Email Delivery
      let emailSuccess =
        job.channelStatus?.email?.status === 'sent' || job.channelStatus?.email?.status === 'skipped';
      if (!emailSuccess) {
        const isEmailConfigured = Boolean(
          config.emailHost || (config.gmailUser && config.gmailPass)
        );

        if (!isEmailConfigured) {
          job.channelStatus.email = {
            status: 'skipped',
            sentAt: null,
            error: 'No email service configured on server',
          };
          emailSuccess = true;
        } else {
          try {
            const user = await User.findById(job.userId).select('name email');
            if (!user || !user.email) {
              job.channelStatus.email = {
                status: 'skipped',
                sentAt: null,
                error: 'Recipient user has no email address',
              };
              emailSuccess = true;
            } else {
              const formattedDate = new Date(job.fireTime).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              const emailSent = await sendTaskReminderEmail({
                toEmail: user.email,
                toName: user.name || 'there',
                taskTitle: job.taskTitle,
                taskDescription: task.description || '',
                dueDate: formattedDate,
                priority: task.priority || 'Medium',
                minutesBefore: job.minutesBefore,
              });

              if (emailSent) {
                job.channelStatus.email = {
                  status: 'sent',
                  sentAt: new Date(),
                  error: null,
                };
                emailSuccess = true;
              } else {
                job.channelStatus.email = {
                  status: 'failed',
                  sentAt: null,
                  error: 'Email service did not send message',
                };
              }
            }
          } catch (emailErr) {
            job.channelStatus.email = {
              status: 'failed',
              sentAt: null,
              error: emailErr.message,
            };
          }
        }
      }

      // 3. Status update & bounded exponential backoff
      if (inAppSuccess && emailSuccess) {
        job.status = 'sent';
        job.nextAttemptAt = null;
        job.lockedAt = null;
        job.lockedBy = null;
        await job.save();
        stats.sent += 1;
      } else if (job.attemptCount >= job.maxAttempts) {
        job.status = inAppSuccess ? 'sent' : 'failed';
        job.failedReason = `Max attempts (${job.maxAttempts}) reached. inApp: ${job.channelStatus.inApp.status}, email: ${job.channelStatus.email.status}`;
        job.nextAttemptAt = null;
        job.lockedAt = null;
        job.lockedBy = null;
        await job.save();
        if (job.status === 'sent') {
          stats.sent += 1;
        } else {
          stats.failed += 1;
        }
      } else {
        // FIX C: Bounded exponential backoff delay (1 min, 2 min, capped at 1h)
        const backoffMs = Math.min(60 * 1000 * Math.pow(2, job.attemptCount - 1), 60 * 60 * 1000);
        job.status = 'pending';
        job.nextAttemptAt = new Date(now.getTime() + backoffMs);
        job.lockedAt = null;
        job.lockedBy = null;
        await job.save();
        stats.retried += 1;
      }
    }
  } catch (err) {
    console.error('[ReminderScheduler] Error in processReminderJobs:', err.message);
  } finally {
    activeProcessingCount--;
  }

  return stats;
};

/**
 * Periodic runner for local development (only runs if enabled).
 */
export const processTaskReminders = async () => {
  return await processReminderJobs({ batchSize: 50 });
};

/**
 * Replenish reminder jobs for recurring tasks in bounded rolling windows.
 * Invoked by the external scheduler on POST /api/reminders/process.
 *
 * Requirements:
 * - Uses a fair round-robin batch of candidate recurring tasks (sorted by lastReminderReplenishedAt, updatedAt).
 * - Avoids starvation by updating lastReminderReplenishedAt checkpoint.
 * - Reconciles eligible occurrences across the target horizon (default 60 days).
 * - Does not regenerate already-correct jobs.
 * - Does not create jobs for completed or reminder-disabled tasks.
 * - Concurrency safe and partial-batch resumable.
 */
export const replenishRecurringReminders = async ({
  targetWindowDays = 60,
  batchSize = 25,
} = {}) => {
  const stats = {
    tasksProcessed: 0,
    tasksEligible: 0,
    errors: 0,
    checkpointErrors: 0,
    errorDetails: [],
  };

  const limit = Math.min(Math.max(parseInt(batchSize, 10) || 25, 1), 100);

  // Find candidate active recurring tasks with reminders enabled
  const candidates = await Task.find({
    'recurrence.frequency': { $in: ['daily', 'weekly', 'monthly'] },
    'reminder.enabled': true,
    status: { $ne: 'Done' },
  })
    .sort({ lastReminderReplenishedAt: 1, updatedAt: 1 })
    .limit(limit);

  stats.tasksEligible = candidates.length;

  for (const task of candidates) {
    const now = new Date();
    try {
      await syncTaskReminders(task, { windowDays: targetWindowDays });
      try {
        await Task.updateOne(
          { _id: task._id },
          { $set: { lastReminderReplenishedAt: now } }
        );
        stats.tasksProcessed += 1;
      } catch (cpErr) {
        console.error(`[Replenishment] Checkpoint write failed for task ${task._id}:`, cpErr.message);
        stats.checkpointErrors += 1;
      }
    } catch (err) {
      console.error(`[Replenishment] Error replenishing task ${task._id}:`, err.message);
      stats.errors += 1;
      stats.errorDetails.push({ taskId: task._id.toString(), message: err.message });

      // Advance checkpoint to current time so this failed task rotates to the back of the queue,
      // preventing it from monopolizing every subsequent batch and starving valid tasks.
      // The task remains active in the DB and will be retried when its turn comes around again.
      try {
        await Task.updateOne(
          { _id: task._id },
          { $set: { lastReminderReplenishedAt: now } }
        );
      } catch (cpErr) {
        console.error(`[Replenishment] Checkpoint write failed for failing task ${task._id}:`, cpErr.message);
        stats.checkpointErrors += 1;
      }
    }
  }

  return stats;
};

/**
 * Idempotent migration helper for ReminderJob queue identity.
 * Validates existing documents, backfills missing occurrenceKey, checks for duplicates,
 * verifies the new unique index, and safely drops the old index only after verification.
 */
export const ensureReminderJobIndexes = async ({ log = false } = {}) => {
  const diagnostics = {
    backfilled: 0,
    ambiguousCount: 0,
    ambiguousDetails: [],
    duplicateCount: 0,
    duplicates: [],
    indexCreated: false,
    indexDropped: false,
    indexReplaced: false,
    success: false,
  };

  try {
    // 1. Backfill legacy jobs missing occurrenceKey
    const legacyJobs = await ReminderJob.find({
      $or: [{ occurrenceKey: { $exists: false } }, { occurrenceKey: null }],
    });

    for (const job of legacyJobs) {
      let key = null;
      if (!job.isRecurring) {
        key = 'single';
      } else if (job.originalOccurrenceDate && /^\d{4}-\d{2}-\d{2}$/.test(job.originalOccurrenceDate)) {
        key = job.originalOccurrenceDate;
      } else {
        // Look up task recurrence data to establish deterministic identity
        const task = await Task.findById(job.taskId);
        if (task) {
          if (!task.recurrence?.frequency || task.recurrence.frequency === 'none') {
            key = 'single';
          } else {
            // Check exceptions first
            const ex = Array.isArray(task.recurrenceExceptions)
              ? task.recurrenceExceptions.find((e) => e && e.rescheduledDate === job.taskStartDate)
              : null;
            if (ex && ex.date) {
              key = ex.date;
            } else if (job.taskStartDate && /^\d{4}-\d{2}-\d{2}$/.test(job.taskStartDate)) {
              key = job.taskStartDate;
            }
          }
        } else if (job.taskStartDate && /^\d{4}-\d{2}-\d{2}$/.test(job.taskStartDate)) {
          key = job.taskStartDate;
        }
      }

      if (key) {
        await ReminderJob.updateOne(
          { _id: job._id },
          { $set: { occurrenceKey: key } }
        );
        diagnostics.backfilled++;
      } else {
        diagnostics.ambiguousCount++;
        diagnostics.ambiguousDetails.push({
          jobId: job._id.toString(),
          taskId: job.taskId?.toString(),
          taskStartDate: job.taskStartDate,
        });
      }
    }

    // Fail closed if any ambiguous legacy records could not be mapped
    if (diagnostics.ambiguousCount > 0) {
      if (log) {
        console.error(`[ensureReminderJobIndexes] Migration halted: ${diagnostics.ambiguousCount} ambiguous legacy jobs could not be mapped safely.`);
      }
      diagnostics.success = false;
      diagnostics.reason = 'ambiguous_records_found';
      return diagnostics;
    }

    // 2. Validate for duplicate identities before creating unique index
    const dupes = await ReminderJob.aggregate([
      { $match: { occurrenceKey: { $ne: null } } },
      {
        $group: {
          _id: { taskId: '$taskId', userId: '$userId', occurrenceKey: '$occurrenceKey' },
          count: { $sum: 1 },
          jobIds: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    // Fail closed if duplicate identities exist
    if (dupes.length > 0) {
      diagnostics.duplicateCount = dupes.length;
      diagnostics.duplicates = dupes;
      if (log) {
        console.error(`[ensureReminderJobIndexes] Migration halted: cannot create unique index due to ${dupes.length} duplicate identity sets.`);
      }
      diagnostics.success = false;
      diagnostics.reason = 'duplicates_found';
      return diagnostics;
    }

    // 3. Inspect existing collection index definitions
    const matchesKey = (keyObj, targetKey) => {
      if (!keyObj || typeof keyObj !== 'object') return false;
      const k1 = Object.keys(keyObj);
      const k2 = Object.keys(targetKey);
      if (k1.length !== k2.length) return false;
      return k1.every((k) => keyObj[k] === targetKey[k]);
    };

    let existingIndexes = [];
    try {
      existingIndexes = await ReminderJob.collection.indexes();
    } catch (idxErr) {
      // Collection may not exist yet in fresh test environments
      if (idxErr.code === 26 || idxErr.message.includes('ns does not exist')) {
        diagnostics.success = true;
        return diagnostics;
      }
      throw idxErr;
    }

    let hasNewIndex = existingIndexes.some(
      (idx) => matchesKey(idx.key, { taskId: 1, userId: 1, occurrenceKey: 1 }) && idx.unique === true
    );
    const oldIndexObj = existingIndexes.find(
      (idx) => matchesKey(idx.key, { taskId: 1, userId: 1, taskStartDate: 1 }) && idx.unique === true
    );

    // Step 3a: Create and verify the new unique index FIRST while old index still exists
    if (!hasNewIndex) {
      await ReminderJob.collection.createIndex(
        { taskId: 1, userId: 1, occurrenceKey: 1 },
        { unique: true }
      );
      const refreshedIndexes = await ReminderJob.collection.indexes();
      hasNewIndex = refreshedIndexes.some(
        (idx) => matchesKey(idx.key, { taskId: 1, userId: 1, occurrenceKey: 1 }) && idx.unique === true
      );
      if (!hasNewIndex) {
        throw new Error('New unique index verification failed after creation');
      }
      if (log) console.log('[ensureReminderJobIndexes] Created and verified new unique index taskId_1_userId_1_occurrenceKey_1');
      diagnostics.indexCreated = true;
    }

    // Step 3b: Drop the old index ONLY after the new index has been verified
    if (oldIndexObj) {
      await ReminderJob.collection.dropIndex(oldIndexObj.name);
      if (log) console.log(`[ensureReminderJobIndexes] Successfully dropped old index ${oldIndexObj.name}`);
      diagnostics.indexDropped = true;
      diagnostics.indexReplaced = true;
    }

    diagnostics.success = true;
    return diagnostics;
  } catch (err) {
    console.error('[ensureReminderJobIndexes] Migration error:', err.message);
    diagnostics.error = err.message;
    diagnostics.success = false;
    return diagnostics;
  }
};

