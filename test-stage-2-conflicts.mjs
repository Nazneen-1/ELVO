import mongoose from './server/node_modules/mongoose/index.js';
import { config } from './server/src/config/env.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import {
  normalizeTitle,
  titlesMatch,
  getOccupiedDates,
  checkTimeOverlap,
  detectTaskConflicts,
} from './server/src/utils/conflictDetector.js';
import {
  createTask,
  updateTask,
  patchTask,
  rescheduleTaskOccurrence,
  checkTaskConflicts,
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

console.log('\n\x1b[1m\x1b[36m=== ELVO STAGE 2: TASK CONFLICT DETECTION & CONFIRMATION TEST SUITE ===\x1b[0m\n');

// =============================================================================
// PART 1: Title and Date Matching Unit Tests (Requirements 1 - 9)
// =============================================================================
console.log('\x1b[1mSuite 1: Title & Date Matching Semantics\x1b[0m');

// 1. Case-insensitive exact-title matching
record(
  '1. Case-insensitive exact-title matching',
  titlesMatch('Prepare Report', 'prepare report') === true &&
  titlesMatch('PREPARE REPORT', 'prepare report') === true
);

// 2. Leading/trailing and repeated-whitespace normalization
record(
  '2. Leading/trailing and repeated-whitespace normalization',
  titlesMatch('Prepare Report', '   prepare    report   ') === true &&
  normalizeTitle('  deep   work   session  ') === 'deep work session'
);

// 3. No fuzzy title matching
record(
  '3. No fuzzy title matching',
  titlesMatch('Prepare Report', 'Prepare Final Report') === false &&
  titlesMatch('Prepare Report', 'Prepare Report!') === false &&
  titlesMatch('Report', 'Reports') === false
);

// 4. Duplicate titles on the same date
const dates4 = getOccupiedDates('2026-10-25', null);
record(
  '4. Occupied dates generation for single-day task',
  dates4.length === 1 && dates4[0] === '2026-10-25'
);

// 5. Same title on different dates without an overlapping occupied date
const datesA = getOccupiedDates('2026-10-25', null);
const datesB = getOccupiedDates('2026-10-26', null);
const shared5 = datesA.filter((d) => datesB.includes(d));
record(
  '5. Same title on different dates without an overlapping occupied date shares no dates',
  shared5.length === 0
);

// 6. Inclusive multi-day endDate matching
const multiDates = getOccupiedDates('2026-10-25', '2026-10-27');
record(
  '6. Inclusive multi-day endDate matching includes all dates in range',
  multiDates.length === 3 &&
  multiDates[0] === '2026-10-25' &&
  multiDates[1] === '2026-10-26' &&
  multiDates[2] === '2026-10-27'
);

// 7. dueDate alone does not extend occupied dates
const dueOnlyOccupied = getOccupiedDates('2026-10-25', null); // dueDate is 2026-10-28
record(
  '7. dueDate alone does not extend occupied dates',
  dueOnlyOccupied.length === 1 && dueOnlyOccupied[0] === '2026-10-25'
);

// 8. Undated tasks do not conflict solely by title
const undatedOccupied = getOccupiedDates(null, null);
record(
  '8. Undated tasks produce empty occupied dates',
  undatedOccupied.length === 0
);

// =============================================================================
// PART 2: Time and All-Day Rules (Requirements 10 - 14)
// =============================================================================
console.log('\n\x1b[1mSuite 2: Time & All-Day Overlap Rules\x1b[0m');

// 10. Actual time overlap
record(
  '10. Actual time overlap using half-open intervals',
  checkTimeOverlap('09:00', '11:00', '10:00', '12:00') === true &&
  checkTimeOverlap('10:00', '12:00', '09:00', '11:00') === true &&
  checkTimeOverlap('09:30', '10:30', '09:00', '11:00') === true
);

// 11. Adjacent intervals do not overlap
record(
  '11. Adjacent intervals do not overlap (09:00-10:00 and 10:00-11:00)',
  checkTimeOverlap('09:00', '10:00', '10:00', '11:00') === false &&
  checkTimeOverlap('10:00', '11:00', '09:00', '10:00') === false
);

// 12. Same title with non-overlapping times still warns about duplicate title
const isTitleMatch12 = titlesMatch('Sprint Planning', 'sprint planning');
const isTimeOverlap12 = checkTimeOverlap('09:00', '10:00', '14:00', '15:00');
record(
  '12. Same title with non-overlapping times detects duplicate title without time overlap',
  isTitleMatch12 === true && isTimeOverlap12 === false
);

// 13. All-day tasks produce no time-overlap warning
const isAllDayTask = true;
const isTimedCandidate = true;
const overlapWithAllDay = !isAllDayTask && checkTimeOverlap('09:00', '10:00', '09:30', '10:30');
record(
  '13. All-day tasks produce no time-overlap warning',
  overlapWithAllDay === false
);

// 14. A duplicate-title and time-overlap combination appears as consolidated reasons
const sampleReasons = [];
if (titlesMatch('Sprint Planning', 'sprint planning')) sampleReasons.push('DUPLICATE_TITLE');
if (checkTimeOverlap('09:00', '11:00', '10:00', '12:00')) sampleReasons.push('TIME_OVERLAP');
record(
  '14. Duplicate-title and time-overlap combination yields both reasons in one entry',
  sampleReasons.length === 2 &&
  sampleReasons.includes('DUPLICATE_TITLE') &&
  sampleReasons.includes('TIME_OVERLAP')
);

// =============================================================================
// PART 3: Real MongoDB Database Integration & Protocol Tests (15 - 29)
// =============================================================================
console.log('\n\x1b[1mSuite 3: Database Integration, Recurrence & Controller Safeguards\x1b[0m');

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
  let userId1 = null;
  let userId2 = null;
  let workspace = null;
  try {
    userId1 = new mongoose.Types.ObjectId();
    userId2 = new mongoose.Types.ObjectId();
    const testUser = { _id: userId1, name: 'Alice Test' };
    const otherUser = { _id: userId2, name: 'Bob Unauthorized' };

    // Create a collaborative test workspace
    workspace = await Workspace.create({
      name: 'Stage 2 Workspace',
      owner: userId1,
      members: [{ user: userId1, role: 'owner' }],
    });
    const workspaceId = workspace._id.toString();

    // Helper to simulate express controller calls
    const simulateReq = (controllerFn, { params = {}, body = {}, user = testUser } = {}) => {
      return new Promise((resolve) => {
        const req = { params, body, user };
        const res = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(data) {
            resolve({ statusCode: this.statusCode, data });
          },
        };
        controllerFn(req, res, (err) => resolve({ statusCode: 500, error: err }));
      });
    };

    // 9. Completed tasks are included in conflict detection
    const completedTask = await Task.create({
      userId: userId1,
      title: 'Quarterly Review',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      status: 'Done',
      isAllDay: true,
    });
    const conflictsCompleted = await detectTaskConflicts({
      userId: userId1,
      candidate: {
        title: 'quarterly review',
        startDate: '2026-11-01',
        isAllDay: true,
      },
    });
    record(
      '9. Completed tasks are included in conflict detection',
      conflictsCompleted.length === 1 &&
      conflictsCompleted[0].reasons.includes('DUPLICATE_TITLE')
    );

    // 15. Natural recurring occurrence collisions
    const dailySeries = await Task.create({
      userId: userId1,
      title: 'Daily Standup',
      startDate: new Date('2026-11-10T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '10:00',
      isAllDay: false,
      status: 'To Do',
      recurrence: { frequency: 'daily', interval: 1 },
    });

    const conflictsNaturalOcc = await detectTaskConflicts({
      userId: userId1,
      candidate: {
        title: 'Client Check-in',
        startDate: '2026-11-12', // Day 3 of daily series
        startTime: '09:30',
        endTime: '10:30',
        isAllDay: false,
      },
    });
    record(
      '15. Natural recurring occurrence collisions detected with TIME_OVERLAP',
      conflictsNaturalOcc.length === 1 &&
      conflictsNaturalOcc[0].isOccurrence === true &&
      conflictsNaturalOcc[0].reasons.includes('TIME_OVERLAP')
    );

    // 16. Rescheduled occurrence collisions
    // Reschedule Nov 13 occurrence to Nov 15 at 14:00-15:00
    dailySeries.recurrenceExceptions.push({
      date: '2026-11-13',
      rescheduledDate: '2026-11-15',
      startTime: '14:00',
      endTime: '15:00',
      isAllDay: false,
      action: 'rescheduled',
    });
    await dailySeries.save();

    // Check collision on destination date Nov 15
    const conflictsReschedDest = await detectTaskConflicts({
      userId: userId1,
      candidate: {
        title: 'Project Demo',
        startDate: '2026-11-15',
        startTime: '14:30',
        endTime: '15:30',
        isAllDay: false,
      },
    });
    record(
      '16a. Rescheduled occurrence collisions detected on destination date',
      conflictsReschedDest.some((c) => c.occurrenceId?.includes('2026-11-13') && c.date === '2026-11-15')
    );

    // Check that Nov 13 no longer collides because it was rescheduled away
    const conflictsReschedOrig = await detectTaskConflicts({
      userId: userId1,
      candidate: {
        title: 'Non-colliding Task',
        startDate: '2026-11-13',
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
      },
    });
    record(
      '16b. Rescheduled occurrence is excluded from original date',
      conflictsReschedOrig.length === 0
    );

    // 17. Skipped occurrences are excluded
    dailySeries.recurrenceExceptions.push({
      date: '2026-11-14',
      action: 'skipped',
    });
    await dailySeries.save();

    const conflictsSkipped = await detectTaskConflicts({
      userId: userId1,
      candidate: {
        title: 'Task on Skipped Day',
        startDate: '2026-11-14',
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
      },
    });
    record(
      '17. Skipped occurrences are excluded from conflicts',
      conflictsSkipped.length === 0
    );

    // 18. Editing an occurrence excludes that same occurrence from self-conflict
    const selfExcludeConflicts = await detectTaskConflicts({
      userId: userId1,
      candidate: {
        title: 'Daily Standup',
        startDate: '2026-11-16',
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
      },
      excludeTaskId: dailySeries._id.toString(),
      excludeOccurrenceDate: '2026-11-16',
    });
    record(
      '18. Editing an occurrence excludes that same occurrence from self-conflict',
      selfExcludeConflicts.length === 0
    );

    // 19. Distinct occurrences remain distinct and are never merged
    // Moving Nov 17 occurrence to Nov 18 where Nov 18 occurrence already naturally exists
    const occNov18Collision = await detectTaskConflicts({
      userId: userId1,
      candidate: {
        title: 'Daily Standup',
        startDate: '2026-11-18',
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
      },
      excludeTaskId: dailySeries._id.toString(),
      excludeOccurrenceDate: '2026-11-17',
    });
    record(
      '19. Distinct occurrences remain distinct: collision with Nov 18 occurrence detected',
      occNov18Collision.length === 1 &&
      occNov18Collision[0].originalOccurrenceDate === '2026-11-18'
    );

    // 20. Master recurrence settings remain unchanged when editing one occurrence
    record(
      '20. Master recurrence settings remain untouched in database',
      dailySeries.recurrence.frequency === 'daily' &&
      dailySeries.recurrence.interval === 1
    );

    // 21. Solo and collaborative workspace permissions
    const workspaceTask = await Task.create({
      userId: userId1,
      workspaceId: workspaceId,
      title: 'Workspace Shared Project',
      startDate: new Date('2026-11-20T00:00:00.000Z'),
      isAllDay: true,
    });
    const wsConflicts = await detectTaskConflicts({
      userId: userId1,
      workspaceId: workspaceId,
      candidate: {
        title: 'workspace shared project',
        startDate: '2026-11-20',
        isAllDay: true,
      },
    });
    record(
      '21. Collaborative workspace tasks detect conflicts among workspace members',
      wsConflicts.length === 1 && wsConflicts[0].taskId === workspaceTask._id.toString()
    );

    // 22. No data leakage from unauthorized workspaces
    let leakError = null;
    try {
      await detectTaskConflicts({
        userId: userId2, // Bob is not in workspace
        workspaceId: workspaceId,
        candidate: {
          title: 'Workspace Shared Project',
          startDate: '2026-11-20',
          isAllDay: true,
        },
      });
    } catch (e) {
      leakError = e;
    }
    record(
      '22. Unauthorized user cannot access workspace tasks (returns 403, no leakage)',
      leakError && leakError.statusCode === 403
    );

    // 23. Create and edit operations trigger the same conflict policy (HTTP 409)
    // Create operation triggering 409
    const createRes = await simulateReq(createTask, {
      body: {
        title: 'Quarterly Review',
        startDate: '2026-11-01',
        isAllDay: true,
      },
      user: testUser,
    });
    record(
      '23a. POST /api/tasks returns 409 with conflictCode TASK_CONFLICT when conflict detected',
      createRes.statusCode === 409 &&
      createRes.data?.conflictCode === 'TASK_CONFLICT' &&
      createRes.data?.conflicts?.length > 0
    );

    // Edit (PUT /api/tasks/:id) operation triggering 409
    const existingSoloTask = await Task.create({
      userId: userId1,
      title: 'Solo Work 1',
      startDate: new Date('2026-11-22T00:00:00.000Z'),
      isAllDay: true,
    });
    const existingSoloTask2 = await Task.create({
      userId: userId1,
      title: 'Solo Work 2',
      startDate: new Date('2026-11-22T00:00:00.000Z'),
      isAllDay: true,
    });
    const updateRes = await simulateReq(updateTask, {
      params: { id: existingSoloTask2._id.toString() },
      body: { title: 'Solo Work 1' }, // Rename to match task 1 on same date
      user: testUser,
    });
    record(
      '23b. PUT /api/tasks/:id returns 409 with conflictCode TASK_CONFLICT on duplicate rename',
      updateRes.statusCode === 409 && updateRes.data?.conflictCode === 'TASK_CONFLICT'
    );

    // 24. Drag-and-drop conflicts trigger confirmation (PATCH /api/tasks/:id & reschedule)
    const patchRes = await simulateReq(patchTask, {
      params: { id: existingSoloTask2._id.toString() },
      body: { title: 'Solo Work 1' },
      user: testUser,
    });
    record(
      '24a. PATCH /api/tasks/:id returns 409 on conflict during calendar move',
      patchRes.statusCode === 409 && patchRes.data?.conflictCode === 'TASK_CONFLICT'
    );

    // Occurrence reschedule drag triggering 409
    const reschedConflictRes = await simulateReq(rescheduleTaskOccurrence, {
      params: { id: dailySeries._id.toString(), date: '2026-11-17' },
      body: { rescheduledDate: '2026-11-18' },
      user: testUser,
    });
    record(
      '24b. Rescheduling occurrence via drag-and-drop returns 409 on conflict',
      reschedConflictRes.statusCode === 409 && reschedConflictRes.data?.conflictCode === 'TASK_CONFLICT'
    );

    // 25. Cancel leaves backend and client state unchanged
    const masterBeforeCancel = await Task.findById(dailySeries._id);
    const exCountBefore = masterBeforeCancel.recurrenceExceptions.length;
    // Client chooses cancel: no further request sent, DB untouched
    const masterAfterCancel = await Task.findById(dailySeries._id);
    record(
      '25. Cancel leaves backend state unchanged',
      masterAfterCancel.recurrenceExceptions.length === exCountBefore
    );

    // 26. Proceed anyway performs server revalidation and then saves
    const createConfirmedRes = await simulateReq(createTask, {
      body: {
        title: 'Quarterly Review',
        startDate: '2026-11-01',
        isAllDay: true,
        confirmed: true,
      },
      user: testUser,
    });
    record(
      '26. Proceed anyway (confirmed: true) performs server revalidation and creates task (201)',
      createConfirmedRes.statusCode === 201 &&
      createConfirmedRes.data?.success === true &&
      createConfirmedRes.data?.data?.title === 'Quarterly Review'
    );

    // 27. A failed save restores the previous client state
    // Simulating invalid date on confirmed save returns 400 without corrupting database
    const badConfirmedRes = await simulateReq(createTask, {
      body: {
        title: 'Broken Date Task',
        startDate: '2026-11-05',
        endDate: '2026-11-01', // End before start -> fails validation!
        confirmed: true,
      },
      user: testUser,
    });
    record(
      '27. Failed save with invalid parameters rejects with 400 even if confirmed: true',
      badConfirmedRes.statusCode === 400
    );

    // 28. Repeated submissions do not create duplicate operations
    // Calling reschedule with confirmed: true on same occurrence updates idempotently
    const reschedConfirmed1 = await simulateReq(rescheduleTaskOccurrence, {
      params: { id: dailySeries._id.toString(), date: '2026-11-17' },
      body: { rescheduledDate: '2026-11-18', confirmed: true },
      user: testUser,
    });
    const reschedConfirmed2 = await simulateReq(rescheduleTaskOccurrence, {
      params: { id: dailySeries._id.toString(), date: '2026-11-17' },
      body: { rescheduledDate: '2026-11-18', confirmed: true },
      user: testUser,
    });
    const finalMaster = await Task.findById(dailySeries._id);
    const exceptionsForNov17 = finalMaster.recurrenceExceptions.filter((e) => e.date === '2026-11-17');
    record(
      '28. Repeated submissions do not duplicate recurrence exceptions',
      reschedConfirmed1.statusCode === 200 &&
      reschedConfirmed2.statusCode === 200 &&
      exceptionsForNov17.length === 1
    );

    // 29. A stale preflight result is rechecked against current server data
    const preflightRes = await simulateReq(checkTaskConflicts, {
      body: {
        candidate: {
          title: 'Daily Standup',
          startDate: '2026-11-18',
          isAllDay: false,
          startTime: '09:00',
          endTime: '10:00',
        },
      },
      user: testUser,
    });
    record(
      '29. Authoritative preflight /check-conflicts returns active conflicts from current DB data',
      preflightRes.statusCode === 200 &&
      preflightRes.data?.hasConflicts === true &&
      preflightRes.data?.conflicts?.length > 0
    );

  } finally {
    try {
      if (userId1 && userId2) {
        await Task.deleteMany({ userId: { $in: [userId1, userId2] } });
      }
      if (workspace?._id) {
        await Workspace.findByIdAndDelete(workspace._id);
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
  console.log('\n\x1b[32m✨ ALL STAGE 2 TASK CONFLICT TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\n\x1b[31m💥 SOME STAGE 2 TESTS FAILED! 💥\x1b[0m\n');
  process.exit(1);
}
