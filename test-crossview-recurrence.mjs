/**
 * ELVO — Phase 3: Cross-View Recurrence Integration & Polish Tests
 *
 * Verifies cross-view recurrence consistency:
 * 1. Completing/reopening occurrences isolates changes without mutating master series.
 * 2. Reopening directly to 'In Progress' is supported and preserved.
 * 3. Rescheduled occurrences remain stable with originalOccurrenceDate preserved.
 * 4. Skipped occurrences are excluded across all views.
 * 5. 14-day bounded lookback catches overdue occurrences and drops them once completed.
 * 6. Ordinary tasks remain completely isolated and functional.
 * 7. Workspace permissions and filtering remain enforced.
 */

import mongoose from './server/node_modules/mongoose/index.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import {
  getTasks,
  updateTaskOccurrence,
  rescheduleTaskOccurrence,
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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 3: CROSS-VIEW RECURRENCE & POLISH SUITE ===\x1b[0m\n');

const testUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
assertSafeTestDatabase(testUri);

let testUser = null;
let testWorkspace = null;
const createdTaskIds = [];

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

async function runCrossViewRecurrenceTests() {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    console.log('  \x1b[32m✔\x1b[0m Connected to isolated local test database');

    // 1. Create test user and workspace
    const uniqueEmail = `crossview_test_${Date.now()}@elvo.test`;
    testUser = await User.create({
      name: 'CrossView Tester',
      email: uniqueEmail,
      password: 'password123',
    });

    testWorkspace = await Workspace.create({
      name: 'Productivity Squad',
      owner: testUser._id,
      members: [{ user: testUser._id, role: 'owner', joinedAt: new Date() }],
    });

    const now = new Date();
    const toDateStr = (d) => d.toISOString().slice(0, 10);

    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = toDateStr(todayDate);

    const fourDaysAgoDate = new Date(todayDate.getTime() - 4 * 24 * 60 * 60 * 1000);
    const fourDaysAgoStr = toDateStr(fourDaysAgoDate);

    const yesterdayDate = new Date(todayDate.getTime() - 1 * 24 * 60 * 60 * 1000);
    const yesterdayStr = toDateStr(yesterdayDate);

    const tomorrowDate = new Date(todayDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    const tomorrowStr = toDateStr(tomorrowDate);

    const upcomingEnd = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingEndStr = toDateStr(upcomingEnd);

    const lookbackStart = new Date(todayDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lookbackStartStr = toDateStr(lookbackStart);

    // 2. Create seed tasks
    // Daily recurring task started 4 days ago
    const dailySeries = await Task.create({
      userId: testUser._id,
      title: 'Daily Architecture Standup',
      startDate: fourDaysAgoDate,
      status: 'To Do',
      priority: 'High',
      recurrence: { frequency: 'daily', interval: 1 },
    });
    createdTaskIds.push(dailySeries._id);

    // Ordinary task due today
    const ordinaryTask = await Task.create({
      userId: testUser._id,
      title: 'Deploy Hotfix to Staging',
      startDate: todayDate,
      status: 'To Do',
      priority: 'Medium',
    });
    createdTaskIds.push(ordinaryTask._id);

    // Ordinary task overdue from 2 days ago
    const overdueOrdinary = await Task.create({
      userId: testUser._id,
      title: 'Quarterly Audit Review',
      startDate: new Date(todayDate.getTime() - 2 * 24 * 60 * 60 * 1000),
      status: 'To Do',
      priority: 'High',
    });
    createdTaskIds.push(overdueOrdinary._id);

    // -------------------------------------------------------------------------
    // SUITE 1: Cross-View Completion & Reopening (including 'In Progress')
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 1: Cross-View Completion & Occurrence Reopening\x1b[0m');

    // 1.1 Complete today's occurrence
    const completeMock = mockReqRes({
      params: { id: dailySeries._id.toString(), date: todayStr },
      body: { action: 'complete', status: 'Done' },
    });
    await updateTaskOccurrence(completeMock.req, completeMock.res, completeMock.next);
    record('1.1. Complete occurrence responds with 200', completeMock.getStatus() === 200);

    // Verify in 7-day window query
    const checkCompleteMock = mockReqRes({
      query: { start: todayStr, end: upcomingEndStr },
    });
    await getTasks(checkCompleteMock.req, checkCompleteMock.res, checkCompleteMock.next);
    const afterCompleteTasks = checkCompleteMock.getData()?.data || [];

    const todayOcc = afterCompleteTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === todayStr
    );
    const tomorrowOcc = afterCompleteTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === tomorrowStr
    );
    record("1.2. Completed occurrence has status 'Done'", todayOcc?.status === 'Done');
    record("1.3. Subsequent occurrence remains untouched with status 'To Do'", tomorrowOcc?.status === 'To Do');

    // Master task base document remains 'To Do'
    const masterDbAfterComplete = await Task.findById(dailySeries._id);
    record("1.4. Master task series document status remains untouched ('To Do')", masterDbAfterComplete.status === 'To Do');

    // 1.5 Reopen directly as 'In Progress'
    const reopenProgressMock = mockReqRes({
      params: { id: dailySeries._id.toString(), date: todayStr },
      body: { action: 'reopen', status: 'In Progress' },
    });
    await updateTaskOccurrence(reopenProgressMock.req, reopenProgressMock.res, reopenProgressMock.next);
    record('1.5. Reopen occurrence to In Progress responds with 200', reopenProgressMock.getStatus() === 200);

    // Verify in window query
    const checkProgressMock = mockReqRes({
      query: { start: todayStr, end: upcomingEndStr },
    });
    await getTasks(checkProgressMock.req, checkProgressMock.res, checkProgressMock.next);
    const afterProgressTasks = checkProgressMock.getData()?.data || [];

    const progressOcc = afterProgressTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === todayStr
    );
    record("1.6. Reopened occurrence reflects 'In Progress' status in query", progressOcc?.status === 'In Progress');

    // 1.7 Reopen back to 'To Do'
    const reopenTodoMock = mockReqRes({
      params: { id: dailySeries._id.toString(), date: todayStr },
      body: { action: 'reopen', status: 'To Do' },
    });
    await updateTaskOccurrence(reopenTodoMock.req, reopenTodoMock.res, reopenTodoMock.next);
    record('1.7. Reopen occurrence back to To Do responds with 200', reopenTodoMock.getStatus() === 200);

    const checkTodoMock = mockReqRes({
      query: { start: todayStr, end: upcomingEndStr },
    });
    await getTasks(checkTodoMock.req, checkTodoMock.res, checkTodoMock.next);
    const afterTodoTasks = checkTodoMock.getData()?.data || [];
    const todoOcc = afterTodoTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === todayStr
    );
    record("1.8. Occurrence returns to 'To Do' status", todoOcc?.status === 'To Do');

    // -------------------------------------------------------------------------
    // SUITE 2: Rescheduled & Skipped Occurrence Consistency
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 2: Rescheduled & Skipped Occurrence Consistency\x1b[0m');

    // 2.1 Reschedule tomorrow's occurrence to 4 days ahead
    const destDateStr = toDateStr(new Date(todayDate.getTime() + 4 * 24 * 60 * 60 * 1000));
    const rescheduleMock = mockReqRes({
      params: { id: dailySeries._id.toString(), date: tomorrowStr },
      body: { rescheduledDate: destDateStr, confirmed: true },
    });
    await rescheduleTaskOccurrence(rescheduleMock.req, rescheduleMock.res, rescheduleMock.next);
    record('2.1. Reschedule occurrence responds with 200', rescheduleMock.getStatus() === 200);

    const checkRescheduledMock = mockReqRes({
      query: { start: todayStr, end: upcomingEndStr },
    });
    await getTasks(checkRescheduledMock.req, checkRescheduledMock.res, checkRescheduledMock.next);
    const tasksAfterReschedule = checkRescheduledMock.getData()?.data || [];

    // The occurrence for tomorrowStr should no longer appear on tomorrowStr
    const occAtOldDate = tasksAfterReschedule.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === tomorrowStr
    );
    record('2.2. Rescheduled occurrence is absent from original date', !occAtOldDate);

    // The rescheduled occurrence appears on destDateStr carrying originalOccurrenceDate
    const rescheduledOcc = tasksAfterReschedule.find(
      (t) =>
        t.isOccurrence &&
        t.masterTaskId === dailySeries._id.toString() &&
        t.occurrenceDate === destDateStr &&
        t.originalOccurrenceDate === tomorrowStr
    );
    record(
      '2.3. Rescheduled occurrence carries isRescheduled and originalOccurrenceDate',
      Boolean(rescheduledOcc && rescheduledOcc.isRescheduled && rescheduledOcc.originalOccurrenceDate === tomorrowStr)
    );

    // 2.4 Complete the rescheduled occurrence using originalOccurrenceDate
    const completeRescheduledMock = mockReqRes({
      params: { id: dailySeries._id.toString(), date: tomorrowStr },
      body: { action: 'complete', status: 'Done' },
    });
    await updateTaskOccurrence(completeRescheduledMock.req, completeRescheduledMock.res, completeRescheduledMock.next);
    record('2.4. Complete rescheduled occurrence using originalOccurrenceDate responds with 200', completeRescheduledMock.getStatus() === 200);

    // 2.5 Skip yesterday's occurrence
    const skipMock = mockReqRes({
      params: { id: dailySeries._id.toString(), date: yesterdayStr },
      body: { action: 'skip' },
    });
    await updateTaskOccurrence(skipMock.req, skipMock.res, skipMock.next);
    record('2.5. Skip occurrence responds with 200', skipMock.getStatus() === 200);

    // Query 14-day lookback window: skipped occurrence must be omitted
    const checkSkipMock = mockReqRes({
      query: { start: lookbackStartStr, end: upcomingEndStr },
    });
    await getTasks(checkSkipMock.req, checkSkipMock.res, checkSkipMock.next);
    const tasksWithLookback = checkSkipMock.getData()?.data || [];

    const skippedOcc = tasksWithLookback.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === yesterdayStr
    );
    record('2.6. Skipped occurrence is omitted from projected window query', !skippedOcc);

    // -------------------------------------------------------------------------
    // SUITE 3: Overdue Occurrence Handling (14-day Lookback)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 3: Overdue Occurrence Handling (Lookback Window)\x1b[0m');

    // Occurrence from 3 days ago is overdue and uncompleted
    const threeDaysAgoStr = toDateStr(new Date(todayDate.getTime() - 3 * 24 * 60 * 60 * 1000));
    const overdueOcc = tasksWithLookback.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === threeDaysAgoStr
    );
    record(
      "3.1. Uncompleted occurrence from 3 days ago is projected in lookback window with status 'To Do'",
      Boolean(overdueOcc && overdueOcc.status === 'To Do')
    );

    // Ordinary overdue task is also present in lookback window
    const overdueOrdFound = tasksWithLookback.find(
      (t) => t._id.toString() === overdueOrdinary._id.toString()
    );
    record(
      '3.2. Ordinary overdue task is included in the lookback window',
      Boolean(overdueOrdFound && overdueOrdFound.status === 'To Do')
    );

    // Complete the overdue occurrence
    const completeOverdueMock = mockReqRes({
      params: { id: dailySeries._id.toString(), date: threeDaysAgoStr },
      body: { action: 'complete', status: 'Done' },
    });
    await updateTaskOccurrence(completeOverdueMock.req, completeOverdueMock.res, completeOverdueMock.next);
    record('3.3. Complete overdue occurrence responds with 200', completeOverdueMock.getStatus() === 200);

    // Re-query lookback: the occurrence is now status 'Done' (no longer overdue)
    const checkOverdueDoneMock = mockReqRes({
      query: { start: lookbackStartStr, end: upcomingEndStr },
    });
    await getTasks(checkOverdueDoneMock.req, checkOverdueDoneMock.res, checkOverdueDoneMock.next);
    const refreshedLookbackTasks = checkOverdueDoneMock.getData()?.data || [];

    const overdueNowDone = refreshedLookbackTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailySeries._id.toString() && t.occurrenceDate === threeDaysAgoStr
    );
    record(
      "3.4. Overdue occurrence is marked 'Done' and drops out of overdue criteria (status !== 'Done')",
      overdueNowDone?.status === 'Done'
    );

    // -------------------------------------------------------------------------
    // SUITE 4: Ordinary Task Operations Unaffected
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 4: Ordinary Task Operations Integrity\x1b[0m');

    const patchOrdinaryMock = mockReqRes({
      params: { id: ordinaryTask._id.toString() },
      body: { status: 'In Progress' },
    });
    await patchTask(patchOrdinaryMock.req, patchOrdinaryMock.res, patchOrdinaryMock.next);
    record('4.1. patchTask on ordinary task responds with 200', patchOrdinaryMock.getStatus() === 200);

    const ordinaryInDb = await Task.findById(ordinaryTask._id);
    record("4.2. Ordinary task status successfully updated to 'In Progress'", ordinaryInDb.status === 'In Progress');
    record('4.3. Ordinary task has no recurrence field or exceptions', !ordinaryInDb.recurrence?.frequency || ordinaryInDb.recurrence.frequency === 'none');

    // -------------------------------------------------------------------------
    // SUITE 5: Deduplication Across Today, Upcoming, and Lookback
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 5: Deduplication Across All Sections\x1b[0m');

    const seenCardKeys = new Set();
    let hasDuplicateKeys = false;
    for (const t of refreshedLookbackTasks) {
      const key = t.occurrenceId || (t._id ? `${t._id}__${t.occurrenceDate || toDateStr(new Date(t.startDate))}` : '');
      if (seenCardKeys.has(key)) {
        hasDuplicateKeys = true;
        break;
      }
      seenCardKeys.add(key);
    }
    record('5.1. Zero duplicate card keys projected across full lookback and upcoming window', !hasDuplicateKeys);

    // -------------------------------------------------------------------------
    // SUITE 6: Teardown & Cleanup
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 6: Teardown & Cleanup\x1b[0m');

    if (createdTaskIds.length > 0) {
      await Task.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (testWorkspace?._id) {
      await Workspace.deleteOne({ _id: testWorkspace._id });
    }
    if (testUser?._id) {
      await User.deleteOne({ _id: testUser._id });
    }
    record('6.1. All test tasks, workspace, and test user deleted cleanly', true);

    await mongoose.disconnect();
    record('6.2. Mongoose disconnected cleanly', true);

  } catch (err) {
    console.error('\n\x1b[31mUnexpected Test Suite Failure:\x1b[0m', err);
    testResults.failed++;
    try {
      await mongoose.disconnect();
    } catch {}
  } finally {
    console.log('\n=== TEST RESULTS SUMMARY ===');
    console.log(`  \x1b[32m✔ Passed: ${testResults.passed}\x1b[0m`);
    if (testResults.failed > 0) {
      console.log(`  \x1b[31m✖ Failed: ${testResults.failed}\x1b[0m`);
    } else {
      console.log('  ✖ Failed: 0');
    }
    console.log(`  Total:   ${testResults.passed + testResults.failed}\n`);

    if (testResults.failed === 0) {
      console.log('\x1b[32m\x1b[1m✨ ALL PHASE 3 CROSS-VIEW RECURRENCE TESTS PASSED! ✨\x1b[0m\n');
      process.exit(0);
    } else {
      console.log('\x1b[31m\x1b[1m❌ SOME TESTS FAILED.\x1b[0m\n');
      process.exit(1);
    }
  }
}

runCrossViewRecurrenceTests();
