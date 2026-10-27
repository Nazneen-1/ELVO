import crypto from 'crypto';
import { config } from '../config/env.js';
import { processReminderJobs, replenishRecurringReminders } from '../utils/reminderScheduler.js';
import { processOverdueNotifications } from '../utils/collaborativeNotifications.js';

/**
 * Compare two secret tokens safely using constant-time comparison.
 */
const safeTokenCompare = (provided, expected) => {
  if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const provBuf = Buffer.from(provided);
  const expBuf = Buffer.from(expected);
  if (provBuf.length !== expBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(provBuf, expBuf);
};

/**
 * @desc    External scheduler trigger endpoint for processing due reminders and overdue tasks
 * @route   POST /api/reminders/process
 * @access  Protected by REMINDER_SCHEDULER_SECRET
 */
export const processRemindersTrigger = async (req, res, next) => {
  try {
    const configuredSecret = config.reminderSchedulerSecret;

    if (!configuredSecret || configuredSecret.trim() === '') {
      return res.status(503).json({
        success: false,
        message: 'Reminder scheduler secret is not configured on the server',
      });
    }

    let token = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.headers['x-reminder-secret']) {
      token = String(req.headers['x-reminder-secret']).trim();
    }

    if (!token || !safeTokenCompare(token, configuredSecret)) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Bounded batch processing (1 to 100, default 50)
    const batchSize = Math.min(Math.max(parseInt(req.body?.batchSize, 10) || 50, 1), 100);

    // 1. Process reminder queue jobs
    let reminderSummary = { processed: 0, sent: 0, retried: 0, failed: 0 };
    let reminderError = null;
    try {
      reminderSummary = await processReminderJobs({ batchSize });
    } catch (err) {
      console.error('[ReminderController] Error processing reminder jobs:', err.message);
      reminderError = 'Failed to process reminder jobs';
    }

    // 2. Process overdue task notifications (isolated execution so failures don't block each other)
    let overdueSummary = { checked: 0, notified: 0 };
    let overdueError = null;
    try {
      overdueSummary = await processOverdueNotifications({ limit: batchSize });
    } catch (err) {
      console.error('[ReminderController] Error processing overdue notifications:', err.message);
      overdueError = 'Failed to process overdue notifications';
    }

    // 3. Replenish recurring task reminder jobs (isolated execution)
    let replenishmentSummary = { tasksProcessed: 0, tasksEligible: 0, errors: 0, checkpointErrors: 0 };
    let replenishmentError = null;
    try {
      replenishmentSummary = await replenishRecurringReminders({ batchSize });
      const totalErrors = (replenishmentSummary.errors || 0) + (replenishmentSummary.checkpointErrors || 0);
      if (totalErrors > 0) {
        replenishmentError = `${totalErrors} recurring task(s) encountered replenishment errors`;
      }
    } catch (err) {
      console.error('[ReminderController] Error replenishing recurring reminders:', err.message);
      replenishmentError = 'Failed to replenish recurring reminders';
    }

    const hasAnyError = Boolean(reminderError || overdueError || replenishmentError);

    return res.status(200).json({
      success: !hasAnyError,
      processed: reminderSummary.processed,
      sent: reminderSummary.sent,
      retried: reminderSummary.retried,
      failed: reminderSummary.failed,
      overdueNotified: overdueSummary.notified,
      replenished: replenishmentSummary.tasksProcessed,
      ...(hasAnyError
        ? { warning: [reminderError, overdueError, replenishmentError].filter(Boolean).join('; ') }
        : {}),
    });
  } catch (error) {
    console.error('[ReminderController] Trigger execution error:', error.message);
    next(error);
  }
};
