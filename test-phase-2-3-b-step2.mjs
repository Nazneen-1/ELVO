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
import {
  rescheduleTaskOccurrence,
  updateTaskOccurrence,
  getTasks,
  updateTask,
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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 2.3B STEP 2 — INDIVIDUAL OCCURRENCE RESCHEDULING SUITE ===\x1b[0m\n');

// =============================================================================
// SUITE 1: Recurrence Engine Rescheduling Semantics (Unit / Mock)
// =============================================================================
console.log('\x1b[1mSuite 1: Recurrence Engine Rescheduling Semantics (Unit)\x1b[0m');

const baseDailyTask = {
  _id: 'task_daily_1',
  title: 'Daily Standup',
  startDate: '2026-10-20',
  status: 'To Do',
  recurrence: { frequency: 'daily', interval: 1 },
};

// 1.1: Moving one daily occurrence leaves neighbors unchanged
const movedDailyTask = {
  ...baseDailyTask,
  recurrenceExceptions: [
    {
      date: '2026-10-22',
      action: 'rescheduled',
      rescheduledDate: '2026-10-25',
      status: 'To Do',
    },
  ],
};
const projDaily = projectTaskOccurrences(movedDailyTask, '2026-10-20', '2026-10-26');
const oct21 = projDaily.find((p) => p.occurrenceDate === '2026-10-21');
const oct22 = projDaily.find((p) => p.occurrenceDate === '2026-10-22');
const oct23 = projDaily.find((p) => p.occurrenceDate === '2026-10-23');
const oct25Moved = projDaily.find(
  (p) => p.occurrenceDate === '2026-10-25' && p.originalOccurrenceDate === '2026-10-22'
);

record('Moved occurrence disappears from original date (Oct 22)', !oct22);
record('Moved occurrence appears on destination date (Oct 25)', Boolean(oct25Moved));
record('Oct 25 moved occurrence has isRescheduled flag', oct25Moved && oct25Moved.isRescheduled === true);
record('Neighbor Oct 21 remains unchanged', oct21 && oct21.status === 'To Do');
record('Neighbor Oct 23 remains unchanged', oct23 && oct23.status === 'To Do');

// 1.2: Moving a weekly occurrence
const baseWeeklyTask = {
  _id: 'task_weekly_1',
  title: 'Weekly Planning',
  startDate: '2026-10-05', // Monday
  status: 'To Do',
  recurrence: { frequency: 'weekly', interval: 1 },
};
const movedWeeklyTask = {
  ...baseWeeklyTask,
  recurrenceExceptions: [
    {
      date: '2026-10-12', // Moved to Oct 14 Wednesday
      action: 'rescheduled',
      rescheduledDate: '2026-10-14',
      status: 'To Do',
    },
  ],
};
const projWeekly = projectTaskOccurrences(movedWeeklyTask, '2026-10-01', '2026-10-31');
const oct12Weekly = projWeekly.find((p) => p.occurrenceDate === '2026-10-12');
const oct14Weekly = projWeekly.find((p) => p.occurrenceDate === '2026-10-14');
const oct19Weekly = projWeekly.find((p) => p.occurrenceDate === '2026-10-19');
record('Weekly occurrence disappears from Oct 12', !oct12Weekly);
record('Weekly occurrence appears on Oct 14', Boolean(oct14Weekly && oct14Weekly.isRescheduled));
record('Next weekly occurrence remains on normal schedule (Oct 19)', Boolean(oct19Weekly));

// 1.3: Moving a monthly occurrence
const baseMonthlyTask = {
  _id: 'task_monthly_1',
  title: 'Monthly Review',
  startDate: '2026-09-15',
  status: 'To Do',
  recurrence: { frequency: 'monthly', interval: 1 },
};
const movedMonthlyTask = {
  ...baseMonthlyTask,
  recurrenceExceptions: [
    {
      date: '2026-10-15', // Moved to Oct 18
      action: 'rescheduled',
      rescheduledDate: '2026-10-18',
      status: 'To Do',
    },
  ],
};
const projMonthly = projectTaskOccurrences(movedMonthlyTask, '2026-10-01', '2026-11-30');
const oct15Monthly = projMonthly.find((p) => p.occurrenceDate === '2026-10-15');
const oct18Monthly = projMonthly.find((p) => p.occurrenceDate === '2026-10-18');
const nov15Monthly = projMonthly.find((p) => p.occurrenceDate === '2026-11-15');
record('Monthly occurrence disappears from Oct 15', !oct15Monthly);
record('Monthly occurrence appears on Oct 18', Boolean(oct18Monthly && oct18Monthly.isRescheduled));
record('Next month occurrence remains on schedule (Nov 15)', Boolean(nov15Monthly));

// 1.4: Cross-window move: Original date outside window, destination inside
const crossWindowTask = {
  _id: 'task_cross_1',
  title: 'Cross Window Move',
  startDate: '2026-09-10',
  status: 'To Do',
  recurrence: { frequency: 'daily', interval: 1 },
  recurrenceExceptions: [
    {
      date: '2026-09-15', // Outside window
      action: 'rescheduled',
      rescheduledDate: '2026-10-05', // Inside window
      status: 'To Do',
    },
  ],
};
const projCross = projectTaskOccurrences(crossWindowTask, '2026-10-01', '2026-10-10');
const oct05Cross = projCross.find(
  (p) => p.occurrenceDate === '2026-10-05' && p.originalOccurrenceDate === '2026-09-15'
);
record(
  'Occurrence moved from outside window (Sept 15) projects into window at Oct 05',
  Boolean(oct05Cross && oct05Cross.isRescheduled)
);

// 1.5: Destination overlaps another natural occurrence
const overlapTask = {
  _id: 'task_overlap_1',
  title: 'Overlap Task',
  startDate: '2026-10-20',
  status: 'To Do',
  recurrence: { frequency: 'daily', interval: 1 },
  recurrenceExceptions: [
    {
      date: '2026-10-21',
      action: 'rescheduled',
      rescheduledDate: '2026-10-22', // Moves onto Oct 22 which is also a natural occurrence
      status: 'To Do',
    },
  ],
};
const projOverlap = projectTaskOccurrences(overlapTask, '2026-10-20', '2026-10-24');
const oct22Items = projOverlap.filter((p) => p.occurrenceDate === '2026-10-22');
record('Both moved and natural occurrence appear on Oct 22 (no overwriting)', oct22Items.length === 2);
record(
  'Moved and natural occurrence have distinct occurrenceIds',
  oct22Items.length === 2 && oct22Items[0].occurrenceId !== oct22Items[1].occurrenceId
);

// 1.6: Repeated rescheduling updates destination
const reRescheduledTask = {
  ...baseDailyTask,
  recurrenceExceptions: [
    {
      date: '2026-10-22',
      action: 'rescheduled',
      rescheduledDate: '2026-10-26', // Updated from earlier 2026-10-25
      status: 'To Do',
    },
  ],
};
const projRe = projectTaskOccurrences(reRescheduledTask, '2026-10-20', '2026-10-27');
record('Old destination (Oct 25) only has natural occurrence', projRe.filter((p) => p.occurrenceDate === '2026-10-25').length === 1);
record('New destination (Oct 26) has the moved occurrence', Boolean(projRe.find((p) => p.occurrenceDate === '2026-10-26' && p.originalOccurrenceDate === '2026-10-22')));

// 1.7: Completion after rescheduling
const completedRescheduledTask = {
  ...baseDailyTask,
  recurrenceExceptions: [
    {
      date: '2026-10-22',
      action: 'completed',
      rescheduledDate: '2026-10-25',
      status: 'Done',
    },
  ],
};
const projCompletedRescheduled = projectTaskOccurrences(completedRescheduledTask, '2026-10-20', '2026-10-27');
const completedMoved = projCompletedRescheduled.find(
  (p) => p.occurrenceDate === '2026-10-25' && p.originalOccurrenceDate === '2026-10-22'
);
record('Completed rescheduled occurrence displays Done on new date', completedMoved && completedMoved.status === 'Done');

// 1.8: Client and Server parity
const clientProjRescheduled = clientProject(completedRescheduledTask, '2026-10-20', '2026-10-27');
record(
  'Client and server projectTaskOccurrences produce identical output for rescheduled tasks',
  JSON.stringify(projCompletedRescheduled) === JSON.stringify(clientProjRescheduled)
);

// =============================================================================
// SUITE 2: Controller Validation & Permission Security (Mock / Unit)
// =============================================================================
console.log('\n\x1b[1mSuite 2: Backend Controller Validation & Security\x1b[0m');

const simulateRescheduleCall = (id, date, body, user) => {
  return new Promise((resolve) => {
    const req = {
      params: { id, date },
      body,
      user,
    };
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
    rescheduleTaskOccurrence(req, res, (err) => resolve({ statusCode: 500, error: err }));
  });
};

const dummyUserId = new mongoose.Types.ObjectId();
const dummyTaskId = new mongoose.Types.ObjectId();

// 2.1: Rejects invalid master task ObjectId
const resBadId = await simulateRescheduleCall('not-an-id', '2026-10-22', { rescheduledDate: '2026-10-25' }, { _id: dummyUserId });
record('Rejects invalid master task ObjectId with 400', resBadId.statusCode === 400);

// 2.2: Rejects invalid original date format
const resBadOrigDate = await simulateRescheduleCall(dummyTaskId.toString(), '2026-13-45', { rescheduledDate: '2026-10-25' }, { _id: dummyUserId });
record('Rejects invalid original occurrence date format with 400', resBadOrigDate.statusCode === 400);

// 2.3: Rejects missing or malformed destination date
const resBadDestDate = await simulateRescheduleCall(dummyTaskId.toString(), '2026-10-22', { rescheduledDate: 'invalid-date' }, { _id: dummyUserId });
record('Rejects malformed destination date with 400', resBadDestDate.statusCode === 400);

const resImpossibleDestDate = await simulateRescheduleCall(dummyTaskId.toString(), '2026-10-22', { rescheduledDate: '2026-02-30' }, { _id: dummyUserId });
record('Rejects impossible destination calendar date (Feb 30) with 400', resImpossibleDestDate.statusCode === 400);

// 2.4: Rejects invalid time range (endTime <= startTime)
const resBadTimes = await simulateRescheduleCall(
  dummyTaskId.toString(),
  '2026-10-22',
  { rescheduledDate: '2026-10-25', startTime: '15:00', endTime: '14:00' },
  { _id: dummyUserId }
);
record('Rejects endTime <= startTime with 400', resBadTimes.statusCode === 400);

// =============================================================================
// SUITE 3: Real MongoDB Database Integration Tests
// =============================================================================
console.log('\n\x1b[1mSuite 3: Real MongoDB Database Integration Tests\x1b[0m');

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
  let testUser = null;
  let otherUser = null;
  try {
    testUser = { _id: new mongoose.Types.ObjectId() };
    otherUser = { _id: new mongoose.Types.ObjectId() };

    // 3.1: Rescheduling non-recurring task is rejected with 400
    const nonRecurringTask = await Task.create({
      userId: testUser._id,
      title: 'One-off Task',
      startDate: '2026-10-20',
      recurrence: { frequency: 'none' },
    });

    const resNonRec = await simulateRescheduleCall(
      nonRecurringTask._id.toString(),
      '2026-10-20',
      { rescheduledDate: '2026-10-25' },
      testUser
    );
    record('Rejects rescheduling non-recurring task with 400', resNonRec.statusCode === 400);

    // 3.2: Rejects original date that does not belong to recurrence series
    const recurringDailyTask = await Task.create({
      userId: testUser._id,
      title: 'Daily Routine',
      startDate: '2026-10-10',
      recurrence: {
        frequency: 'daily',
        interval: 2, // Every 2 days: Oct 10, Oct 12, Oct 14...
      },
    });

    const resCadence = await simulateRescheduleCall(
      recurringDailyTask._id.toString(),
      '2026-10-11', // Odd day: does not belong!
      { rescheduledDate: '2026-10-25' },
      testUser
    );
    record('Rejects original date that violates interval cadence with 400', resCadence.statusCode === 400);

    // 3.3: Rejects unauthorized user
    const resAuth = await simulateRescheduleCall(
      recurringDailyTask._id.toString(),
      '2026-10-12',
      { rescheduledDate: '2026-10-25' },
      otherUser
    );
    record('Rejects unauthorized user with 403', resAuth.statusCode === 403);

    // 3.4: Successful rescheduling creates exception and preserves master task fields
    const resOk = await simulateRescheduleCall(
      recurringDailyTask._id.toString(),
      '2026-10-12',
      {
        rescheduledDate: '2026-10-25',
        startTime: '10:00',
        endTime: '11:00',
      },
      testUser
    );
    record('Successfully reschedules valid occurrence with 200', resOk.statusCode === 200);

    // Verify master task in DB
    const freshMaster = await Task.findById(recurringDailyTask._id);
    record(
      'Master task startDate remains 2026-10-10 (untouched)',
      freshMaster.startDate instanceof Date
        ? freshMaster.startDate.toISOString().startsWith('2026-10-10')
        : freshMaster.startDate === '2026-10-10'
    );
    record('Master task recurrence settings untouched', freshMaster.recurrence.interval === 2);
    record('Master task status untouched', freshMaster.status === 'To Do');
    record('Master task recurrenceExceptions contains 1 exception', freshMaster.recurrenceExceptions.length === 1);
    const ex = freshMaster.recurrenceExceptions[0];
    record('Exception date is original date (2026-10-12)', ex.date === '2026-10-12');
    record('Exception rescheduledDate is destination date (2026-10-25)', ex.rescheduledDate === '2026-10-25');
    record('Exception startTime is 10:00', ex.startTime === '10:00');
    record('Exception endTime is 11:00', ex.endTime === '11:00');

    // 3.5: Repeated rescheduling updates existing exception (no duplicates)
    const resRepeat = await simulateRescheduleCall(
      recurringDailyTask._id.toString(),
      '2026-10-12',
      {
        rescheduledDate: '2026-10-28',
        startTime: '14:00',
        endTime: '15:00',
        confirmed: true,
      },
      testUser
    );
    record('Repeated rescheduling returns 200', resRepeat.statusCode === 200);
    const updatedMaster = await Task.findById(recurringDailyTask._id);
    record(
      'Repeated rescheduling preserves exactly 1 exception (no duplicate exceptions)',
      updatedMaster.recurrenceExceptions.length === 1
    );
    record(
      'Updated exception has new rescheduledDate (2026-10-28)',
      updatedMaster.recurrenceExceptions[0].rescheduledDate === '2026-10-28'
    );
    record(
      'Updated exception has new startTime (14:00)',
      updatedMaster.recurrenceExceptions[0].startTime === '14:00'
    );

    // 3.6: Completing the rescheduled occurrence preserves rescheduledDate
    const resComplete = await new Promise((resolve) => {
      const req = {
        params: { id: recurringDailyTask._id.toString(), date: '2026-10-12' },
        body: { action: 'complete' },
        user: testUser,
      };
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
      updateTaskOccurrence(req, res, (err) => resolve({ statusCode: 500, error: err }));
    });
    record('Completing rescheduled occurrence returns 200', resComplete.statusCode === 200);
    const completedMaster = await Task.findById(recurringDailyTask._id);
    const completedEx = completedMaster.recurrenceExceptions[0];
    record('Exception status is Done', completedEx.status === 'Done');
    record('Exception preserves rescheduledDate (2026-10-28)', completedEx.rescheduledDate === '2026-10-28');

    // 3.7: Cross-window backend query (getTasks with window matching destination)
    // Create a task that starts and ends in Sept 2026, but has an occurrence moved into Oct 2026
    const septTask = await Task.create({
      userId: testUser._id,
      title: 'Sept Task Moved To Oct',
      startDate: '2026-09-01',
      dueDate: '2026-09-05',
      recurrence: {
        frequency: 'daily',
        interval: 1,
        until: '2026-09-05', // Natural recurrence ends Sept 5!
      },
      recurrenceExceptions: [
        {
          date: '2026-09-03',
          action: 'rescheduled',
          rescheduledDate: '2026-10-15', // Moved into mid-October!
          status: 'To Do',
        },
      ],
    });

    const queryRes = await new Promise((resolve) => {
      const req = {
        query: { start: '2026-10-01', end: '2026-10-31' },
        user: testUser,
      };
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
      getTasks(req, res, (err) => resolve({ statusCode: 500, error: err }));
    });

    record('getTasks for Oct 2026 returns 200', queryRes.statusCode === 200);
    const octTasks = queryRes.data?.data || [];
    const foundSeptMaster = octTasks.find((t) => t._id.toString() === septTask._id.toString());
    record(
      'getTasks includes task whose recurrence naturally ended in Sept but has occurrence moved to Oct',
      Boolean(foundSeptMaster)
    );

    // Expanding for window produces the rescheduled occurrence
    const expandedOct = expandTasksForWindow(octTasks, '2026-10-01', '2026-10-31');
    const oct15Found = expandedOct.find(
      (t) => t.occurrenceDate === '2026-10-15' && t.originalOccurrenceDate === '2026-09-03'
    );
    record(
      'expandTasksForWindow projects the cross-window occurrence on 2026-10-15',
      Boolean(oct15Found && oct15Found.isRescheduled)
    );
  } finally {
    try {
      if (testUser?._id && otherUser?._id) {
        await Task.deleteMany({ userId: { $in: [testUser._id, otherUser._id] } });
      }
    } catch (cleanupErr) {
      console.warn('  \x1b[33m⚠\x1b[0m Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
  }
}

console.log('\n\x1b[1m=== SUMMARY ===\x1b[0m');
console.log(`Passed: \x1b[32m${testResults.passed}\x1b[0m`);
console.log(`Failed: \x1b[31m${testResults.failed}\x1b[0m\n`);

if (testResults.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
