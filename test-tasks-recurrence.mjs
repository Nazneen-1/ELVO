/**
 * ELVO — Phase 2: Tasks List and Kanban Recurring Occurrence Integration Tests
 *
 * Verifies that the Tasks Page's date-scoped query (Today, This Week, All Tasks),
 * occurrence representation, status transitions in Kanban (In Progress, Done, Reopen),
 * ordinary task updates, skipped occurrences, rescheduled occurrences, and workspace
 * filtering function correctly and safely.
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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 2: TASKS LIST & KANBAN RECURRENCE INTEGRATION SUITE ===\x1b[0m\n');

const testUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
assertSafeTestDatabase(testUri);

let testUser = null;
let testWorkspace = null;
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

async function runTasksRecurrenceSuite() {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    console.log('  \x1b[32m✔\x1b[0m Connected to isolated local test database');

    // 1. Setup User and Workspace
    const uniqueEmail = `tasks_test_${Date.now()}@elvo.test`;
    testUser = await User.create({
      name: 'Tasks Page Tester',
      email: uniqueEmail,
      password: 'password123',
    });

    testWorkspace = await Workspace.create({
      name: 'Engineering Workspace',
      owner: testUser._id,
      members: [{ user: testUser._id, role: 'owner' }],
    });

    const now = new Date();
    const toDateStr = (d) => d.toISOString().slice(0, 10);

    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = toDateStr(todayDate);

    const yesterdayDate = new Date(todayDate.getTime() - 1 * 24 * 60 * 60 * 1000);
    const yesterdayStr = toDateStr(yesterdayDate);

    const tomorrowDate = new Date(todayDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    const tomorrowStr = toDateStr(tomorrowDate);

    const weekStartDate = new Date(todayDate.getTime() - 2 * 24 * 60 * 60 * 1000);
    const weekStartStr = toDateStr(weekStartDate);

    const weekEndDate = new Date(todayDate.getTime() + 4 * 24 * 60 * 60 * 1000);
    const weekEndStr = toDateStr(weekEndDate);

    // 2. Create tasks
    // Ordinary personal task scheduled for today
    const ordinaryTodayTask = await Task.create({
      userId: testUser._id,
      workspaceId: null,
      title: 'Ordinary Today Task',
      startDate: todayDate,
      status: 'To Do',
      priority: 'High',
    });
    createdTaskIds.push(ordinaryTodayTask._id);

    // Daily recurring task starting yesterday in personal workspace
    const dailyPersonalTask = await Task.create({
      userId: testUser._id,
      workspaceId: null,
      title: 'Daily Standup Call',
      startDate: yesterdayDate,
      status: 'To Do',
      priority: 'Medium',
      recurrence: { frequency: 'daily', interval: 1 },
    });
    createdTaskIds.push(dailyPersonalTask._id);

    // Weekly recurring task starting today in shared workspace
    const weeklySharedTask = await Task.create({
      userId: testUser._id,
      workspaceId: testWorkspace._id,
      title: 'Weekly Team Demo',
      startDate: todayDate,
      status: 'To Do',
      priority: 'High',
      recurrence: { frequency: 'weekly', interval: 1 },
    });
    createdTaskIds.push(weeklySharedTask._id);

    // -------------------------------------------------------------------------
    // SUITE 1: Date Scopes (Today, This Week, All Tasks)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 1: Date Scope Filtering & Recurrence Expansion\x1b[0m');

    // Scope: 'today' (start = todayStr, end = todayStr)
    const todayScopeMock = mockReqRes({
      query: { start: todayStr, end: todayStr },
    });
    await getTasks(todayScopeMock.req, todayScopeMock.res, todayScopeMock.next);
    const todayTasks = todayScopeMock.getData()?.data || [];

    record('1.1. Today scope returns 200', todayScopeMock.getStatus() === 200);

    const todayOrd = todayTasks.find((t) => t._id.toString() === ordinaryTodayTask._id.toString());
    record("1.2. Today scope includes today's ordinary task", Boolean(todayOrd && !todayOrd.isOccurrence));

    const todayDailyOcc = todayTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString() && t.occurrenceDate === todayStr
    );
    record("1.3. Today scope projects today's occurrence of the daily recurring task", Boolean(todayDailyOcc));

    // Scope: 'week' (start = weekStartStr, end = weekEndStr, spanning 7 days)
    const weekScopeMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr },
    });
    await getTasks(weekScopeMock.req, weekScopeMock.res, weekScopeMock.next);
    const weekTasks = weekScopeMock.getData()?.data || [];

    const weekDailyOccs = weekTasks.filter(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString()
    );
    // Daily task started yesterday (day 2 of the 7-day window); it should have 6 occurrences (yesterday through weekEnd)
    record(
      '1.4. Week scope projects exactly the occurrences falling within the 7-day window',
      weekDailyOccs.length === 6,
      `Expected 6, got ${weekDailyOccs.length}`
    );

    // Scope: 'all' (no start/end parameter)
    const allScopeMock = mockReqRes({
      query: {},
    });
    await getTasks(allScopeMock.req, allScopeMock.res, allScopeMock.next);
    const allTasks = allScopeMock.getData()?.data || [];

    const rawDailyInAll = allTasks.find((t) => t._id.toString() === dailyPersonalTask._id.toString());
    record(
      "1.5. 'All Tasks' scope returns raw master tasks without expanding multiple occurrences",
      Boolean(rawDailyInAll && !rawDailyInAll.isOccurrence) && allTasks.filter((t) => t.masterTaskId === dailyPersonalTask._id.toString()).length === 0
    );

    // -------------------------------------------------------------------------
    // SUITE 2: Occurrence Identity & Deduplication in Kanban
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 2: Occurrence Identity & Deduplication\x1b[0m');

    const seenKeys = new Set();
    let hasDuplicateKeys = false;
    for (const t of weekTasks) {
      const key = t.occurrenceId || (t._id ? `${t._id}__${t.occurrenceDate || t.startDate}` : '');
      if (seenKeys.has(key)) {
        hasDuplicateKeys = true;
        break;
      }
      seenKeys.add(key);
    }
    record('2.1. Every task and occurrence card in the week view has a unique key', !hasDuplicateKeys);

    // Verify each occurrence contains originalOccurrenceDate
    const missingOriginalDate = weekDailyOccs.some((occ) => !occ.originalOccurrenceDate);
    record('2.2. All projected occurrences carry originalOccurrenceDate for stable API calls', !missingOriginalDate);

    // -------------------------------------------------------------------------
    // SUITE 3: Kanban Occurrence Status Transitions (Drag & Drop)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 3: Kanban Drag & Drop Status Transitions\x1b[0m');

    // 3.1. Move today's occurrence from 'To Do' to 'In Progress'
    const moveInProgressMock = mockReqRes({
      params: { id: dailyPersonalTask._id.toString(), date: todayStr },
      body: { action: 'reopen', status: 'In Progress' },
    });
    await updateTaskOccurrence(moveInProgressMock.req, moveInProgressMock.res, moveInProgressMock.next);
    record('3.1. Drag occurrence to In Progress responds with 200', moveInProgressMock.getStatus() === 200);

    // Verify in window query
    const checkInProgressMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr },
    });
    await getTasks(checkInProgressMock.req, checkInProgressMock.res, checkInProgressMock.next);
    const refreshedAfterProgress = checkInProgressMock.getData()?.data || [];

    const todayProgressOcc = refreshedAfterProgress.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString() && t.occurrenceDate === todayStr
    );
    const tomorrowOccAfterProgress = refreshedAfterProgress.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString() && t.occurrenceDate === tomorrowStr
    );

    record("3.2. Today's occurrence is in 'In Progress' column", todayProgressOcc?.status === 'In Progress');
    record("3.3. Tomorrow's occurrence remains in 'To Do' column", tomorrowOccAfterProgress?.status === 'To Do');

    // 3.4. Move today's occurrence from 'In Progress' to 'Done' (Completed column)
    const moveDoneMock = mockReqRes({
      params: { id: dailyPersonalTask._id.toString(), date: todayStr },
      body: { action: 'complete', status: 'Done' },
    });
    await updateTaskOccurrence(moveDoneMock.req, moveDoneMock.res, moveDoneMock.next);
    record('3.4. Drag occurrence to Completed responds with 200', moveDoneMock.getStatus() === 200);

    const checkDoneMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr },
    });
    await getTasks(checkDoneMock.req, checkDoneMock.res, checkDoneMock.next);
    const refreshedAfterDone = checkDoneMock.getData()?.data || [];

    const todayDoneOcc = refreshedAfterDone.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString() && t.occurrenceDate === todayStr
    );
    record("3.5. Today's occurrence is in 'Done' column", todayDoneOcc?.status === 'Done');

    // 3.6. Reopen completed occurrence back to 'To Do' (or quick action button)
    const reopenMock = mockReqRes({
      params: { id: dailyPersonalTask._id.toString(), date: todayStr },
      body: { action: 'reopen', status: 'To Do' },
    });
    await updateTaskOccurrence(reopenMock.req, reopenMock.res, reopenMock.next);
    record('3.6. Reopen occurrence responds with 200', reopenMock.getStatus() === 200);

    const checkReopenMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr },
    });
    await getTasks(checkReopenMock.req, checkReopenMock.res, checkReopenMock.next);
    const refreshedAfterReopen = checkReopenMock.getData()?.data || [];

    const todayReopenedOcc = refreshedAfterReopen.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString() && t.occurrenceDate === todayStr
    );
    record("3.7. Today's occurrence returns to 'To Do' column", todayReopenedOcc?.status === 'To Do');

    // -------------------------------------------------------------------------
    // SUITE 4: Ordinary Non-Recurring Task Drag & Drop
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 4: Ordinary Task Status Update (patchTask)\x1b[0m');

    // Drag ordinary task to In Progress
    const patchProgressMock = mockReqRes({
      params: { id: ordinaryTodayTask._id.toString() },
      body: { status: 'In Progress' },
    });
    await patchTask(patchProgressMock.req, patchProgressMock.res, patchProgressMock.next);
    record('4.1. patchTask for ordinary task responds with 200', patchProgressMock.getStatus() === 200);

    const updatedOrdinary = await Task.findById(ordinaryTodayTask._id);
    record("4.2. Ordinary task status is 'In Progress'", updatedOrdinary.status === 'In Progress');

    // -------------------------------------------------------------------------
    // SUITE 5: Rescheduled & Skipped Occurrences in Kanban & List
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 5: Rescheduled & Skipped Occurrences in Kanban\x1b[0m');

    // Reschedule tomorrow's occurrence to 3 days from now (confirming any duplicate-title conflict with existing daily occurrences)
    const destDateStr = toDateStr(new Date(todayDate.getTime() + 3 * 24 * 60 * 60 * 1000));
    const rescheduleMock = mockReqRes({
      params: { id: dailyPersonalTask._id.toString(), date: tomorrowStr },
      body: { rescheduledDate: destDateStr, confirmed: true },
    });
    await rescheduleTaskOccurrence(rescheduleMock.req, rescheduleMock.res, rescheduleMock.next);
    record('5.1. rescheduleTaskOccurrence responds with 200', rescheduleMock.getStatus() === 200);

    const checkRescheduledMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr },
    });
    await getTasks(checkRescheduledMock.req, checkRescheduledMock.res, checkRescheduledMock.next);
    const afterRescheduleTasks = checkRescheduledMock.getData()?.data || [];

    // The occurrence for tomorrowStr should no longer be at tomorrowStr
    const occAtOldDate = afterRescheduleTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString() && t.occurrenceDate === tomorrowStr
    );
    record('5.2. Rescheduled occurrence is absent from original date', !occAtOldDate);

    // The rescheduled occurrence should appear at destDateStr with isRescheduled: true
    const occAtDestDate = afterRescheduleTasks.find(
      (t) =>
        t.isOccurrence &&
        t.masterTaskId === dailyPersonalTask._id.toString() &&
        t.occurrenceDate === destDateStr &&
        t.originalOccurrenceDate === tomorrowStr
    );
    record(
      '5.3. Rescheduled occurrence appears on destination date with isRescheduled flag',
      Boolean(occAtDestDate && occAtDestDate.isRescheduled && occAtDestDate.originalOccurrenceDate === tomorrowStr)
    );

    // Drag the rescheduled occurrence in Kanban to 'Done'
    const moveRescheduledMock = mockReqRes({
      params: { id: dailyPersonalTask._id.toString(), date: tomorrowStr },
      body: { action: 'complete', status: 'Done' },
    });
    await updateTaskOccurrence(moveRescheduledMock.req, moveRescheduledMock.res, moveRescheduledMock.next);
    record('5.4. Dragging rescheduled occurrence to Done uses originalOccurrenceDate and succeeds', moveRescheduledMock.getStatus() === 200);

    // Skip yesterday's occurrence
    const skipMock = mockReqRes({
      params: { id: dailyPersonalTask._id.toString(), date: yesterdayStr },
      body: { action: 'skip' },
    });
    await updateTaskOccurrence(skipMock.req, skipMock.res, skipMock.next);
    record('5.5. Skip occurrence responds with 200', skipMock.getStatus() === 200);

    const checkSkippedMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr },
    });
    await getTasks(checkSkippedMock.req, checkSkippedMock.res, checkSkippedMock.next);
    const afterSkippedTasks = checkSkippedMock.getData()?.data || [];

    const skippedOcc = afterSkippedTasks.find(
      (t) => t.isOccurrence && t.masterTaskId === dailyPersonalTask._id.toString() && (t.occurrenceDate === yesterdayStr || t.originalOccurrenceDate === yesterdayStr)
    );
    record('5.6. Skipped occurrence is excluded from Kanban and List views', !skippedOcc);

    // -------------------------------------------------------------------------
    // SUITE 6: Workspace Filtering
    // -------------------------------------------------------------------------
    console.log('\n\x1b[1mSuite 6: Workspace Filtering\x1b[0m');

    // Personal workspace filter
    const personalFilterMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr, workspaceId: 'personal' },
    });
    await getTasks(personalFilterMock.req, personalFilterMock.res, personalFilterMock.next);
    const personalTasks = personalFilterMock.getData()?.data || [];

    const hasSharedInPersonal = personalTasks.some(
      (t) => t.workspaceId === testWorkspace._id.toString() || t.title === 'Weekly Team Demo'
    );
    record('6.1. Personal workspace filter excludes shared workspace tasks and occurrences', !hasSharedInPersonal);

    // Shared workspace filter
    const sharedFilterMock = mockReqRes({
      query: { start: weekStartStr, end: weekEndStr, workspaceId: testWorkspace._id.toString() },
    });
    await getTasks(sharedFilterMock.req, sharedFilterMock.res, sharedFilterMock.next);
    const sharedTasks = sharedFilterMock.getData()?.data || [];

    const foundSharedOcc = sharedTasks.find(
      (t) => t.title === 'Weekly Team Demo' && t.isOccurrence
    );
    record('6.2. Shared workspace filter returns shared occurrences', Boolean(foundSharedOcc));

  } finally {
    // Teardown
    console.log('\n\x1b[1mSuite 7: Teardown & Test Data Cleanup\x1b[0m');
    try {
      if (createdTaskIds.length > 0) {
        await Task.deleteMany({ _id: { $in: createdTaskIds } });
      }
      if (testWorkspace) {
        await Workspace.deleteOne({ _id: testWorkspace._id });
      }
      if (testUser) {
        await User.deleteOne({ _id: testUser._id });
      }
      record('7.1. All test tasks, workspace, and user cleaned up from database', true);
    } catch (cleanupErr) {
      record('7.1. Test cleanup', false, cleanupErr.message);
    }

    try {
      await mongoose.disconnect();
      record('7.2. Mongoose disconnected cleanly', true);
    } catch {}
  }

  // Summary
  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`  ✔ Passed: ${testResults.passed}`);
  console.log(`  ✖ Failed: ${testResults.failed}`);
  console.log(`  Total:   ${testResults.tests.length}\n`);

  if (testResults.failed > 0) {
    process.exit(1);
  } else {
    console.log('✨ ALL TASKS PAGE RECURRING OCCURRENCE TESTS PASSED! ✨\n');
    process.exit(0);
  }
}

runTasksRecurrenceSuite();
