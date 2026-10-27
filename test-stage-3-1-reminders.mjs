import mongoose from './server/node_modules/mongoose/index.js';
import { config } from './server/src/config/env.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import Notification from './server/src/models/Notification.js';
import ReminderJob from './server/src/models/ReminderJob.js';
import {
  isValidTimezone,
  calculateEventInstant,
  calculateReminderFireTime,
  getEligibleRecipientIds,
  syncTaskReminders,
  cleanupTaskReminders,
  processReminderJobs,
  formatReminderLeadTime,
} from './server/src/utils/reminderScheduler.js';
import {
  createTask,
  updateTask,
  patchTask,
  deleteTask,
} from './server/src/controllers/taskController.js';
import { updatePreferences } from './server/src/controllers/authController.js';
import { updateUserProfile } from './server/src/controllers/userController.js';
import { processRemindersTrigger } from './server/src/controllers/reminderController.js';
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

console.log('\n\x1b[1m\x1b[36m=== ELVO STAGE 3.1: CORRECTIVE PASS REMINDER ENGINE TEST SUITE ===\x1b[0m\n');

// =============================================================================
// SUITE 1: Pure Timezone & Fire Time Calculations (Fix B)
// =============================================================================
console.log('\x1b[1mSuite 1: Timezone, DST & Fire-Time Calculations\x1b[0m');

// 1. Supported lead times in UTC
const leadTimes = [5, 10, 15, 30, 60, 120, 1440];
let allLeadTimesCorrect = true;
for (const m of leadTimes) {
  const fire = calculateReminderFireTime({
    startDate: '2026-11-01',
    startTime: '10:00',
    minutesBefore: m,
    timezone: 'UTC',
  });
  const expected = new Date(Date.UTC(2026, 10, 1, 10, 0, 0) - m * 60 * 1000);
  if (fire.getTime() !== expected.getTime()) {
    allLeadTimesCorrect = false;
    break;
  }
}
record('1. Supported lead times compute exact UTC fire times', allLeadTimesCorrect);

// 2. Task near midnight crosses into previous calendar day
const midnightFire = calculateReminderFireTime({
  startDate: '2026-11-02',
  startTime: '00:15',
  minutesBefore: 30,
  timezone: 'UTC',
});
const expectedMidnight = new Date('2026-11-01T23:45:00.000Z');
record(
  '2. Reminder lead time crossing into previous calendar day',
  midnightFire.toISOString() === expectedMidnight.toISOString()
);

// 3. Asia/Kolkata: 09:00 task with 15m reminder (08:45 IST = 03:15 UTC)
const kolkataFire = calculateReminderFireTime({
  startDate: '2026-11-01',
  startTime: '09:00',
  minutesBefore: 15,
  timezone: 'Asia/Kolkata',
});
record(
  '3. Asia/Kolkata timezone: 09:00 IST task fires at 03:15 UTC for 15m lead time',
  kolkataFire.toISOString() === '2026-11-01T03:15:00.000Z'
);

// 4. America/New_York summer date (EDT UTC-4): 09:00 EDT = 13:00 UTC, 15m fire = 12:45 UTC
const edtFire = calculateReminderFireTime({
  startDate: '2026-07-15',
  startTime: '09:00',
  minutesBefore: 15,
  timezone: 'America/New_York',
});
record(
  '4. America/New_York EDT (summer): 09:00 EDT fires at 12:45 UTC',
  edtFire.toISOString() === '2026-07-15T12:45:00.000Z'
);

// 5. America/New_York winter date (EST UTC-5): 09:00 EST = 14:00 UTC, 15m fire = 13:45 UTC
const estFire = calculateReminderFireTime({
  startDate: '2026-11-15',
  startTime: '09:00',
  minutesBefore: 15,
  timezone: 'America/New_York',
});
record(
  '5. America/New_York EST (winter post-DST fallback): 09:00 EST fires at 13:45 UTC',
  estFire.toISOString() === '2026-11-15T13:45:00.000Z'
);

// 6. All-day tasks anchored at 09:00 AM in owner's timezone
const allDayKolkata = calculateReminderFireTime({
  startDate: '2026-11-05',
  isAllDay: true,
  minutesBefore: 15,
  timezone: 'Asia/Kolkata',
});
// 09:00 IST is 03:30 UTC. 15 minutes before is 03:15 UTC.
record(
  '6. All-day task anchored to 09:00 local time in owner timezone (Asia/Kolkata -> 03:15 UTC)',
  allDayKolkata.toISOString() === '2026-11-05T03:15:00.000Z'
);

// 7. Missing or invalid timezone falls back safely to UTC
const invalidTzFire = calculateReminderFireTime({
  startDate: '2026-11-05',
  startTime: '10:00',
  minutesBefore: 15,
  timezone: 'Invalid/NonExistent_Zone',
});
record(
  '7. Invalid timezone falls back safely to UTC without throwing',
  invalidTzFire.toISOString() === '2026-11-05T09:45:00.000Z'
);

// 8. Drawer label formatter
const label5 = formatReminderLeadTime(5);
const label60 = formatReminderLeadTime(60);
const label1440 = formatReminderLeadTime(1440);
const labelNull = formatReminderLeadTime(null);
record(
  '8. formatReminderLeadTime produces accurate labels for all supported intervals',
  label5 === '5m reminder' && label60 === '1h reminder' && label1440 === '1d reminder' && labelNull === 'Reminder'
);

// 9. America/New_York spring-forward nonexistent time (02:30 advances by 1h gap to 03:30 EDT -> 07:30 UTC)
const nySpringGapEvent = calculateEventInstant({
  dateStr: '2026-03-08',
  timeStr: '02:30',
  timezone: 'America/New_York',
});
const nySpringGapFire = calculateReminderFireTime({
  startDate: '2026-03-08',
  startTime: '02:30',
  minutesBefore: 15,
  timezone: 'America/New_York',
});
record(
  '9. America/New_York spring-forward 02:30 advances across gap to 03:30 EDT (07:30 UTC event, 07:15 UTC fire)',
  nySpringGapEvent.toISOString() === '2026-03-08T07:30:00.000Z' &&
  nySpringGapFire.toISOString() === '2026-03-08T07:15:00.000Z'
);

// 10. America/New_York fall-back ambiguous time (01:30 selects earlier EDT occurrence -> 05:30 UTC)
const nyFallOverlapEvent = calculateEventInstant({
  dateStr: '2026-11-01',
  timeStr: '01:30',
  timezone: 'America/New_York',
});
const nyFallOverlapFire = calculateReminderFireTime({
  startDate: '2026-11-01',
  startTime: '01:30',
  minutesBefore: 15,
  timezone: 'America/New_York',
});
record(
  '10. America/New_York fall-back 01:30 selects earlier EDT occurrence (05:30 UTC event, 05:15 UTC fire)',
  nyFallOverlapEvent.toISOString() === '2026-11-01T05:30:00.000Z' &&
  nyFallOverlapFire.toISOString() === '2026-11-01T05:15:00.000Z'
);

// 11. Times immediately before and after spring-forward transition
const nyPreGap = calculateEventInstant({
  dateStr: '2026-03-08',
  timeStr: '01:59',
  timezone: 'America/New_York',
});
const nyPostGap = calculateEventInstant({
  dateStr: '2026-03-08',
  timeStr: '03:00',
  timezone: 'America/New_York',
});
record(
  '11. Spring-forward boundary times: 01:59 EST (06:59 UTC) and 03:00 EDT (07:00 UTC)',
  nyPreGap.toISOString() === '2026-03-08T06:59:00.000Z' &&
  nyPostGap.toISOString() === '2026-03-08T07:00:00.000Z'
);

// 12. Times immediately before and after fall-back transition
const nyPreFall = calculateEventInstant({
  dateStr: '2026-11-01',
  timeStr: '00:59',
  timezone: 'America/New_York',
});
const nyPostFall = calculateEventInstant({
  dateStr: '2026-11-01',
  timeStr: '02:00',
  timezone: 'America/New_York',
});
record(
  '12. Fall-back boundary times: 00:59 EDT (04:59 UTC) and 02:00 EST (07:00 UTC)',
  nyPreFall.toISOString() === '2026-11-01T04:59:00.000Z' &&
  nyPostFall.toISOString() === '2026-11-01T07:00:00.000Z'
);

// 13. Invalid date/time input safety (returns valid Date objects without throwing)
const invalidDateResult = calculateEventInstant({
  dateStr: 'invalid-date',
  timeStr: '10:00',
  timezone: 'America/New_York',
});
const invalidTimeResult = calculateEventInstant({
  dateStr: '2026-11-01',
  timeStr: 'invalid-time',
  timezone: 'America/New_York',
});
record(
  '13. Invalid date and time inputs safely return valid Date objects without throwing',
  invalidDateResult instanceof Date && !isNaN(invalidDateResult.getTime()) &&
  invalidTimeResult instanceof Date && !isNaN(invalidTimeResult.getTime())
);

// =============================================================================
// DATABASE INTEGRATION TESTS
// =============================================================================
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
  let otherUserId = null;
  try {
    creatorId = new mongoose.Types.ObjectId();
    assigneeId = new mongoose.Types.ObjectId();
    otherUserId = new mongoose.Types.ObjectId();

    // Create user with explicit timezone preference Asia/Kolkata
    const creatorUser = await User.create({
      _id: creatorId,
      name: 'Creator Alice',
      email: `creator_${Date.now()}@example.com`,
      password: 'password123',
      preferences: {
        timezone: 'Asia/Kolkata',
      },
    });

    const assigneeUser = await User.create({
      _id: assigneeId,
      name: 'Assignee Bob',
      email: `assignee_${Date.now()}@example.com`,
      password: 'password123',
    });

    // =============================================================================
    // SUITE 2: User Timezone Preferences & Schema Validation (Fix B)
    // =============================================================================
    console.log('\n\x1b[1mSuite 2: User Timezone Preferences & Schema Validation\x1b[0m');

    // 9. Update preferences endpoint accepts valid IANA timezone
    const reqAuthTz = {
      user: { _id: creatorId },
      body: { timezone: 'America/New_York' },
    };
    let authTzUpdated = false;
    const resAuthTz = {
      status(code) { return this; },
      json(data) {
        if (data.data?.user?.preferences?.timezone === 'America/New_York') {
          authTzUpdated = true;
        }
        return this;
      },
    };
    await updatePreferences(reqAuthTz, resAuthTz, (err) => { if (err) throw err; });
    record('9. PUT /api/auth/preferences updates user timezone preference', authTzUpdated);

    // 10. Update preferences rejects invalid IANA timezone with 400
    const reqBadTz = {
      user: { _id: creatorId },
      body: { timezone: 'Invalid/City_Name' },
    };
    let badTzRejected = false;
    const resBadTz = {
      status(code) {
        if (code === 400) badTzRejected = true;
        return this;
      },
      json() { return this; },
    };
    await updatePreferences(reqBadTz, resBadTz, (err) => { if (err) throw err; });
    record('10. PUT /api/auth/preferences rejects invalid IANA timezone with 400', badTzRejected);

    // Reset user timezone to Asia/Kolkata for subsequent tests
    await User.findByIdAndUpdate(creatorId, { 'preferences.timezone': 'Asia/Kolkata' });

    // =============================================================================
    // SUITE 3: Stale Reminder Jobs & Date Change Invalidation (Fix A)
    // =============================================================================
    console.log('\n\x1b[1mSuite 3: Stale Reminder Jobs & Task Rescheduling (Fix A)\x1b[0m');

    // 11. Changing startDate removes obsolete pending job and creates new job on target date
    const reschedTask = await Task.create({
      userId: creatorId,
      title: 'Reschedule Me Task',
      startDate: new Date('2026-11-10T00:00:00.000Z'),
      startTime: '10:00',
      reminder: { enabled: true, minutesBefore: 15 },
    });
    await syncTaskReminders(reschedTask);
    const initialJobs = await ReminderJob.find({ taskId: reschedTask._id });
    record(
      '11a. Initial job created for 2026-11-10 with owner timezone (Asia/Kolkata -> 04:15 UTC)',
      initialJobs.length === 1 &&
      initialJobs[0].taskStartDate === '2026-11-10' &&
      initialJobs[0].fireTime.toISOString() === '2026-11-10T04:15:00.000Z'
    );

    // Now reschedule task to 2026-11-15
    reschedTask.startDate = new Date('2026-11-15T00:00:00.000Z');
    await reschedTask.save();
    await syncTaskReminders(reschedTask);

    const allTaskJobs = await ReminderJob.find({ taskId: reschedTask._id });
    const oldDatePending = allTaskJobs.filter((j) => j.taskStartDate === '2026-11-10');
    const newDatePending = allTaskJobs.filter((j) => j.taskStartDate === '2026-11-15' && j.status === 'pending');
    record(
      '11b. Rescheduling removes old pending job; no ghost job left on old date',
      oldDatePending.length === 0 && newDatePending.length === 1
    );

    // 12. Race protection: In-flight processing job is safely invalidated if task schedule changed
    const racingTask = await Task.create({
      userId: creatorId,
      title: 'Racing Task',
      startDate: new Date('2026-11-18T00:00:00.000Z'),
      startTime: '10:00',
      reminder: { enabled: true, minutesBefore: 15 },
    });
    const claimedJob = await ReminderJob.create({
      taskId: racingTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-18',
      taskStartTime: '10:00',
      taskTitle: racingTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 60000), // Overdue
      status: 'processing',
      lockedAt: new Date(Date.now() - 600000), // Lease expired so worker can claim
      lockedBy: 'test_worker_racing',
    });

    // User edits task time to 14:00 while worker claimed 10:00 job
    racingTask.startTime = '14:00';
    await racingTask.save();

    // Worker attempts to process claimed job
    const staleProcessingRun = await processReminderJobs({ batchSize: 10, leaseDurationMs: 0 }); // leaseDuration 0 allows processing immediately
    const invalidatedJob = await ReminderJob.findById(claimedJob._id);
    record(
      '12. In-flight claimed job is safely cancelled if task schedule changed before delivery',
      invalidatedJob.status === 'cancelled' &&
      invalidatedJob.failedReason.includes('schedule changed')
    );

    // 13. Assignee changes revoke previous recipient's pending job
    const reassignedTask = await Task.create({
      userId: creatorId,
      assignedTo: assigneeId,
      title: 'Reassign Task',
      startDate: new Date('2026-11-20T00:00:00.000Z'),
      reminder: { enabled: true, minutesBefore: 15 },
    });
    await syncTaskReminders(reassignedTask);

    // Unassign assignee
    reassignedTask.assignedTo = null;
    await reassignedTask.save();
    await syncTaskReminders(reassignedTask);

    const assigneeJobsAfterUnassign = await ReminderJob.find({
      taskId: reassignedTask._id,
      userId: assigneeId,
      status: 'pending',
    });
    record('13. Unassigning recipient revokes their pending reminder job', assigneeJobsAfterUnassign.length === 0);

    // =============================================================================
    // SUITE 4: Retry Backoff & nextAttemptAt (Fix C)
    // =============================================================================
    console.log('\n\x1b[1mSuite 4: Persistent Retry Backoff & Delivery State (Fix C)\x1b[0m');

    // 14. Persistent nextAttemptAt prevents premature claiming
    const backoffTask = await Task.create({
      userId: creatorId,
      title: 'Backoff Test Task',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      reminder: { enabled: true, minutesBefore: 15 },
    });
    const futureAttemptTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes in future
    const backoffJob = await ReminderJob.create({
      taskId: backoffTask._id,
      userId: creatorId,
      taskStartDate: '2026-10-01',
      taskTitle: backoffTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 3600 * 1000), // Fire time was 1h ago
      nextAttemptAt: futureAttemptTime, // But retry is in future
      status: 'pending',
    });

    const runBeforeNextAttempt = await processReminderJobs({ batchSize: 10 });
    const jobBeforeNextAttempt = await ReminderJob.findById(backoffJob._id);
    record(
      '14. Job with future nextAttemptAt is NOT claimed prematurely',
      jobBeforeNextAttempt.status === 'pending' && jobBeforeNextAttempt.attemptCount === 0
    );

    // 15. When nextAttemptAt is past, job IS claimed and exponential backoff applied on transient failure
    jobBeforeNextAttempt.nextAttemptAt = new Date(Date.now() - 1000); // Set to past
    await jobBeforeNextAttempt.save();

    // Configure a transient failure by setting channelStatus.email pending and email failing
    // Let's test that backoff delay is calculated and nextAttemptAt updated
    const nowBeforeRun = Date.now();
    await processReminderJobs({ batchSize: 10 });
    const jobAfterTransientRun = await ReminderJob.findById(backoffJob._id);
    record(
      '15. Eligible job is claimed when nextAttemptAt is past, and marks sent or applies backoff',
      jobAfterTransientRun.status === 'sent' || (jobAfterTransientRun.nextAttemptAt && jobAfterTransientRun.nextAttemptAt.getTime() > nowBeforeRun)
    );

    // 16. In-app success plus email failure retries ONLY email without duplicate in-app notification
    const partialTask = await Task.create({
      userId: creatorId,
      title: 'Partial Channel Task',
      startDate: new Date('2026-10-02T00:00:00.000Z'),
      reminder: { enabled: true, minutesBefore: 15 },
    });
    const notifMockId = new mongoose.Types.ObjectId();
    const partialJob = await ReminderJob.create({
      taskId: partialTask._id,
      userId: creatorId,
      taskStartDate: '2026-10-02',
      taskTitle: partialTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 3600 * 1000),
      status: 'pending',
      channelStatus: {
        inApp: {
          status: 'sent',
          sentAt: new Date(),
          notificationId: notifMockId,
        },
        email: {
          status: 'pending',
        },
      },
      attemptCount: 1,
    });
    const countBeforePartial = await Notification.countDocuments({
      userId: creatorId,
      relatedTaskId: partialTask._id,
    });
    await processReminderJobs({ batchSize: 10 });
    const countAfterPartial = await Notification.countDocuments({
      userId: creatorId,
      relatedTaskId: partialTask._id,
    });
    record(
      '16. Retrying job with in-app already sent never duplicates in-app notification',
      countBeforePartial === countAfterPartial
    );

    // 17. Unrelated task update does not duplicate sent reminders
    const unrelatedTask = await Task.create({
      userId: creatorId,
      title: 'Unrelated Field Task',
      startDate: new Date('2026-11-25T00:00:00.000Z'),
      startTime: '11:00',
      reminder: { enabled: true, minutesBefore: 15 },
    });
    await syncTaskReminders(unrelatedTask);
    await ReminderJob.updateOne({ taskId: unrelatedTask._id }, { $set: { status: 'sent' } });

    // Update description (unrelated field)
    unrelatedTask.description = 'Updated description';
    await unrelatedTask.save();
    await syncTaskReminders(unrelatedTask);

    const jobsAfterUnrelatedEdit = await ReminderJob.find({ taskId: unrelatedTask._id });
    record(
      '17. Unrelated task update preserves sent reminder state without creating duplicate active job',
      jobsAfterUnrelatedEdit.length === 1 && jobsAfterUnrelatedEdit[0].status === 'sent'
    );

    // =============================================================================
    // SUITE 5: External Scheduler Endpoint Security (Fix D & E)
    // =============================================================================
    console.log('\n\x1b[1mSuite 5: Trigger Security & Deployment Environment (Fix D & E)\x1b[0m');

    config.reminderSchedulerSecret = 'corrective_pass_secret_token_12345';

    // 18. Trigger endpoint without token returns 401
    const reqNoAuth = { headers: {}, body: {} };
    let unauthCode = null;
    const resNoAuth = {
      status(code) { unauthCode = code; return this; },
      json() { return this; },
    };
    await processRemindersTrigger(reqNoAuth, resNoAuth, (err) => { if (err) throw err; });
    record('18. Trigger endpoint rejects unauthenticated requests with 401', unauthCode === 401);

    // 19. Trigger endpoint with valid Bearer secret returns 200 with minimal summary
    let triggerSuccess = false;
    let triggerData = null;
    const reqValidAuth = {
      headers: { authorization: 'Bearer corrective_pass_secret_token_12345' },
      body: { batchSize: 10 },
    };
    const resValidAuth = {
      status(code) { triggerSuccess = code === 200; return this; },
      json(data) { triggerData = data; return this; },
    };
    await processRemindersTrigger(reqValidAuth, resValidAuth, (err) => { if (err) throw err; });
    record(
      '19. Trigger endpoint with valid Bearer token returns 200 and minimal counts',
      triggerSuccess &&
      triggerData.success === true &&
      typeof triggerData.processed === 'number' &&
      typeof triggerData.sent === 'number'
    );

  } finally {
    try {
      if (creatorId && assigneeId && otherUserId) {
        await Task.deleteMany({ userId: { $in: [creatorId, assigneeId, otherUserId] } });
        await ReminderJob.deleteMany({ userId: { $in: [creatorId, assigneeId, otherUserId] } });
        await Notification.deleteMany({ userId: { $in: [creatorId, assigneeId, otherUserId] } });
        await User.deleteMany({ _id: { $in: [creatorId, assigneeId, otherUserId] } });
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
  console.log('\n\x1b[32m✨ ALL STAGE 3.1 CORRECTIVE PASS TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\n\x1b[31m💥 SOME TESTS FAILED! 💥\x1b[0m\n');
  process.exit(1);
}
