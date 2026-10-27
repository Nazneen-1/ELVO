import mongoose from './server/node_modules/mongoose/index.js';
import { config } from './server/src/config/env.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Notification from './server/src/models/Notification.js';
import ReminderJob from './server/src/models/ReminderJob.js';
import {
  syncTaskReminders,
  cleanupTaskReminders,
  processReminderJobs,
  replenishRecurringReminders,
  ensureReminderJobIndexes,
  calculateReminderFireTime,
  calculateEventInstant,
  gracefulSchedulerShutdown,
  resetSchedulerShutdown,
  isSchedulerShuttingDown,
} from './server/src/utils/reminderScheduler.js';
import { processRemindersTrigger } from './server/src/controllers/reminderController.js';
import { toISODateOnly, addDaysUTC } from './server/src/utils/recurrenceEngine.js';
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

console.log('\n\x1b[1m\x1b[36m=== ELVO STAGE 3.4: REMINDER RELIABILITY TEST SUITE ===\x1b[0m\n');

async function runStage34Tests() {
  let creatorId = null;
  try {
    const mongoUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
    assertSafeTestDatabase(mongoUri);
    await mongoose.connect(mongoUri);

    // Setup scheduler secret for test environment if not configured
    config.reminderSchedulerSecret = config.reminderSchedulerSecret || 'test_scheduler_secret_stage34';

    // Create unique test users
    const userTimestamp = Date.now();
    const testUser = await User.create({
      name: 'Stage 3.4 Reliability User',
      email: `stage34_user_${userTimestamp}@example.com`,
      password: 'Password123!',
      preferences: { timezone: 'America/New_York' },
    });
    creatorId = testUser._id;

    // Run ensureReminderJobIndexes to verify/prepare collection indexes
    await ensureReminderJobIndexes({ log: false });

    // =========================================================================
    // SUITE 1: Queue Identity & Occurrence Disambiguation
    // =========================================================================
    console.log('\x1b[1mSuite 1: Queue Identity & Occurrence Disambiguation\x1b[0m');

    // 1. Natural and rescheduled occurrences sharing one effective date both retain separate jobs
    const collisionTask = await Task.create({
      userId: creatorId,
      title: 'Same-Date Coexistence Task',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      startTime: '09:00',
      recurrence: { frequency: 'daily', interval: 1, until: new Date('2026-11-10T00:00:00.000Z') },
      reminder: { enabled: true, minutesBefore: 15 },
      recurrenceExceptions: [
        {
          date: '2026-11-02',
          rescheduledDate: '2026-11-05',
          startTime: '14:00',
          action: 'rescheduled',
          status: 'To Do',
        },
      ],
    });

    await syncTaskReminders(collisionTask, { windowDays: 10 });

    const jobsOnNov5 = await ReminderJob.find({
      taskId: collisionTask._id,
      taskStartDate: '2026-11-05',
    }).sort({ fireTime: 1 });

    const naturalJob = jobsOnNov5.find((j) => j.occurrenceKey === '2026-11-05');
    const rescheduledJob = jobsOnNov5.find((j) => j.occurrenceKey === '2026-11-02');

    record(
      '1. Natural and rescheduled occurrences sharing one effective date (Nov 5) both retain separate jobs',
      jobsOnNov5.length === 2 &&
      naturalJob !== undefined &&
      rescheduledJob !== undefined &&
      naturalJob.taskStartTime === '09:00' &&
      rescheduledJob.taskStartTime === '14:00' &&
      naturalJob.occurrenceKey === '2026-11-05' &&
      rescheduledJob.occurrenceKey === '2026-11-02'
    );

    // 2. Repeatedly rescheduling one occurrence updates only its job
    collisionTask.recurrenceExceptions[0].rescheduledDate = '2026-11-08';
    collisionTask.recurrenceExceptions[0].startTime = '16:00';
    await collisionTask.save();
    await syncTaskReminders(collisionTask, { windowDays: 10 });

    const jobsOnNov5AfterMove = await ReminderJob.find({
      taskId: collisionTask._id,
      taskStartDate: '2026-11-05',
    });
    const jobOnNov8 = await ReminderJob.findOne({
      taskId: collisionTask._id,
      taskStartDate: '2026-11-08',
      occurrenceKey: '2026-11-02',
    });

    record(
      '2. Repeatedly rescheduling one occurrence updates only its job without mutating neighbor jobs',
      jobsOnNov5AfterMove.length === 1 &&
      jobsOnNov5AfterMove[0].occurrenceKey === '2026-11-05' &&
      jobOnNov8 !== null &&
      jobOnNov8.taskStartTime === '16:00' &&
      jobOnNov8.occurrenceKey === '2026-11-02'
    );

    // 3. Completing/skipping one occurrence leaves the other occurrence's job intact
    collisionTask.recurrenceExceptions.push({
      date: '2026-11-05',
      action: 'completed',
      status: 'Done',
    });
    await collisionTask.save();
    await syncTaskReminders(collisionTask, { windowDays: 10 });

    const jobNov5Completed = await ReminderJob.findOne({
      taskId: collisionTask._id,
      occurrenceKey: '2026-11-05',
    });
    const jobNov8StillActive = await ReminderJob.findOne({
      taskId: collisionTask._id,
      occurrenceKey: '2026-11-02',
    });

    record(
      '3. Completing one occurrence removes its job while leaving the rescheduled occurrence job intact',
      jobNov5Completed === null &&
      jobNov8StillActive !== null &&
      jobNov8StillActive.status === 'pending'
    );

    // 4. Changing reminder settings updates the appropriate jobs without duplicate delivery
    collisionTask.reminder.minutesBefore = 30;
    await collisionTask.save();
    await syncTaskReminders(collisionTask, { windowDays: 10 });

    const updatedJobNov8 = await ReminderJob.findOne({
      taskId: collisionTask._id,
      occurrenceKey: '2026-11-02',
    });
    const totalJobsForTask = await ReminderJob.countDocuments({ taskId: collisionTask._id });
    const distinctKeys = await ReminderJob.distinct('occurrenceKey', { taskId: collisionTask._id });

    record(
      '4. Changing reminder settings updates appropriate jobs without duplicate delivery or duplicate keys',
      updatedJobNov8 !== null &&
      updatedJobNov8.minutesBefore === 30 &&
      totalJobsForTask === distinctKeys.length
    );

    // 5. Legacy backfill produces stable identities, verifies actual index definitions, and is safe to rerun
    const legacyTaskId = new mongoose.Types.ObjectId();
    await ReminderJob.collection.insertOne({
      taskId: legacyTaskId,
      userId: creatorId,
      taskStartDate: '2026-11-12',
      taskStartTime: '10:00',
      isAllDay: false,
      isRecurring: true,
      originalOccurrenceDate: '2026-11-12',
      taskTitle: 'Legacy Unkeyed Job',
      minutesBefore: 15,
      fireTime: new Date('2026-11-12T14:45:00.000Z'),
      timezone: 'America/New_York',
      status: 'pending',
      // occurrenceKey is omitted
    });

    const migrationResult1 = await ensureReminderJobIndexes({ log: false });
    const backfilledDoc = await ReminderJob.findOne({ taskId: legacyTaskId });
    const migrationResult2 = await ensureReminderJobIndexes({ log: false });

    // Verify actual index definitions in MongoDB
    const activeIndexes = await ReminderJob.collection.indexes();
    const verifiedNewIndex = activeIndexes.find(
      (idx) =>
        idx.key?.taskId === 1 &&
        idx.key?.userId === 1 &&
        idx.key?.occurrenceKey === 1 &&
        idx.unique === true
    );
    const oldIndexRemaining = activeIndexes.find(
      (idx) => idx.key?.taskStartDate === 1 && idx.unique === true
    );

    record(
      '5. Legacy backfill produces stable identities, verifies actual index definitions, and is safe to rerun',
      migrationResult1.success === true &&
      migrationResult1.backfilled >= 1 &&
      backfilledDoc !== null &&
      backfilledDoc.occurrenceKey === '2026-11-12' &&
      migrationResult2.success === true &&
      migrationResult2.backfilled === 0 &&
      verifiedNewIndex !== undefined &&
      oldIndexRemaining === undefined
    );

    // 6a. Duplicate legacy records cause safe diagnostics and halt migration with duplicates_found
    const dupeTaskId = new mongoose.Types.ObjectId();
    try {
      await ReminderJob.collection.dropIndex('taskId_1_userId_1_occurrenceKey_1');
    } catch {}

    await ReminderJob.collection.insertMany([
      {
        taskId: dupeTaskId,
        userId: creatorId,
        taskStartDate: '2026-11-20',
        occurrenceKey: 'dupe_test_key',
        taskTitle: 'Dupe 1',
        minutesBefore: 15,
        fireTime: new Date('2026-11-20T14:45:00.000Z'),
        status: 'pending',
      },
      {
        taskId: dupeTaskId,
        userId: creatorId,
        taskStartDate: '2026-11-21',
        occurrenceKey: 'dupe_test_key',
        taskTitle: 'Dupe 2',
        minutesBefore: 15,
        fireTime: new Date('2026-11-21T14:45:00.000Z'),
        status: 'pending',
      },
    ]);

    const dupeCheckResult = await ensureReminderJobIndexes({ log: false });
    record(
      '6a. Duplicate legacy records cause safe diagnostics and halt migration with duplicates_found',
      dupeCheckResult.success === false &&
      dupeCheckResult.reason === 'duplicates_found' &&
      dupeCheckResult.duplicateCount >= 1
    );

    // Clean up dupe test records
    await ReminderJob.deleteMany({ taskId: dupeTaskId });

    // 6b. Ambiguous legacy records cause fail-closed halt with ambiguous_records_found
    const ambiguousTaskId = new mongoose.Types.ObjectId();
    await ReminderJob.collection.insertOne({
      taskId: ambiguousTaskId,
      userId: creatorId,
      taskStartDate: 'invalid-date-format',
      isRecurring: true,
      originalOccurrenceDate: null,
      taskTitle: 'Ambiguous Job',
      minutesBefore: 15,
      fireTime: new Date('2026-11-20T14:45:00.000Z'),
      status: 'pending',
    });

    const ambiguousResult = await ensureReminderJobIndexes({ log: false });
    record(
      '6b. Ambiguous legacy records cause safe fail-closed halt with ambiguous_records_found',
      ambiguousResult.success === false &&
      ambiguousResult.reason === 'ambiguous_records_found' &&
      ambiguousResult.ambiguousCount >= 1
    );

    // Clean up ambiguous test records and ensure indexes restored
    await ReminderJob.deleteMany({ taskId: ambiguousTaskId });
    await ensureReminderJobIndexes({ log: false });

    // 7. Concurrent scheduler calls cannot create duplicate jobs for the same occurrence identity
    const raceTask = await Task.create({
      userId: creatorId,
      title: 'Race Condition Task',
      startDate: new Date('2026-11-25T00:00:00.000Z'),
      startTime: '10:00',
      recurrence: { frequency: 'daily', interval: 1, until: new Date('2026-11-27T00:00:00.000Z') },
      reminder: { enabled: true, minutesBefore: 15 },
    });

    await Promise.all([
      syncTaskReminders(raceTask, { windowDays: 5 }),
      syncTaskReminders(raceTask, { windowDays: 5 }),
      syncTaskReminders(raceTask, { windowDays: 5 }),
    ]);

    const raceJobs = await ReminderJob.find({ taskId: raceTask._id });
    const raceOccKeys = raceJobs.map((j) => j.occurrenceKey);
    const uniqueRaceOccKeys = new Set(raceOccKeys);

    record(
      '7. Concurrent scheduler sync calls cannot create duplicate jobs for the same occurrence identity',
      raceJobs.length === 3 &&
      raceJobs.length === uniqueRaceOccKeys.size
    );

    // =========================================================================
    // SUITE 2: Rolling Window Replenishment
    // =========================================================================
    console.log('\n\x1b[1mSuite 2: Rolling Window Replenishment\x1b[0m');

    // 8. An active recurring task is initially projected through the target horizon
    const rollingTask = await Task.create({
      userId: creatorId,
      title: 'Rolling Horizon Task',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      startTime: '08:00',
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: true, minutesBefore: 15 },
    });

    const initReplenish = await replenishRecurringReminders({ targetWindowDays: 14, batchSize: 10 });
    const initialJobs = await ReminderJob.find({ taskId: rollingTask._id }).sort({ taskStartDate: 1 });

    record(
      '8. Active recurring task is initially projected through target horizon (14 days)',
      initReplenish.tasksProcessed >= 1 &&
      initialJobs.length >= 10
    );

    // 9. After simulated time advances, replenishment extends the horizon
    const extendedReplenish = await replenishRecurringReminders({ targetWindowDays: 30, batchSize: 10 });
    const extendedJobs = await ReminderJob.find({ taskId: rollingTask._id }).sort({ taskStartDate: 1 });

    record(
      '9. Replenishment extends the horizon as window advances (from 14 to 30 days)',
      extendedReplenish.tasksProcessed >= 1 &&
      extendedJobs.length > initialJobs.length &&
      extendedJobs.length >= 25
    );

    // 10. Missing jobs inside the horizon are restored
    const targetToDelete = extendedJobs[5];
    await ReminderJob.deleteOne({ _id: targetToDelete._id });
    const countBeforeRestore = await ReminderJob.countDocuments({ taskId: rollingTask._id });

    await replenishRecurringReminders({ targetWindowDays: 30, batchSize: 10 });
    const restoredJob = await ReminderJob.findOne({
      taskId: rollingTask._id,
      occurrenceKey: targetToDelete.occurrenceKey,
    });
    const countAfterRestore = await ReminderJob.countDocuments({ taskId: rollingTask._id });

    record(
      '10. Missing jobs inside the horizon are safely restored by replenishment',
      countBeforeRestore === extendedJobs.length - 1 &&
      restoredJob !== null &&
      countAfterRestore === extendedJobs.length
    );

    // 11. Repeated calls do not duplicate or overwrite existing jobs
    const countBeforeRepeat = await ReminderJob.countDocuments({ taskId: rollingTask._id });
    await replenishRecurringReminders({ targetWindowDays: 30, batchSize: 10 });
    await replenishRecurringReminders({ targetWindowDays: 30, batchSize: 10 });
    const countAfterRepeat = await ReminderJob.countDocuments({ taskId: rollingTask._id });

    record(
      '11. Repeated replenishment calls do not duplicate or overwrite existing jobs',
      countBeforeRepeat === countAfterRepeat
    );

    // 12. Tasks beyond the until date, completed tasks, and disabled reminders are excluded
    const untilExpiredTask = await Task.create({
      userId: creatorId,
      title: 'Expired Until Task',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      recurrence: { frequency: 'daily', interval: 1, until: new Date('2026-09-10T00:00:00.000Z') },
      reminder: { enabled: true },
    });
    const completedTask = await Task.create({
      userId: creatorId,
      title: 'Completed Series Task',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      status: 'Done',
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: true },
    });
    const disabledReminderTask = await Task.create({
      userId: creatorId,
      title: 'Disabled Reminder Task',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: false },
    });

    await replenishRecurringReminders({ targetWindowDays: 30, batchSize: 50 });

    const expiredJobs = await ReminderJob.find({ taskId: untilExpiredTask._id });
    const completedJobs = await ReminderJob.find({ taskId: completedTask._id });
    const disabledJobs = await ReminderJob.find({ taskId: disabledReminderTask._id });

    record(
      '12. Tasks beyond until date, completed tasks, and disabled reminders are excluded from job generation',
      expiredJobs.length === 0 &&
      completedJobs.length === 0 &&
      disabledJobs.length === 0
    );

    // 13. Batch processing fair round-robin advancement and starvation prevention
    const malformedTask = await Task.create({
      userId: creatorId,
      title: 'Malformed Task For Failure Test',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: true },
    });
    // Set title to empty via raw collection so Mongoose ReminderJob.create throws validation error on sync
    await Task.collection.updateOne({ _id: malformedTask._id }, { $set: { title: '' } });

    const healthyTask = await Task.create({
      userId: creatorId,
      title: 'Healthy Task To Avoid Starvation',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: true },
    });

    // Run batchSize = 1: malformedTask fails, but its checkpoint advances to now
    const run1 = await replenishRecurringReminders({ targetWindowDays: 7, batchSize: 1 });
    const malformedAfterRun1 = await Task.findById(malformedTask._id);

    // Run batchSize = 1 again: healthyTask should be selected and processed without being starved!
    const run2 = await replenishRecurringReminders({ targetWindowDays: 7, batchSize: 1 });
    const healthyAfterRun2 = await Task.findById(healthyTask._id);
    const healthyJobs = await ReminderJob.find({ taskId: healthyTask._id });

    record(
      '13. Failing task advances rotation checkpoint without starving subsequent healthy tasks',
      run1.errors >= 1 &&
      malformedAfterRun1.lastReminderReplenishedAt !== null &&
      run2.tasksProcessed >= 1 &&
      healthyAfterRun2.lastReminderReplenishedAt !== null &&
      healthyJobs.length > 0
    );

    // 14. Partial failure in replenishment surfaces safe warning while reminder & overdue processing succeed
    // Create a due reminder job and overdue task to verify isolated concurrent execution
    const dueSingleTask = await Task.create({
      userId: creatorId,
      title: 'Due Task During Partial Failure',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      startTime: '09:00',
      status: 'To Do',
      reminder: { enabled: true, minutesBefore: 15 },
    });
    await syncTaskReminders(dueSingleTask);
    await ReminderJob.updateOne(
      { taskId: dueSingleTask._id },
      { $set: { fireTime: new Date(Date.now() - 60000), status: 'pending' } }
    );

    // Reset malformedTask checkpoint so it triggers a partial replenishment error during scheduler call
    await Task.collection.updateOne({ _id: malformedTask._id }, { $set: { lastReminderReplenishedAt: null } });

    const mockReq = {
      headers: { authorization: `Bearer ${config.reminderSchedulerSecret}` },
      body: { batchSize: 20 },
    };
    let capturedRes = {};
    const mockRes = {
      status(code) {
        capturedRes.statusCode = code;
        return this;
      },
      json(payload) {
        capturedRes.body = payload;
        return this;
      },
    };

    await processRemindersTrigger(mockReq, mockRes, () => {});

    record(
      '14. POST /api/reminders/process returns safe warning on partial failure while processing reminder jobs and overdue notifications',
      capturedRes.statusCode === 200 &&
      capturedRes.body.success === false &&
      typeof capturedRes.body.warning === 'string' &&
      capturedRes.body.warning.includes('recurring task(s) encountered replenishment errors') &&
      capturedRes.body.processed >= 1 &&
      typeof capturedRes.body.replenished === 'number'
    );

    // Clean up malformed test task
    await Task.deleteOne({ _id: malformedTask._id });

    // 15. Concurrent replenishment calls remain safe
    const concurrentTask = await Task.create({
      userId: creatorId,
      title: 'Concurrent Replenishment Task',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      recurrence: { frequency: 'weekly', interval: 1 },
      reminder: { enabled: true },
    });

    await Promise.all([
      replenishRecurringReminders({ targetWindowDays: 30, batchSize: 20 }),
      replenishRecurringReminders({ targetWindowDays: 30, batchSize: 20 }),
      replenishRecurringReminders({ targetWindowDays: 30, batchSize: 20 }),
    ]);

    const concurrentJobs = await ReminderJob.find({ taskId: concurrentTask._id });
    const concurrentKeys = concurrentJobs.map((j) => j.occurrenceKey);
    const uniqueConcurrentKeys = new Set(concurrentKeys);

    record(
      '15. Concurrent replenishment invocations execute safely without producing duplicate occurrence jobs',
      concurrentJobs.length > 0 &&
      concurrentJobs.length === uniqueConcurrentKeys.size
    );

    // =========================================================================
    // SUITE 3: Regressions and Security
    // =========================================================================
    console.log('\n\x1b[1mSuite 3: Regressions and Security\x1b[0m');

    // 16. Existing one-time reminders continue to work
    const singleTask = await Task.create({
      userId: creatorId,
      title: 'Single One-Time Task',
      startDate: new Date('2026-11-10T00:00:00.000Z'),
      startTime: '15:00',
      isAllDay: false,
      reminder: { enabled: true, minutesBefore: 30 },
    });
    await syncTaskReminders(singleTask);

    const singleJob = await ReminderJob.findOne({ taskId: singleTask._id });
    record(
      '16. Existing one-time reminders continue to work with occurrenceKey="single"',
      singleJob !== null &&
      singleJob.occurrenceKey === 'single' &&
      singleJob.isRecurring === false &&
      singleJob.taskStartDate === '2026-11-10' &&
      singleJob.minutesBefore === 30
    );

    // 17. Retry backoff, lease recovery, and timezone/DST behavior remain intact
    // Spring forward DST conversion in America/New_York (2026-03-08 02:30 -> 03:30 EDT -> 07:30 UTC)
    const dstInstant = calculateEventInstant({
      dateStr: '2026-03-08',
      timeStr: '02:30',
      timezone: 'America/New_York',
    });
    record(
      '17. Timezone DST spring-forward policy advances across gap (2026-03-08 02:30 EDT -> 07:30 UTC)',
      dstInstant.toISOString() === '2026-03-08T07:30:00.000Z'
    );

    // 18. Unauthenticated scheduler requests still return 401
    const unauthReq = {
      headers: { authorization: 'Bearer invalid_secret_token' },
      body: {},
    };
    let unauthRes = {};
    const mockUnauthRes = {
      status(code) {
        unauthRes.statusCode = code;
        return this;
      },
      json(payload) {
        unauthRes.body = payload;
        return this;
      },
    };

    await processRemindersTrigger(unauthReq, mockUnauthRes, () => {});
    record(
      '18. Unauthenticated scheduler requests to POST /api/reminders/process return 401 Unauthorized',
      unauthRes.statusCode === 401 &&
      unauthRes.body.success === false
    );

    // 19. Existing recurring rescheduling and conflict behavior remain intact
    singleTask.startDate = new Date('2026-11-15T00:00:00.000Z');
    await singleTask.save();
    await syncTaskReminders(singleTask);

    const updatedSingleJob = await ReminderJob.findOne({ taskId: singleTask._id });
    record(
      '19. Moving single task updates single job date and fire time cleanly',
      updatedSingleJob !== null &&
      updatedSingleJob.taskStartDate === '2026-11-15' &&
      updatedSingleJob.occurrenceKey === 'single'
    );

    // =========================================================================
    // SUITE 4: In-App Notification Idempotency, Lease Recovery & Shutdown
    // =========================================================================
    console.log('\n\x1b[1mSuite 4: In-App Notification Idempotency, Lease Recovery & Shutdown\x1b[0m');

    // 20. Retrying the same occurrence does not create duplicate notifications
    const recurringNotifTask = await Task.create({
      userId: creatorId,
      title: 'Recurring Notification Task',
      startDate: new Date('2026-11-20T00:00:00.000Z'),
      startTime: '10:00',
      recurrence: { frequency: 'daily', interval: 1 },
      reminder: { enabled: true, minutesBefore: 15 },
    });

    const jobOcc1 = await ReminderJob.create({
      taskId: recurringNotifTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-20',
      taskStartTime: '10:00',
      taskTitle: recurringNotifTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 60000), // In past
      isRecurring: true,
      occurrenceDate: '2026-11-20',
      originalOccurrenceDate: '2026-11-20',
      occurrenceKey: '2026-11-20',
      status: 'pending',
    });

    await processReminderJobs({ batchSize: 10 });
    const notifsAfterFirstRun = await Notification.find({
      userId: creatorId,
      relatedTaskId: recurringNotifTask._id,
      type: 'task_reminder',
      occurrenceKey: '2026-11-20',
    });

    // Simulate transient failure retry where inApp status is reset to pending
    jobOcc1.status = 'pending';
    jobOcc1.channelStatus = {
      inApp: { status: 'pending', sentAt: null, notificationId: null, error: null },
      email: { status: 'pending', sentAt: null, error: null },
    };
    await jobOcc1.save();

    await processReminderJobs({ batchSize: 10 });
    const notifsAfterRetry = await Notification.find({
      userId: creatorId,
      relatedTaskId: recurringNotifTask._id,
      type: 'task_reminder',
      occurrenceKey: '2026-11-20',
    });

    record(
      '20. Retrying the same occurrence does not create duplicate notifications',
      notifsAfterFirstRun.length === 1 && notifsAfterRetry.length === 1
    );

    // 21. Two distinct occurrences of one recurring task each create a notification within 24 hours
    const jobOcc2 = await ReminderJob.create({
      taskId: recurringNotifTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-21', // Next day (within 24h)
      taskStartTime: '10:00',
      taskTitle: recurringNotifTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 30000),
      isRecurring: true,
      occurrenceDate: '2026-11-21',
      originalOccurrenceDate: '2026-11-21',
      occurrenceKey: '2026-11-21',
      status: 'pending',
    });

    await processReminderJobs({ batchSize: 10 });
    const allTaskNotifs = await Notification.find({
      userId: creatorId,
      relatedTaskId: recurringNotifTask._id,
      type: 'task_reminder',
    });

    const notifKeys = allTaskNotifs.map((n) => n.occurrenceKey);
    record(
      '21. Two distinct occurrences of one recurring task each create a notification within 24 hours',
      allTaskNotifs.length === 2 &&
      notifKeys.includes('2026-11-20') &&
      notifKeys.includes('2026-11-21')
    );

    // 22. Rescheduled occurrences use the correct identity
    recurringNotifTask.recurrenceExceptions.push({
      date: '2026-11-25',
      rescheduledDate: '2026-11-20',
      startTime: '16:00',
      endTime: '17:00',
      action: 'rescheduled',
      status: 'To Do',
    });
    await recurringNotifTask.save();

    const jobRescheduled = await ReminderJob.create({
      taskId: recurringNotifTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-20',
      taskStartTime: '16:00',
      taskTitle: recurringNotifTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 20000),
      isRecurring: true,
      occurrenceDate: '2026-11-20',
      originalOccurrenceDate: '2026-11-25',
      occurrenceKey: '2026-11-25', // preserves original series identity
      status: 'pending',
    });

    await processReminderJobs({ batchSize: 10 });
    const reschedNotif = await Notification.findOne({
      userId: creatorId,
      relatedTaskId: recurringNotifTask._id,
      occurrenceKey: '2026-11-25',
    });

    record(
      '22. Rescheduled occurrences use the correct identity',
      reschedNotif !== null && reschedNotif.occurrenceKey === '2026-11-25'
    );

    // 23. Existing non-recurring task reminders continue to work
    const nonRecTask = await Task.create({
      userId: creatorId,
      title: 'Standard Non-Recurring Task',
      startDate: new Date('2026-11-28T00:00:00.000Z'),
      startTime: '11:00',
      reminder: { enabled: true, minutesBefore: 15 },
    });

    const nonRecJob = await ReminderJob.create({
      taskId: nonRecTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-28',
      taskStartTime: '11:00',
      taskTitle: nonRecTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 10000),
      isRecurring: false,
      occurrenceKey: 'single',
      status: 'pending',
    });

    await processReminderJobs({ batchSize: 10 });
    const singleNotifs = await Notification.find({
      userId: creatorId,
      relatedTaskId: nonRecTask._id,
      occurrenceKey: 'single',
    });

    // Retry non-recurring job
    nonRecJob.status = 'pending';
    nonRecJob.channelStatus = {
      inApp: { status: 'pending', sentAt: null, notificationId: null, error: null },
      email: { status: 'pending', sentAt: null, error: null },
    };
    await nonRecJob.save();
    await processReminderJobs({ batchSize: 10 });

    const singleNotifsAfterRetry = await Notification.find({
      userId: creatorId,
      relatedTaskId: nonRecTask._id,
      occurrenceKey: 'single',
    });

    record(
      '23. Existing non-recurring task reminders continue to work without duplicate on retry',
      singleNotifs.length === 1 && singleNotifsAfterRetry.length === 1
    );

    // 24. Abandoned processing job whose lease has expired is reclaimed safely; unexpired lease is not stolen
    const expiredJob = await ReminderJob.create({
      taskId: nonRecTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-28',
      taskStartTime: '11:00',
      taskTitle: nonRecTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 3600000),
      isRecurring: false,
      occurrenceKey: 'single_expired',
      status: 'processing',
      lockedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (lease expired past 5m)
      lockedBy: 'abandoned_worker_999',
    });

    const activeJob = await ReminderJob.create({
      taskId: nonRecTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-28',
      taskStartTime: '11:00',
      taskTitle: nonRecTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 3600000),
      isRecurring: false,
      occurrenceKey: 'single_active',
      status: 'processing',
      lockedAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago (lease unexpired)
      lockedBy: 'active_worker_111',
    });

    await processReminderJobs({
      batchSize: 10,
      leaseDurationMs: 5 * 60 * 1000,
      workerId: 'reclaimer_worker_222',
    });

    const refreshedExpiredJob = await ReminderJob.findById(expiredJob._id);
    const refreshedActiveJob = await ReminderJob.findById(activeJob._id);

    record(
      '24. Abandoned processing job is reclaimed after lease expiry while unexpired lease is preserved',
      refreshedExpiredJob.status === 'sent' &&
      refreshedActiveJob.status === 'processing' &&
      refreshedActiveJob.lockedBy === 'active_worker_111'
    );

    // 25. Graceful shutdown handler blocks new processing and drains in-flight safely
    const shutdownResult = await gracefulSchedulerShutdown({ timeoutMs: 500 });
    const isShutting = isSchedulerShuttingDown();
    const shutdownRun = await processReminderJobs({ batchSize: 5 });
    resetSchedulerShutdown();
    const isRestored = !isSchedulerShuttingDown();

    record(
      '25. Graceful shutdown drain stops new batches and restores cleanly',
      shutdownResult.completedCleanly === true &&
      isShutting === true &&
      shutdownRun.shutdown === true &&
      isRestored === true
    );
  } catch (error) {
    console.error('Fatal error during Stage 3.4 tests:', error);
    testResults.failed++;
  } finally {
    try {
      if (creatorId) {
        await Task.deleteMany({ userId: creatorId });
        await ReminderJob.deleteMany({ userId: creatorId });
        await Notification.deleteMany({ userId: creatorId });
        await User.deleteOne({ _id: creatorId });
      }
    } catch (cleanupErr) {
      console.warn('  \x1b[33m⚠\x1b[0m Cleanup warning:', cleanupErr.message);
    }

    console.log('\n=======================================================');
    console.log('            STAGE 3.4 TEST SUMMARY');
    console.log('=======================================================');
    console.log(`  ✔ Passed: ${testResults.passed}`);
    console.log(`  ✖ Failed: ${testResults.failed}`);
    console.log(`  Total:    ${testResults.tests.length}`);

    await mongoose.disconnect();

    if (testResults.failed > 0) {
      process.exit(1);
    }
  }
}

runStage34Tests();
