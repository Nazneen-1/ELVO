import mongoose from './server/node_modules/mongoose/index.js';
import { config } from './server/src/config/env.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Notification from './server/src/models/Notification.js';
import ReminderJob from './server/src/models/ReminderJob.js';
import {
  calculateReminderFireTime,
  calculateEventInstant,
  syncTaskReminders,
  cleanupTaskReminders,
  processReminderJobs,
} from './server/src/utils/reminderScheduler.js';
import {
  projectTaskOccurrences,
  toISODateOnly,
  addDaysUTC,
  addMonthsUTC,
  daysInMonth,
} from './server/src/utils/recurrenceEngine.js';
import { assertSafeTestDatabase, getSafeTestUri } from './server/src/config/testDbGuard.js';

const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function record(name, passed, detail = '') {
  testResults.tests.push({ name, passed, detail });
  if (passed) {
    testResults.passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    testResults.failed++;
    console.log(`  \x1b[31m✖\x1b[0m ${name}: ${detail}`);
  }
}

console.log('\n\x1b[1m\x1b[36m=== ELVO STAGE 3.2: RECURRING OCCURRENCE REMINDERS TEST SUITE ===\x1b[0m\n');

// =============================================================================
// SUITE 1: Pure Recurrence & Occurrence Fire Time Calculations
// =============================================================================
console.log('\x1b[1mSuite 1: Pure Recurrence & Occurrence Fire Time Calculations\x1b[0m');

// 1. Daily recurring task occurrences
const dailySeries = {
  startDate: new Date('2026-11-01T00:00:00.000Z'),
  startTime: '09:00',
  recurrence: { frequency: 'daily', interval: 1 },
};
const dailyOccs = projectTaskOccurrences(dailySeries, '2026-11-01', '2026-11-05');
record(
  '1. Daily recurring task projects exact daily dates across window',
  dailyOccs.length === 5 &&
  dailyOccs[0].occurrenceDate === '2026-11-01' &&
  dailyOccs[4].occurrenceDate === '2026-11-05'
);

// 2. Weekly recurring task occurrences (e.g. every Monday)
const weeklySeries = {
  startDate: new Date('2026-11-02T00:00:00.000Z'), // Monday
  startTime: '14:00',
  recurrence: { frequency: 'weekly', interval: 1 },
};
const weeklyOccs = projectTaskOccurrences(weeklySeries, '2026-11-01', '2026-11-23');
record(
  '2. Weekly recurring task projects 7-day intervals (Mondays)',
  weeklyOccs.length === 4 &&
  weeklyOccs.map(o => o.occurrenceDate).join(',') === '2026-11-02,2026-11-09,2026-11-16,2026-11-23'
);

// 3. Monthly recurring task occurrences
const monthlySeries = {
  startDate: new Date('2026-11-15T00:00:00.000Z'),
  startTime: '10:00',
  recurrence: { frequency: 'monthly', interval: 1 },
};
const monthlyOccs = projectTaskOccurrences(monthlySeries, '2026-11-01', '2027-02-28');
record(
  '3. Monthly recurring task projects target day across months',
  monthlyOccs.length === 4 &&
  monthlyOccs.map(o => o.occurrenceDate).join(',') === '2026-11-15,2026-12-15,2027-01-15,2027-02-15'
);

// 4. Month-end clamping (e.g. Jan 31 monthly series)
const monthEndSeries = {
  startDate: new Date('2028-01-31T00:00:00.000Z'), // 2028 is leap year!
  startTime: '10:00',
  recurrence: { frequency: 'monthly', interval: 1 },
};
const monthEndOccs = projectTaskOccurrences(monthEndSeries, '2028-01-01', '2028-04-30');
record(
  '4. Month-end recurring task clamps to Feb 29 (leap year), Mar 31, Apr 30',
  monthEndOccs.length === 4 &&
  monthEndOccs[0].occurrenceDate === '2028-01-31' &&
  monthEndOccs[1].occurrenceDate === '2028-02-29' &&
  monthEndOccs[2].occurrenceDate === '2028-03-31' &&
  monthEndOccs[3].occurrenceDate === '2028-04-30'
);

// 5. Occurrence fire time calculation using Asia/Kolkata (+05:30)
const occFireKolkata = calculateReminderFireTime({
  startDate: '2026-11-05',
  startTime: '09:00',
  minutesBefore: 15,
  timezone: 'Asia/Kolkata',
});
// 09:00 IST = 03:30 UTC, 15m lead = 03:15 UTC
record(
  '5. Occurrence reminder fires at 03:15 UTC for 09:00 IST in Asia/Kolkata',
  occFireKolkata.toISOString() === '2026-11-05T03:15:00.000Z'
);

// 6. Rescheduled occurrence projection preserves new destination date and time
const seriesWithReschedule = {
  _id: new mongoose.Types.ObjectId(),
  startDate: new Date('2026-11-01T00:00:00.000Z'),
  startTime: '09:00',
  recurrence: { frequency: 'daily', interval: 1 },
  recurrenceExceptions: [
    {
      date: '2026-11-03',
      rescheduledDate: '2026-11-08',
      startTime: '15:30',
      action: 'rescheduled',
    },
  ],
};
const occsWithReschedule = projectTaskOccurrences(seriesWithReschedule, '2026-11-01', '2026-11-10');
const rescheduledOcc = occsWithReschedule.find(o => o.originalOccurrenceDate === '2026-11-03');
const naturalNov3 = occsWithReschedule.find(o => o.occurrenceDate === '2026-11-03');
record(
  '6. Rescheduled occurrence renders on destination date (Nov 8) with new time (15:30) and leaves no ghost on Nov 3',
  naturalNov3 === undefined &&
  rescheduledOcc !== undefined &&
  rescheduledOcc.occurrenceDate === '2026-11-08' &&
  rescheduledOcc.startTime === '15:30'
);

// =============================================================================
// SUITE 2: MongoDB Persistent Occurrence Reminder Queue Integration
// =============================================================================
console.log('\n\x1b[1mSuite 2: Database Queue Integration for Recurring Occurrences\x1b[0m');

let dbConnected = false;
try {
  const mongoUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
  assertSafeTestDatabase(mongoUri);
  await mongoose.connect(mongoUri);
  dbConnected = true;
  console.log('  \x1b[34mℹ\x1b[0m Connected to isolated test MongoDB successfully.');
} catch (err) {
  console.log('  \x1b[33m⚠\x1b[0m Could not connect to MongoDB:', err.message);
}

if (dbConnected) {
  let creatorId = null;
  let assigneeId = null;
  try {
    creatorId = new mongoose.Types.ObjectId();
    assigneeId = new mongoose.Types.ObjectId();

    // Create user with timezone Asia/Kolkata
    await User.create({
      _id: creatorId,
      name: 'Recurring Alice',
      email: `alice_${Date.now()}@example.com`,
      password: 'password123',
      preferences: { timezone: 'Asia/Kolkata' },
    });

    // 7. Daily recurring task sync creates distinct bounded jobs per occurrence
    const dailyTask = await Task.create({
      userId: creatorId,
      title: 'Daily Standup',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      startTime: '09:00',
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: true, minutesBefore: 15 },
    });

    // Sync with 10 days window
    await syncTaskReminders(dailyTask, { windowDays: 10 });
    const initialJobs = await ReminderJob.find({ taskId: dailyTask._id }).sort({ taskStartDate: 1 });
    record(
      '7. Daily recurring task creates individual jobs for all projected occurrences in window',
      initialJobs.length === 11 && // 2026-11-01 to 2026-11-11 inclusive
      initialJobs[0].taskStartDate === '2026-11-01' &&
      initialJobs[0].isRecurring === true &&
      initialJobs[0].fireTime.toISOString() === '2026-11-01T03:15:00.000Z'
    );

    // 8. Repeated synchronization does not duplicate jobs (Idempotency)
    await syncTaskReminders(dailyTask, { windowDays: 10 });
    const jobsAfterResync = await ReminderJob.find({ taskId: dailyTask._id });
    record(
      '8. Repeated sync does not generate duplicate jobs (stable deduplication)',
      jobsAfterResync.length === 11
    );

    // 9. Rescheduling one occurrence updates queue: removes old date, adds destination date
    // Set recurrence.until to Nov 10 so Nov 15 is an open day for rescheduling
    dailyTask.recurrence.until = new Date('2026-11-10T00:00:00.000Z');
    dailyTask.recurrenceExceptions.push({
      date: '2026-11-05',
      rescheduledDate: '2026-11-15',
      startTime: '16:00',
      action: 'rescheduled',
      status: 'To Do',
    });
    await dailyTask.save();
    await syncTaskReminders(dailyTask, { windowDays: 15 });

    const jobOldDate = await ReminderJob.findOne({ taskId: dailyTask._id, taskStartDate: '2026-11-05' });
    const jobNewDate = await ReminderJob.findOne({ taskId: dailyTask._id, taskStartDate: '2026-11-15' });
    // 16:00 IST is 10:30 UTC. 15m lead = 10:15 UTC
    record(
      '9. Rescheduled occurrence reminder moves to destination date/time (Nov 15 at 10:15 UTC) and invalidates Nov 5',
      jobOldDate === null &&
      jobNewDate !== null &&
      jobNewDate.taskStartTime === '16:00' &&
      jobNewDate.fireTime.toISOString() === '2026-11-15T10:15:00.000Z' &&
      jobNewDate.originalOccurrenceDate === '2026-11-05'
    );

    // 10. Completed occurrence removes its reminder job
    dailyTask.recurrenceExceptions.push({
      date: '2026-11-03',
      action: 'completed',
      status: 'Done',
    });
    await dailyTask.save();
    await syncTaskReminders(dailyTask, { windowDays: 15 });

    const jobCompletedDate = await ReminderJob.findOne({ taskId: dailyTask._id, taskStartDate: '2026-11-03' });
    const jobActiveNeighbor = await ReminderJob.findOne({ taskId: dailyTask._id, taskStartDate: '2026-11-04' });
    record(
      '10. Completed occurrence removes its pending reminder job while neighbor occurrences stay active',
      jobCompletedDate === null && jobActiveNeighbor !== null
    );

    // 11. Skipped occurrence removes its reminder job
    dailyTask.recurrenceExceptions.push({
      date: '2026-11-04',
      action: 'skipped',
    });
    await dailyTask.save();
    await syncTaskReminders(dailyTask, { windowDays: 15 });

    const jobSkippedDate = await ReminderJob.findOne({ taskId: dailyTask._id, taskStartDate: '2026-11-04' });
    record(
      '11. Skipped occurrence removes its pending reminder job',
      jobSkippedDate === null
    );

    // 12. Weekly recurring task queue sync
    const weeklyTask = await Task.create({
      userId: creatorId,
      title: 'Weekly Retrospective',
      startDate: new Date('2026-11-02T00:00:00.000Z'),
      startTime: '11:00',
      recurrence: { frequency: 'weekly', interval: 1 },
      reminder: { enabled: true, minutesBefore: 30 },
    });
    await syncTaskReminders(weeklyTask, { windowDays: 21 });
    const weeklyJobs = await ReminderJob.find({ taskId: weeklyTask._id }).sort({ taskStartDate: 1 });
    record(
      '12. Weekly recurring task queues jobs matching cadence (Nov 2, Nov 9, Nov 16, Nov 23)',
      weeklyJobs.length === 4 &&
      weeklyJobs[0].taskStartDate === '2026-11-02' &&
      weeklyJobs[1].taskStartDate === '2026-11-09' &&
      weeklyJobs[2].taskStartDate === '2026-11-16' &&
      weeklyJobs[3].taskStartDate === '2026-11-23'
    );

    // 13. Monthly recurring task queue sync
    const monthlyTask = await Task.create({
      userId: creatorId,
      title: 'Monthly Planning',
      startDate: new Date('2026-11-10T00:00:00.000Z'),
      startTime: '10:00',
      recurrence: { frequency: 'monthly', interval: 1 },
      reminder: { enabled: true, minutesBefore: 60 },
    });
    await syncTaskReminders(monthlyTask, { windowDays: 60 });
    const monthlyJobs = await ReminderJob.find({ taskId: monthlyTask._id }).sort({ taskStartDate: 1 });
    record(
      '13. Monthly recurring task queues jobs for target day in successive months',
      monthlyJobs.length >= 2 &&
      monthlyJobs[0].taskStartDate === '2026-11-10' &&
      monthlyJobs[1].taskStartDate === '2026-12-10'
    );

    // 14. Worker live revalidation: cancels job if occurrence completed after claim
    const testOccDate = '2026-10-10';
    const workerTask = await Task.create({
      userId: creatorId,
      title: 'Worker Verification Task',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      startTime: '10:00',
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: true, minutesBefore: 15 },
      recurrenceExceptions: [
        {
          date: testOccDate,
          action: 'completed',
          status: 'Done',
        },
      ],
    });
    // Create an in-flight claimed job for this completed occurrence
    const claimedJob = await ReminderJob.create({
      taskId: workerTask._id,
      userId: creatorId,
      taskStartDate: testOccDate,
      taskTitle: workerTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 3600 * 1000), // due
      status: 'pending',
      isRecurring: true,
      originalOccurrenceDate: testOccDate,
    });
    await processReminderJobs({ batchSize: 10 });
    const reloadedJob = await ReminderJob.findById(claimedJob._id);
    record(
      '14. Worker revalidation detects occurrence exception status: Done and cancels job',
      reloadedJob.status === 'cancelled' &&
      reloadedJob.failedReason === 'Occurrence already completed'
    );

    // 15. Disabling reminders on recurring task cleans up all pending occurrence jobs
    dailyTask.reminder.enabled = false;
    await dailyTask.save();
    await syncTaskReminders(dailyTask);
    const remainingDailyJobs = await ReminderJob.find({ taskId: dailyTask._id, status: 'pending' });
    record(
      '15. Disabling reminders on recurring task purges all pending occurrence jobs',
      remainingDailyJobs.length === 0
    );

    // 16. Existing one-time non-recurring task still creates exactly one reminder job
    const singleTask = await Task.create({
      userId: creatorId,
      title: 'Single Task Reminder',
      startDate: new Date('2026-11-20T00:00:00.000Z'),
      startTime: '10:00',
      recurrence: { frequency: 'none' },
      reminder: { enabled: true, minutesBefore: 15 },
    });
    await syncTaskReminders(singleTask);
    const singleJobs = await ReminderJob.find({ taskId: singleTask._id });
    record(
      '16. Non-recurring task creates exactly one job and works identically to Stage 3.1',
      singleJobs.length === 1 &&
      singleJobs[0].taskStartDate === '2026-11-20' &&
      singleJobs[0].isRecurring === false
    );

    // 17. (H-1 Fix) Valid reminder job rescheduled beyond 60 days survives subsequent normal 60-day sync
    const beyondTask = await Task.create({
      userId: creatorId,
      title: 'Beyond Window Task',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      startTime: '10:00',
      recurrence: { frequency: 'daily', interval: 1, until: new Date('2026-11-10T00:00:00.000Z') },
      reminder: { enabled: true, minutesBefore: 15 },
      recurrenceExceptions: [
        {
          date: '2026-11-02',
          rescheduledDate: '2027-02-15', // 105 days in future
          startTime: '14:00',
          action: 'rescheduled',
          status: 'To Do',
        },
      ],
    });
    // First sync with 120-day window creates the job on 2027-02-15
    await syncTaskReminders(beyondTask, { windowDays: 120 });
    const jobBeforeUnrelatedSync = await ReminderJob.findOne({ taskId: beyondTask._id, taskStartDate: '2027-02-15' });

    // An unrelated update triggers standard 60-day sync (where 2027-02-15 is outside the 60-day projection)
    beyondTask.title = 'Beyond Window Task Renamed';
    await beyondTask.save();
    await syncTaskReminders(beyondTask); // default 60-day window

    const jobAfterUnrelatedSync = await ReminderJob.findOne({ taskId: beyondTask._id, taskStartDate: '2027-02-15' });
    record(
      '17. (H-1 Fix) Valid reminder job rescheduled beyond 60 days survives subsequent normal 60-day sync',
      jobBeforeUnrelatedSync !== null &&
      jobAfterUnrelatedSync !== null &&
      jobAfterUnrelatedSync.taskStartDate === '2027-02-15' &&
      jobAfterUnrelatedSync.taskTitle === 'Beyond Window Task Renamed'
    );

    // 18. (H-1 Fix) Genuinely stale pending job inside the active window is still removed
    // Add an exception skipping occurrence on 2026-11-03 (inside the active 60-day window)
    beyondTask.recurrenceExceptions.push({
      date: '2026-11-03',
      action: 'skipped',
    });
    await beyondTask.save();
    await syncTaskReminders(beyondTask); // default 60-day window

    const jobInsideWindowSkipped = await ReminderJob.findOne({ taskId: beyondTask._id, taskStartDate: '2026-11-03' });
    const jobInsideWindowActive = await ReminderJob.findOne({ taskId: beyondTask._id, taskStartDate: '2026-11-04' });
    const jobOutsideWindowStillPreserved = await ReminderJob.findOne({ taskId: beyondTask._id, taskStartDate: '2027-02-15' });
    record(
      '18. (H-1 Fix) Stale job inside active window is removed while valid inside and outside window jobs persist',
      jobInsideWindowSkipped === null &&
      jobInsideWindowActive !== null &&
      jobOutsideWindowStillPreserved !== null
    );

  } finally {
    try {
      if (creatorId && assigneeId) {
        await Task.deleteMany({ userId: { $in: [creatorId, assigneeId] } });
        await ReminderJob.deleteMany({ userId: { $in: [creatorId, assigneeId] } });
        await Notification.deleteMany({ userId: { $in: [creatorId, assigneeId] } });
        await User.deleteMany({ _id: { $in: [creatorId, assigneeId] } });
      }
    } catch (cleanupErr) {
      console.warn('  \x1b[33m⚠\x1b[0m Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
    console.log('  \x1b[34mℹ\x1b[0m Disconnected from MongoDB.');
  }
}

// Print Summary
console.log('\n=======================================================');
console.log('                   TEST SUMMARY                        ');
console.log('=======================================================');
console.log(`  \x1b[32m✔ Passed:   ${testResults.passed}\x1b[0m`);
console.log(`  \x1b[31m✖ Failed:   ${testResults.failed}\x1b[0m`);
console.log(`  Total:      ${testResults.tests.length}`);

if (testResults.failed === 0) {
  console.log('\n\x1b[32m✨ ALL STAGE 3.2 RECURRING OCCURRENCE REMINDER TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\n\x1b[31m💥 SOME TESTS FAILED! 💥\x1b[0m\n');
  process.exit(1);
}
