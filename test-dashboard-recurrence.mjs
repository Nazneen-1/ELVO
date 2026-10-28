/**
 * ELVO — Phase 1: Dashboard Recurring Occurrence Integration Tests
 *
 * Verifies that the Dashboard's Today and Upcoming date window query
 * correctly returns projected occurrences alongside ordinary tasks,
 * isolates occurrence completion to only that occurrence, deduplicates properly,
 * and maintains ordinary task functionality.
 */

import mongoose from './server/node_modules/mongoose/index.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import {
  getTasks,
  updateTaskOccurrence,
  updateTask,
  patchTask,
} from './server/src/controllers/taskController.js';
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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 1: DASHBOARD RECURRING OCCURRENCE INTEGRATION SUITE ===\x1b[0m\n');

const testUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
assertSafeTestDatabase(testUri);

let testUser = null;
const createdTaskIds = [];

// Helper to simulate express req/res
function mockReqRes({ query = {}, params = {}, body = {}, user = testUser } = {}) {
  const req = { query, params, body, user };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const next = (err) => {
    if (err) throw err;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

async function runDashboardIntegrationTests() {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    console.log('  \x1b[32m✔\x1b[0m Connected to isolated local test database');

    // Setup Test User
    const uniqueEmail = `dash_test_${Date.now()}@elvo.test`;
    testUser = await User.create({
      name: 'Dashboard Tester',
      email: uniqueEmail,
      password: 'password123',
    });

    const now = new Date();
    const toDateStr = (d) => d.toISOString().slice(0, 10);

    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = toDateStr(todayDate);

    const pastStartDate = new Date(todayDate.getTime() - 4 * 24 * 60 * 60 * 1000);
    const pastStartStr = toDateStr(pastStartDate);

    const upcomingEndDate = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingEndStr = toDateStr(upcomingEndDate);

    const tomorrowDate = new Date(todayDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    const tomorrowStr = toDateStr(tomorrowDate);

    // 1. Create an ordinary task scheduled for today
    const ordinaryTodayTask = await Task.create({
      userId: testUser._id,
      title: 'Ordinary Today Task',
      startDate: todayDate,
      status: 'To Do',
      priority: 'High',
    });
    createdTaskIds.push(ordinaryTodayTask._id);

    // 2. Create a daily recurring task starting 4 days ago
    const dailyRecurringTask = await Task.create({
      userId: testUser._id,
      title: 'Daily Team Sync',
      startDate: pastStartDate,
      status: 'To Do',
      priority: 'Medium',
      recurrence: { frequency: 'daily', interval: 1 },
    });
    createdTaskIds.push(dailyRecurringTask._id);

    // 3. Create a weekly recurring task starting today
    const weeklyRecurringTask = await Task.create({
      userId: testUser._id,
      title: 'Weekly Retrospective',
      startDate: todayDate,
      status: 'To Do',
      priority: 'Low',
      recurrence: { frequency: 'weekly', interval: 1 },
    });
    createdTaskIds.push(weeklyRecurringTask._id);

    // 4. Create an ordinary task outside the window (15 days later)
    const futureOrdinaryTask = await Task.create({
      userId: testUser._id,
      title: 'Future Milestone Task',
      startDate: new Date(todayDate.getTime() + 15 * 24 * 60 * 60 * 1000),
      status: 'To Do',
      priority: 'Low',
    });
    createdTaskIds.push(futureOrdinaryTask._id);

    // -------------------------------------------------------------------------
    // TEST 1: Dashboard Window Query Expansion
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 1: Dashboard Window Query & Occurrence Projection\x1b[0m');

    const windowMock = mockReqRes({
      query: { start: todayStr, end: upcomingEndStr },
    });
    await getTasks(windowMock.req, windowMock.res, windowMock.next);
    const windowTasks = windowMock.getData()?.data || [];

    record('1.1. Dashboard query returns success status 200', windowMock.getStatus() === 200);

    // Check ordinary today task is present
    const foundOrdinary = windowTasks.find((t) => t._id.toString() === ordinaryTodayTask._id.toString());
    record('1.2. Ordinary task scheduled for today is present in window', Boolean(foundOrdinary && !foundOrdinary.isOccurrence));

    // Check future task outside 7-day window is excluded
    const foundFuture = windowTasks.find((t) => t._id.toString() === futureOrdinaryTask._id.toString());
    record('1.3. Ordinary task outside the 7-day window is excluded', !foundFuture);

    // Check recurring daily task occurrences
    const dailyOccurrences = windowTasks.filter(
      (t) => t.isOccurrence && t.masterTaskId === dailyRecurringTask._id.toString()
    );
    // Across 8 days (today through today+7), exactly 8 occurrences should be projected
    record(
      '1.4. Daily recurring series projects exactly 8 occurrences for 8-day window [today, today+7]',
      dailyOccurrences.length === 8,
      `Expected 8, got ${dailyOccurrences.length}`
    );

    // Check today's occurrence of the daily task
    const todayDailyOcc = dailyOccurrences.find((t) => t.occurrenceDate === todayStr);
    record(
      '1.5. Today daily occurrence is projected with matching occurrenceDate',
      Boolean(todayDailyOcc && todayDailyOcc.originalOccurrenceDate === todayStr)
    );

    // Check weekly task occurrence today and 7 days later
    const weeklyOccurrences = windowTasks.filter(
      (t) => t.isOccurrence && t.masterTaskId === weeklyRecurringTask._id.toString()
    );
    record(
      '1.6. Weekly recurring series projects today and day 7 occurrence within 8-day window',
      weeklyOccurrences.length === 2,
      `Expected 2, got ${weeklyOccurrences.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Occurrence Deduplication and Identity Integrity
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 2: Occurrence Deduplication and Unique Keys\x1b[0m');

    const seenKeys = new Set();
    let hasDuplicateKeys = false;
    for (const t of windowTasks) {
      const uniqueKey = t.occurrenceId || (t._id ? `${t._id}__${t.occurrenceDate || t.startDate}` : '');
      if (seenKeys.has(uniqueKey)) {
        hasDuplicateKeys = true;
        break;
      }
      seenKeys.add(uniqueKey);
    }
    record('2.1. Every returned task and occurrence has a unique identity key', !hasDuplicateKeys);

    // Verify master task document is not returned alongside occurrence for recurring tasks
    const rawMasterInWindow = windowTasks.find(
      (t) => !t.isOccurrence && t._id.toString() === dailyRecurringTask._id.toString()
    );
    record('2.2. Master recurring task is expanded into occurrences without raw master duplicate', !rawMasterInWindow);

    // -------------------------------------------------------------------------
    // TEST 3: Occurrence Completion Isolation
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 3: Occurrence Completion Isolation\x1b[0m');

    // Complete today's occurrence only
    const completeOccMock = mockReqRes({
      params: { id: dailyRecurringTask._id.toString(), date: todayStr },
      body: { action: 'complete' },
    });
    await updateTaskOccurrence(completeOccMock.req, completeOccMock.res, completeOccMock.next);

    record('3.1. updateTaskOccurrence responds with 200', completeOccMock.getStatus() === 200);

    // Query window again to inspect occurrence statuses
    const verifyMock = mockReqRes({
      query: { start: todayStr, end: upcomingEndStr },
    });
    await getTasks(verifyMock.req, verifyMock.res, verifyMock.next);
    const refreshedTasks = verifyMock.getData()?.data || [];

    const refreshedDailyOccs = refreshedTasks.filter(
      (t) => t.isOccurrence && t.masterTaskId === dailyRecurringTask._id.toString()
    );

    const todayDoneOcc = refreshedDailyOccs.find((t) => t.occurrenceDate === todayStr);
    const tomorrowTodoOcc = refreshedDailyOccs.find((t) => t.occurrenceDate === tomorrowStr);

    record(
      "3.2. Today's occurrence has status: 'Done'",
      Boolean(todayDoneOcc && todayDoneOcc.status === 'Done'),
      `Status: ${todayDoneOcc?.status}`
    );

    record(
      "3.3. Tomorrow's occurrence remains status: 'To Do'",
      Boolean(tomorrowTodoOcc && tomorrowTodoOcc.status === 'To Do'),
      `Status: ${tomorrowTodoOcc?.status}`
    );

    // Check master task status remains To Do
    const masterDbTask = await Task.findById(dailyRecurringTask._id);
    record(
      "3.4. Master task document status remains 'To Do' (isolated to recurrence exception)",
      masterDbTask.status === 'To Do' && masterDbTask.recurrenceExceptions.length === 1
    );

    // -------------------------------------------------------------------------
    // TEST 4: Ordinary Task Status Update (Non-Recurring)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 4: Ordinary Task Status Update\x1b[0m');

    const patchMock = mockReqRes({
      params: { id: ordinaryTodayTask._id.toString() },
      body: { status: 'Done' },
    });
    await patchTask(patchMock.req, patchMock.res, patchMock.next);

    record('4.1. patchTask for ordinary task responds with 200', patchMock.getStatus() === 200);

    const updatedOrdinary = await Task.findById(ordinaryTodayTask._id);
    record("4.2. Ordinary task status is updated to 'Done'", updatedOrdinary.status === 'Done');

    // -------------------------------------------------------------------------
    // TEST 5: Occurrence Reopening
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 5: Occurrence Reopening\x1b[0m');

    const reopenMock = mockReqRes({
      params: { id: dailyRecurringTask._id.toString(), date: todayStr },
      body: { action: 'reopen' },
    });
    await updateTaskOccurrence(reopenMock.req, reopenMock.res, reopenMock.next);

    const recheckMock = mockReqRes({
      query: { start: todayStr, end: upcomingEndStr },
    });
    await getTasks(recheckMock.req, recheckMock.res, recheckMock.next);
    const recheckedTasks = recheckMock.getData()?.data || [];

    const reopenedOcc = recheckedTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyRecurringTask._id.toString() && t.occurrenceDate === todayStr
    );

    record("5.1. Reopened occurrence returns to status: 'To Do'", Boolean(reopenedOcc && reopenedOcc.status === 'To Do'));

  } finally {
    // Clean up created test data
    console.log('\n\x1b[1mSuite 6: Teardown & Test Data Cleanup\x1b[0m');
    try {
      if (createdTaskIds.length > 0) {
        await Task.deleteMany({ _id: { $in: createdTaskIds } });
      }
      if (testUser) {
        await User.deleteOne({ _id: testUser._id });
      }
      record('6.1. All test tasks and users successfully cleaned up from database', true);
    } catch (cleanupErr) {
      record('6.1. Test cleanup', false, cleanupErr.message);
    }

    try {
      await mongoose.disconnect();
      record('6.2. Mongoose disconnected cleanly', true);
    } catch {}
  }

  // Final summary
  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`  ✔ Passed: ${testResults.passed}`);
  console.log(`  ✖ Failed: ${testResults.failed}`);
  console.log(`  Total:   ${testResults.tests.length}\n`);

  if (testResults.failed > 0) {
    process.exit(1);
  } else {
    console.log('✨ ALL DASHBOARD RECURRING OCCURRENCE TESTS PASSED! ✨\n');
    process.exit(0);
  }
}

runDashboardIntegrationTests();
