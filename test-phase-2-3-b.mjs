import {
  generateOccurrenceDates,
  projectTaskOccurrences,
  expandTasksForWindow,
} from './server/src/utils/recurrenceEngine.js';

import {
  generateOccurrenceDates as clientGenerate,
  projectTaskOccurrences as clientProject,
  expandTasksForWindow as clientExpand,
} from './client/src/utils/recurrenceEngine.js';

import mongoose from './server/node_modules/mongoose/index.js';
import { config } from './server/src/config/env.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import { updateTaskOccurrence, updateTask } from './server/src/controllers/taskController.js';

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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 2.3B — INDIVIDUAL RECURRENCE COMPLETION & SKIPPING SUITE ===\x1b[0m\n');

// =============================================================================
// SUITE 1: Engine Occurrence Projection & Exception Semantics
// =============================================================================
console.log('\x1b[1mSuite 1: Recurrence Engine Occurrence Exception Projections\x1b[0m');

const baseDailyTask = {
  _id: 'task_daily_1',
  title: 'Daily Standup',
  startDate: '2026-10-20',
  status: 'To Do',
  recurrence: { frequency: 'daily', interval: 1 },
};

// Test 1.1: Completing one occurrence leaves adjacent dates unchanged
const completedExceptionTask = {
  ...baseDailyTask,
  recurrenceExceptions: [
    { date: '2026-10-22', action: 'completed', status: 'Done' },
  ],
};
const projected1 = projectTaskOccurrences(completedExceptionTask, '2026-10-20', '2026-10-24');
const oct21 = projected1.find((p) => p.occurrenceDate === '2026-10-21');
const oct22 = projected1.find((p) => p.occurrenceDate === '2026-10-22');
const oct23 = projected1.find((p) => p.occurrenceDate === '2026-10-23');

record('Completing Oct 22 occurrence sets its status to Done', oct22 && oct22.status === 'Done');
record('Adjacent Oct 21 occurrence remains To Do', oct21 && oct21.status === 'To Do');
record('Adjacent Oct 23 occurrence remains To Do', oct23 && oct23.status === 'To Do');

// Test 1.2: Reopening a completed occurrence sets status to To Do
const reopenedExceptionTask = {
  ...baseDailyTask,
  recurrenceExceptions: [
    { date: '2026-10-22', action: 'modified', status: 'To Do' },
  ],
};
const projected2 = projectTaskOccurrences(reopenedExceptionTask, '2026-10-20', '2026-10-24');
const oct22Reopened = projected2.find((p) => p.occurrenceDate === '2026-10-22');
record('Reopening Oct 22 occurrence sets status to To Do', oct22Reopened && oct22Reopened.status === 'To Do');

// Test 1.3: Skipping one occurrence hides ONLY that date
const skippedExceptionTask = {
  ...baseDailyTask,
  recurrenceExceptions: [
    { date: '2026-10-22', action: 'skipped', status: 'Done' },
  ],
};
const projected3 = projectTaskOccurrences(skippedExceptionTask, '2026-10-20', '2026-10-24');
const oct22Skipped = projected3.find((p) => p.occurrenceDate === '2026-10-22');
const oct21Visible = projected3.find((p) => p.occurrenceDate === '2026-10-21');
const oct23Visible = projected3.find((p) => p.occurrenceDate === '2026-10-23');
record('Skipped Oct 22 occurrence is omitted from projections', !oct22Skipped);
record('Adjacent Oct 21 remains visible when Oct 22 is skipped', Boolean(oct21Visible));
record('Adjacent Oct 23 remains visible when Oct 22 is skipped', Boolean(oct23Visible));
record('Exactly 4 occurrences remain out of 5 in 5-day window', projected3.length === 4);

// Test 1.4: Client and Server engine parity with multiple exceptions
const multiExceptionTask = {
  ...baseDailyTask,
  recurrenceExceptions: [
    { date: '2026-10-21', action: 'completed', status: 'Done' },
    { date: '2026-10-22', action: 'skipped', status: 'Done' },
    { date: '2026-10-23', action: 'modified', status: 'To Do' },
  ],
};
const serverProj = projectTaskOccurrences(multiExceptionTask, '2026-10-20', '2026-10-25');
const clientProj = clientProject(multiExceptionTask, '2026-10-20', '2026-10-25');
record(
  'Client and server projectTaskOccurrences with exceptions produce identical output',
  JSON.stringify(serverProj) === JSON.stringify(clientProj)
);

// =============================================================================
// SUITE 2: Controller & Route Validation Logic
// =============================================================================
console.log('\n\x1b[1mSuite 2: Backend Controller & Route Validation\x1b[0m');

// Helper to simulate express req/res
const simulateOccurrenceCall = (id, body, user) => {
  return new Promise((resolve) => {
    const req = {
      params: { id, date: body.date },
      body,
      user,
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ statusCode: this.statusCode, data }); },
    };
    updateTaskOccurrence(req, res, (err) => resolve({ statusCode: 500, error: err }));
  });
};

// Test 2.1: Invalid task ID
const resInvalidId = await simulateOccurrenceCall('invalid-id-format', { date: '2026-10-25', action: 'complete' }, { _id: new mongoose.Types.ObjectId() });
record('Rejects invalid ObjectId format with 400', resInvalidId.statusCode === 400);

// Test 2.2: Malformed date strings
const resBadDate = await simulateOccurrenceCall(new mongoose.Types.ObjectId().toString(), { date: 'invalid-date', action: 'complete' }, { _id: new mongoose.Types.ObjectId() });
record('Rejects malformed date format with 400', resBadDate.statusCode === 400);

const resImpossibleDate = await simulateOccurrenceCall(new mongoose.Types.ObjectId().toString(), { date: '2026-02-31', action: 'complete' }, { _id: new mongoose.Types.ObjectId() });
record('Rejects impossible calendar date (Feb 31) with 400', resImpossibleDate.statusCode === 400);

// =============================================================================
// SUITE 3: Real Database & Permission Integration Tests
// =============================================================================
console.log('\n\x1b[1mSuite 3: Real MongoDB Database & Permission Integration Tests\x1b[0m');

let dbConnected = false;
try {
  await mongoose.connect(config.mongodbUri);
  dbConnected = true;
  console.log('  \x1b[32m✔\x1b[0m Connected to MongoDB for live integration tests');
} catch (err) {
  console.log('  \x1b[33m⚠\x1b[0m MongoDB connection failed; skipping live DB tests:', err.message);
}

if (dbConnected) {
  const testUserId1 = new mongoose.Types.ObjectId();
  const testUserId2 = new mongoose.Types.ObjectId();
  const createdTaskIds = [];

  try {
    // 3.1 Non-recurring task rejection
    const nonRecurring = await Task.create({
      userId: testUserId1,
      title: 'Non-Recurring Test Task',
      startDate: new Date('2026-10-25T00:00:00.000Z'),
      recurrence: { frequency: 'none' },
    });
    createdTaskIds.push(nonRecurring._id);

    const resNonRec = await simulateOccurrenceCall(nonRecurring._id.toString(), { date: '2026-10-25', action: 'complete' }, { _id: testUserId1 });
    record('Rejects non-recurring task with 400 (not a recurring series)', resNonRec.statusCode === 400 && resNonRec.data.message === 'Task is not a recurring series');

    // 3.2 Recurring daily task creation
    const recurringTask = await Task.create({
      userId: testUserId1,
      title: 'Daily Recurrence Series',
      startDate: new Date('2026-10-25T00:00:00.000Z'),
      status: 'To Do',
      recurrence: { frequency: 'daily', interval: 1, until: new Date('2026-10-30T00:00:00.000Z') },
    });
    createdTaskIds.push(recurringTask._id);

    // Test: Occurrence before series start date
    const resEarly = await simulateOccurrenceCall(recurringTask._id.toString(), { date: '2026-10-24', action: 'complete' }, { _id: testUserId1 });
    record('Rejects occurrence earlier than series start date with 400', resEarly.statusCode === 400 && resEarly.data.message === 'Occurrence date is earlier than series start date');

    // Test: Occurrence after series until date
    const resLate = await simulateOccurrenceCall(recurringTask._id.toString(), { date: '2026-11-01', action: 'complete' }, { _id: testUserId1 });
    record('Rejects occurrence after series until date with 400', resLate.statusCode === 400 && resLate.data.message === 'Occurrence date is after recurrence end date');

    // Test: Cadence validation on weekly series
    const weeklyTask = await Task.create({
      userId: testUserId1,
      title: 'Weekly Tuesday Series',
      startDate: new Date('2026-10-20T00:00:00.000Z'), // Tuesday
      recurrence: { frequency: 'weekly', interval: 1 },
    });
    createdTaskIds.push(weeklyTask._id);

    const resWrongCadence = await simulateOccurrenceCall(weeklyTask._id.toString(), { date: '2026-10-21', action: 'complete' }, { _id: testUserId1 }); // Wednesday
    record('Rejects date not on series cadence (Wednesday on Tuesday series) with 400', resWrongCadence.statusCode === 400 && resWrongCadence.data.message === 'Date does not belong to this recurrence series');

    const resRightCadence = await simulateOccurrenceCall(weeklyTask._id.toString(), { date: '2026-10-27', action: 'complete' }, { _id: testUserId1 }); // Tuesday
    record('Accepts date on valid weekly series cadence with 200', resRightCadence.statusCode === 200);

    // Test: Unauthorized user attempt
    const resUnauthorized = await simulateOccurrenceCall(recurringTask._id.toString(), { date: '2026-10-26', action: 'complete' }, { _id: testUserId2 });
    record('Rejects unauthorized user attempt with 403 Access Denied', resUnauthorized.statusCode === 403 && resUnauthorized.data.message === 'Access denied to this task');

    // Test: Complete occurrence on 2026-10-26
    const resComplete = await simulateOccurrenceCall(recurringTask._id.toString(), { date: '2026-10-26', action: 'complete' }, { _id: testUserId1 });
    record('Completing occurrence returns 200 with occurrence details', resComplete.statusCode === 200 && resComplete.data.occurrence.status === 'Done');

    // Verify in database: master task status is UNCHANGED ('To Do')
    const dbTaskAfterComplete = await Task.findById(recurringTask._id);
    record('Master task status remains To Do in DB after completing an occurrence', dbTaskAfterComplete.status === 'To Do');
    record('Database stored exactly 1 recurrence exception', dbTaskAfterComplete.recurrenceExceptions.length === 1);
    record('Stored exception date is 2026-10-26 with status Done', dbTaskAfterComplete.recurrenceExceptions[0].date === '2026-10-26' && dbTaskAfterComplete.recurrenceExceptions[0].status === 'Done');

    // Test: Upsert idempotency - calling complete again on 2026-10-26 does not duplicate
    await simulateOccurrenceCall(recurringTask._id.toString(), { date: '2026-10-26', action: 'complete' }, { _id: testUserId1 });
    const dbTaskIdempotent = await Task.findById(recurringTask._id);
    record('Repeated action on same date updates exception in-place without duplicates', dbTaskIdempotent.recurrenceExceptions.length === 1);

    // Test: Reopening occurrence on 2026-10-26
    const resReopen = await simulateOccurrenceCall(recurringTask._id.toString(), { date: '2026-10-26', action: 'reopen' }, { _id: testUserId1 });
    record('Reopening occurrence returns 200 with status To Do', resReopen.statusCode === 200 && resReopen.data.occurrence.status === 'To Do');
    const dbTaskAfterReopen = await Task.findById(recurringTask._id);
    record('Database exception status updated to To Do', dbTaskAfterReopen.recurrenceExceptions[0].status === 'To Do');
    record('Database exception count remains exactly 1', dbTaskAfterReopen.recurrenceExceptions.length === 1);

    // Test: Skip occurrence on 2026-10-27
    const resSkip = await simulateOccurrenceCall(recurringTask._id.toString(), { date: '2026-10-27', action: 'skip' }, { _id: testUserId1 });
    record('Skipping occurrence returns 200 with action skipped', resSkip.statusCode === 200 && resSkip.data.occurrence.action === 'skipped');
    const dbTaskAfterSkip = await Task.findById(recurringTask._id);
    record('Database stored 2 distinct exceptions (1 reopened, 1 skipped)', dbTaskAfterSkip.recurrenceExceptions.length === 2);

    // Test: Window expansion on database task
    const expandedDB = expandTasksForWindow([dbTaskAfterSkip], '2026-10-25', '2026-10-28');
    const dbOct25 = expandedDB.find((t) => t.occurrenceDate === '2026-10-25');
    const dbOct26 = expandedDB.find((t) => t.occurrenceDate === '2026-10-26');
    const dbOct27 = expandedDB.find((t) => t.occurrenceDate === '2026-10-27');
    const dbOct28 = expandedDB.find((t) => t.occurrenceDate === '2026-10-28');

    record('Window query returns Oct 25 as natural To Do', dbOct25 && dbOct25.status === 'To Do');
    record('Window query returns Oct 26 as reopened To Do', dbOct26 && dbOct26.status === 'To Do');
    record('Window query omits skipped Oct 27 occurrence completely', !dbOct27);
    record('Window query returns Oct 28 as natural To Do', dbOct28 && dbOct28.status === 'To Do');

    // Test: Non-recurring tasks still work with regular updates
    const regularTask = await Task.create({
      userId: testUserId1,
      title: 'Ordinary Task',
      startDate: new Date('2026-10-25T00:00:00.000Z'),
      status: 'To Do',
    });
    createdTaskIds.push(regularTask._id);

    const resRegularUpdate = await new Promise((resolve) => {
      const req = { params: { id: regularTask._id.toString() }, body: { status: 'Done' }, user: { _id: testUserId1 } };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ statusCode: this.statusCode, data }); },
      };
      updateTask(req, res, () => {});
    });
    record('Non-recurring task updates status to Done via standard updateTask endpoint', resRegularUpdate.statusCode === 200 && resRegularUpdate.data.data.status === 'Done');

  } finally {
    // Clean up all test tasks so no test data remains
    if (createdTaskIds.length > 0) {
      await Task.deleteMany({ _id: { $in: createdTaskIds } });
      console.log('  \x1b[32m✔\x1b[0m Cleaned up all integration test tasks from database');
    }
    await mongoose.disconnect();
  }
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[36m=== PHASE 2.3B TEST RESULTS SUMMARY ===\x1b[0m');
console.log(`  \x1b[32m✔ Passed: ${testResults.passed}\x1b[0m`);
console.log(`  \x1b[31m✖ Failed: ${testResults.failed}\x1b[0m`);
console.log(`  Total:   ${testResults.tests.length}\n`);

if (testResults.failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1m✨ ALL PHASE 2.3B RECURRENCE EXCEPTION TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
}
