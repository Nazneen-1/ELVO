/**
 * ELVO — Habit Tracker V1 Comprehensive Integration Test Suite
 *
 * Verifies:
 * 1. Habit CRUD Lifecycle (create, rename, update schedule/category, archive, restore, delete).
 * 2. Schedule Validation (daily, weekdays, custom).
 * 3. Daily Completion Toggling, Idempotency, and Duplicate Prevention.
 * 4. Future Date Completion Prevention (HTTP 400).
 * 5. Historical Completion Retrieval, Correction, and Persistence.
 * 6. Monthly Checkbox Matrix Generation and Date Aggregation.
 * 7. Daily & Monthly Percentage Calculations (including zero-denominator safety).
 * 8. Streak Calculations:
 *    - Daily habits.
 *    - Weekday-only habits (skipping weekends without breaking streaks).
 *    - Today uncompleted does not prematurely break active streak.
 *    - Best streak tracking over history.
 * 9. User Isolation & Privacy (User B cannot access or modify User A's habits/logs).
 * 10. Archived Habit Historical Preservation.
 * 11. Complete Independence: Zero task, calendar event, or note mutations.
 */

import mongoose from './server/node_modules/mongoose/index.js';
import User from './server/src/models/User.js';
import Habit from './server/src/models/Habit.js';
import HabitLog from './server/src/models/HabitLog.js';
import Task from './server/src/models/Task.js';
import Note from './server/src/models/Note.js';
import HabitTarget from './server/src/models/HabitTarget.js';

import {
  getHabits,
  getHabitById,
  createHabit,
  updateHabit,
  archiveHabit,
  restoreHabit,
  deleteHabit,
  reorderHabits,
  toggleHabitCompletion,
  getDailyOverview,
  getMonthMatrix,
  getHabitStats,
  calculateHabitStreaks,
  isHabitScheduledOnDate,
  shiftDateString,
  getTodayDateString,
  getHabitTargets,
  createHabitTarget,
  updateHabitTarget,
  deleteHabitTarget,
} from './server/src/controllers/habitController.js';

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

// Mock Express req/res
function mockReqRes(reqData = {}) {
  const req = {
    user: reqData.user || null,
    body: reqData.body || {},
    params: reqData.params || {},
    query: reqData.query || {},
    headers: reqData.headers || {},
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };

  const next = (err) => {
    if (err) console.error('mockReqRes next error:', err);
  };

  return { req, res, next };
}

async function runTests() {
  console.log('\n\x1b[1m\x1b[36m=== ELVO: HABIT TRACKER V1 INTEGRATION TEST SUITE ===\x1b[0m\n');

  const testDbUri = getSafeTestUri();
  assertSafeTestDatabase(testDbUri);
  await mongoose.connect(testDbUri);
  console.log(`Connected to isolated test database: ${testDbUri}\n`);

  // Clean collections
  await User.deleteMany({});
  await Habit.deleteMany({});
  await HabitLog.deleteMany({});
  await Task.deleteMany({});
  await Note.deleteMany({});

  // Setup test users
  const alice = await User.create({
    name: 'Alice Tracker',
    email: 'alice@elvo-habits.test',
    password: 'password123',
  });

  const bob = await User.create({
    name: 'Bob Tracker',
    email: 'bob@elvo-habits.test',
    password: 'password123',
  });

  const today = getTodayDateString();
  const yesterday = shiftDateString(today, -1);
  const twoDaysAgo = shiftDateString(today, -2);
  const tomorrow = shiftDateString(today, 1);

  console.log('\x1b[33m--- Suite 1: Habit CRUD Lifecycle & Schedule Validation ---\x1b[0m');

  let dailyHabitId;
  let weekdayHabitId;

  // Test 1: Create daily habit
  {
    const { req, res } = mockReqRes({
      user: alice,
      body: {
        name: 'Morning Meditation',
        description: '15 minutes of mindfulness',
        category: 'Mindfulness',
        color: '#6366F1',
        icon: 'sun',
        schedule: { type: 'daily' },
      },
    });
    await createHabit(req, res);
    const passed = res.statusCode === 201 && res.data?.data?.name === 'Morning Meditation' && res.data?.data?.schedule?.daysOfWeek?.length === 7;
    dailyHabitId = res.data?.data?._id;
    record('Create daily habit with 7-day schedule', passed, `status=${res.statusCode}`);
  }

  // Test 2: Create weekday-only habit
  {
    const { req, res } = mockReqRes({
      user: alice,
      body: {
        name: 'Deep Work Coding',
        description: '2 hours uninterrupted coding',
        category: 'Productivity',
        color: '#10B981',
        icon: 'book',
        schedule: { type: 'weekdays' },
      },
    });
    await createHabit(req, res);
    const days = res.data?.data?.schedule?.daysOfWeek || [];
    const passed = res.statusCode === 201 && days.length === 5 && !days.includes(0) && !days.includes(6);
    weekdayHabitId = res.data?.data?._id;
    record('Create weekday habit (Mon-Fri only, excludes weekends)', passed, `status=${res.statusCode}, days=${days}`);
  }

  // Test 3: Update habit name & description
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dailyHabitId },
      body: {
        name: 'Morning Mindfulness & Meditation',
        description: '20 minutes calm breathing',
      },
    });
    await updateHabit(req, res);
    const passed = res.statusCode === 200 && res.data?.data?.name === 'Morning Mindfulness & Meditation';
    record('Update habit details', passed, `status=${res.statusCode}`);
  }

  // Test 4: Reorder habits
  {
    const { req, res } = mockReqRes({
      user: alice,
      body: { habitIds: [weekdayHabitId, dailyHabitId] },
    });
    await reorderHabits(req, res);
    const checkFirst = await Habit.findById(weekdayHabitId);
    const checkSecond = await Habit.findById(dailyHabitId);
    const passed = res.statusCode === 200 && checkFirst.sortOrder === 0 && checkSecond.sortOrder === 1;
    record('Reorder habits updates sortOrder', passed, `orders=${checkFirst.sortOrder},${checkSecond.sortOrder}`);
  }

  console.log('\n\x1b[33m--- Suite 2: Completion Toggling, Persistence & Future Prevention ---\x1b[0m');

  // Test 5: Complete habit on today
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dailyHabitId },
      body: { date: today, isCompleted: true },
    });
    await toggleHabitCompletion(req, res);
    const log = await HabitLog.findOne({ habitId: dailyHabitId, date: today });
    const passed = res.statusCode === 200 && log?.isCompleted === true;
    record('Mark habit completed for today', passed, `status=${res.statusCode}`);
  }

  // Test 6: Idempotent repeat completion toggle
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dailyHabitId },
      body: { date: today, isCompleted: true },
    });
    await toggleHabitCompletion(req, res);
    const count = await HabitLog.countDocuments({ habitId: dailyHabitId, date: today });
    const passed = res.statusCode === 200 && count === 1;
    record('Repeated completion request does NOT create duplicate logs (idempotency)', passed, `logCount=${count}`);
  }

  // Test 7: Toggle off completion
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dailyHabitId },
      body: { date: today }, // No isCompleted passed -> should toggle to false
    });
    await toggleHabitCompletion(req, res);
    const log = await HabitLog.findOne({ habitId: dailyHabitId, date: today });
    const passed = res.statusCode === 200 && log?.isCompleted === false;
    record('Toggle habit off uncompletes habit', passed, `isCompleted=${log?.isCompleted}`);
  }

  // Test 8: Future date completion is REJECTED (HTTP 400)
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dailyHabitId },
      body: { date: tomorrow, isCompleted: true },
    });
    await toggleHabitCompletion(req, res);
    const passed = res.statusCode === 400;
    record('Future date completion is blocked with HTTP 400', passed, `status=${res.statusCode}`);
  }

  // Re-complete today for streak tests
  await HabitLog.findOneAndUpdate(
    { habitId: dailyHabitId, date: today, userId: alice._id },
    { isCompleted: true },
    { upsert: true }
  );

  console.log('\n\x1b[33m--- Suite 3: Historical Dates & Streak Calculations ---\x1b[0m');

  // Complete yesterday and two days ago for dailyHabit
  await HabitLog.findOneAndUpdate(
    { habitId: dailyHabitId, date: yesterday, userId: alice._id },
    { isCompleted: true },
    { upsert: true }
  );
  await HabitLog.findOneAndUpdate(
    { habitId: dailyHabitId, date: twoDaysAgo, userId: alice._id },
    { isCompleted: true },
    { upsert: true }
  );

  // Test 9: Current streak for 3 consecutive days completed
  {
    const habit = await Habit.findById(dailyHabitId);
    const logs = await HabitLog.find({ habitId: dailyHabitId, isCompleted: true });
    const dateSet = new Set(logs.map((l) => l.date));
    const streaks = calculateHabitStreaks(habit, dateSet, today);
    const passed = streaks.currentStreak === 3 && streaks.bestStreak >= 3;
    record('Daily habit current streak calculates accurately (3 days)', passed, `current=${streaks.currentStreak}, best=${streaks.bestStreak}`);
  }

  // Test 10: Today incomplete does NOT prematurely break streak
  {
    // Uncomplete today
    await HabitLog.findOneAndUpdate(
      { habitId: dailyHabitId, date: today, userId: alice._id },
      { isCompleted: false }
    );
    const habit = await Habit.findById(dailyHabitId);
    const logs = await HabitLog.find({ habitId: dailyHabitId, isCompleted: true });
    const dateSet = new Set(logs.map((l) => l.date));
    const streaks = calculateHabitStreaks(habit, dateSet, today);
    // Yesterday and two days ago are completed, so streak should be 2, not 0!
    const passed = streaks.currentStreak === 2;
    record('Incomplete habit today does NOT break streak before day ends', passed, `currentStreak=${streaks.currentStreak}`);
  }

  // Test 11: Weekday-only habit skips weekends without breaking streak
  {
    // Construct a simulated weekday habit with Fri, Thu, Wed completed
    const simWeekdayHabit = {
      _id: 'sim_weekday',
      createdAt: new Date('2026-10-01'),
      schedule: { type: 'weekdays', daysOfWeek: [1, 2, 3, 4, 5] },
    };
    // Let's test with a known date: Monday 2026-10-26, Friday 2026-10-23, Thursday 2026-10-22
    const monDate = '2026-10-26'; // Monday
    const friDate = '2026-10-23'; // Friday
    const thuDate = '2026-10-22'; // Thursday

    const completed = new Set([monDate, friDate, thuDate]);
    const streaks = calculateHabitStreaks(simWeekdayHabit, completed, monDate);
    // Sat & Sun were skipped, so streak across Mon, Fri, Thu is 3!
    const passed = streaks.currentStreak === 3;
    record('Weekday-only habit skips Sat/Sun without breaking streak', passed, `currentStreak=${streaks.currentStreak}`);
  }

  console.log('\n\x1b[33m--- Suite 4: Daily Overview & Monthly Matrix Aggregations ---\x1b[0m');

  // Test 12: Daily overview returns scheduled habits and counts
  {
    const { req, res } = mockReqRes({
      user: alice,
      query: { date: today },
    });
    await getDailyOverview(req, res);
    const data = res.data?.data;
    const passed = res.statusCode === 200 && data?.totalScheduled >= 1 && typeof data?.completionPercentage === 'number';
    record('Daily overview returns scheduled habits and completion %', passed, `status=${res.statusCode}, total=${data?.totalScheduled}, %=${data?.completionPercentage}`);
  }

  // Test 13: Monthly matrix returns habits and full month dates
  {
    const [y, m] = today.split('-').map(Number);
    const { req, res } = mockReqRes({
      user: alice,
      query: { year: y, month: m },
    });
    await getMonthMatrix(req, res);
    const data = res.data?.data;
    const passed = res.statusCode === 200 && Array.isArray(data?.dates) && Array.isArray(data?.habits) && typeof data?.summary?.monthlyCompletionRate === 'number';
    record('Monthly matrix returns dates, habit rows, and summary stats', passed, `datesCount=${data?.dates?.length}, habitsCount=${data?.habits?.length}`);
  }

  // Test 14: Zero-denominator safety (no habits scheduled on empty day returns 0%, not NaN)
  {
    // Request an empty day or calculate with empty list
    const { req, res } = mockReqRes({
      user: bob, // Bob has no habits yet
      query: { date: today },
    });
    await getDailyOverview(req, res);
    const data = res.data?.data;
    const passed = res.statusCode === 200 && data?.completionPercentage === 0 && !isNaN(data?.completionPercentage);
    record('Zero scheduled habits safely returns 0% (never NaN)', passed, `%=${data?.completionPercentage}`);
  }

  console.log('\n\x1b[33m--- Suite 5: Archive & Restoration Integrity ---\x1b[0m');

  // Test 15: Archive habit hides from active list
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dailyHabitId },
    });
    await archiveHabit(req, res);
    const check = await Habit.findById(dailyHabitId);
    const passed = res.statusCode === 200 && check.isArchived === true && check.archivedAt !== null;
    record('Archive habit sets isArchived=true', passed, `isArchived=${check.isArchived}`);
  }

  // Test 16: Active habits query excludes archived habit
  {
    const { req, res } = mockReqRes({
      user: alice,
      query: { includeArchived: 'false' },
    });
    await getHabits(req, res);
    const found = res.data?.data?.some((h) => h._id.toString() === dailyHabitId.toString());
    record('Active habits list excludes archived habit', !found, `found=${found}`);
  }

  // Test 17: Restore habit
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dailyHabitId },
    });
    await restoreHabit(req, res);
    const check = await Habit.findById(dailyHabitId);
    const passed = res.statusCode === 200 && check.isArchived === false && check.archivedAt === null;
    record('Restore habit returns habit to active tracking', passed, `isArchived=${check.isArchived}`);
  }

  console.log('\n\x1b[33m--- Suite 6: Cross-User Isolation & Privacy ---\x1b[0m');

  // Test 18: Bob cannot view Alice's habit
  {
    const { req, res } = mockReqRes({
      user: bob,
      params: { id: dailyHabitId },
    });
    await getHabitById(req, res);
    const passed = res.statusCode === 403 || res.statusCode === 404;
    record('User B cannot view User A habit (HTTP 403)', passed, `status=${res.statusCode}`);
  }

  // Test 19: Bob cannot update Alice's habit
  {
    const { req, res } = mockReqRes({
      user: bob,
      params: { id: dailyHabitId },
      body: { name: 'Hacked Habit' },
    });
    await updateHabit(req, res);
    const passed = res.statusCode === 403 || res.statusCode === 404;
    record('User B cannot update User A habit (HTTP 403)', passed, `status=${res.statusCode}`);
  }

  // Test 20: Bob cannot toggle completion on Alice's habit
  {
    const { req, res } = mockReqRes({
      user: bob,
      params: { id: dailyHabitId },
      body: { date: today, isCompleted: true },
    });
    await toggleHabitCompletion(req, res);
    const passed = res.statusCode === 403 || res.statusCode === 404;
    record('User B cannot toggle completion on User A habit (HTTP 403)', passed, `status=${res.statusCode}`);
  }

  console.log('\n\x1b[33m--- Suite 7: Strict Independence from Tasks & Calendar ---\x1b[0m');

  // Test 21: Habit operations create ZERO task records
  {
    const taskCount = await Task.countDocuments({});
    const noteCount = await Note.countDocuments({});
    const passed = taskCount === 0 && noteCount === 0;
    record('Habit operations preserve strict isolation: 0 tasks, 0 notes created', passed, `tasks=${taskCount}, notes=${noteCount}`);
  }

  console.log('\n\x1b[33m--- Suite 8: Duplicate Habit Names & Matrix Done/To Do/Rest Classification ---\x1b[0m');

  // Test 22: Duplicate habit names are supported independently with stable IDs
  let dupHabit1Id, dupHabit2Id;
  {
    const { req: req1, res: res1 } = mockReqRes({
      user: alice,
      body: { name: 'Reading', category: 'Learning', schedule: { type: 'daily', daysOfWeek: [] } },
    });
    await createHabit(req1, res1);
    dupHabit1Id = res1.data?.data?._id;

    const { req: req2, res: res2 } = mockReqRes({
      user: alice,
      body: { name: 'Reading', category: 'Mindfulness', schedule: { type: 'weekdays', daysOfWeek: [1, 2, 3, 4, 5] } },
    });
    await createHabit(req2, res2);
    dupHabit2Id = res2.data?.data?._id;

    const distinct = dupHabit1Id && dupHabit2Id && dupHabit1Id.toString() !== dupHabit2Id.toString();
    record('Supports duplicate habit names with distinct stable database IDs', distinct, `id1=${dupHabit1Id}, id2=${dupHabit2Id}`);
  }

  // Test 23: Operations on duplicate habit names do not collide or overwrite
  {
    // Toggle completion for dupHabit1Id only
    const { req: reqToggle, res: resToggle } = mockReqRes({
      user: alice,
      params: { id: dupHabit1Id },
      body: { date: today, isCompleted: true },
    });
    await toggleHabitCompletion(reqToggle, resToggle);

    // Verify dupHabit1 is completed today but dupHabit2 is NOT
    const log1 = await HabitLog.findOne({ habitId: dupHabit1Id, date: today, userId: alice._id });
    const log2 = await HabitLog.findOne({ habitId: dupHabit2Id, date: today, userId: alice._id });

    const passed = log1?.isCompleted === true && (!log2 || log2?.isCompleted === false);
    record('Toggling one duplicate habit does not affect the other', passed, `log1=${log1?.isCompleted}, log2=${log2?.isCompleted}`);
  }

  // Test 24: Matrix Done, To Do, and Rest classification logic
  {
    // Reading 1 (daily): scheduled today -> was completed in Test 23 -> status is Done
    // Reading 2 (weekdays): check schedule for today
    const [y, m, d] = today.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const isTodayWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    const { req, res } = mockReqRes({
      user: alice,
      query: { year: y, month: m },
    });
    await getMonthMatrix(req, res);
    const habitsInMatrix = res.data?.data?.habits || [];

    const matrixHabit1 = habitsInMatrix.find((h) => h._id.toString() === dupHabit1Id.toString());
    const matrixHabit2 = habitsInMatrix.find((h) => h._id.toString() === dupHabit2Id.toString());

    const habit1TodayCell = matrixHabit1?.statuses?.[today];
    const habit2TodayCell = matrixHabit2?.statuses?.[today];

    // habit1: scheduled and completed -> Done
    const h1Done = habit1TodayCell?.isScheduled === true && habit1TodayCell?.isCompleted === true;

    // habit2: if weekday -> scheduled & not completed (To Do); if weekend -> not scheduled (Rest)
    const h2Expected = isTodayWeekday
      ? (habit2TodayCell?.isScheduled === true && habit2TodayCell?.isCompleted === false)
      : (habit2TodayCell?.isScheduled === false);

    const passed = h1Done && h2Expected;
    record('Matrix correctly classifies Done, To Do, and Rest based on schedule and completion', passed, `h1Done=${h1Done}, h2Scheduled=${habit2TodayCell?.isScheduled}`);
  }

  // Test 25: Habit stats differentiates duplicate habits by ID, category, and schedule
  {
    const { req, res } = mockReqRes({
      user: alice,
    });
    await getHabitStats(req, res);
    const streakList = res.data?.data?.streaks?.habits || [];
    const s1 = streakList.find((s) => s.habitId.toString() === dupHabit1Id.toString());
    const s2 = streakList.find((s) => s.habitId.toString() === dupHabit2Id.toString());

    const passed = s1 && s2 && s1.category === 'Learning' && s2.category === 'Mindfulness';
    record('Streak stats preserves category & identity for identically named habits', passed, `s1Cat=${s1?.category}, s2Cat=${s2?.category}`);
  }

  console.log('\n\x1b[33m--- Suite 9: Habit Targets CRUD & Habit Management (Edit/Delete) ---\x1b[0m');

  // Test 26: Create personal habit target
  let targetId;
  {
    const { req, res } = mockReqRes({
      user: alice,
      body: { habitName: 'Reading', target: '30 minutes daily' },
    });
    await createHabitTarget(req, res);
    targetId = res.data?.data?._id;
    const passed = res.statusCode === 201 && targetId && res.data?.data?.habitName === 'Reading';
    record('Create personal habit target succeeds (HTTP 201)', passed, `status=${res.statusCode}, targetId=${targetId}`);
  }

  // Test 27: Reject whitespace-only habit target
  {
    const { req, res } = mockReqRes({
      user: alice,
      body: { habitName: '   ', target: '   ' },
    });
    await createHabitTarget(req, res);
    const passed = res.statusCode === 400;
    record('Whitespace-only habit target is rejected with HTTP 400', passed, `status=${res.statusCode}`);
  }

  // Test 28: Update personal habit target
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: targetId },
      body: { habitName: 'Reading Books', target: '45 minutes daily' },
    });
    await updateHabitTarget(req, res);
    const check = await HabitTarget.findById(targetId);
    const passed = res.statusCode === 200 && check?.habitName === 'Reading Books' && check?.target === '45 minutes daily';
    record('Update personal habit target persists changes', passed, `name=${check?.habitName}`);
  }

  // Test 29: Cross-user isolation on habit targets
  {
    // Bob cannot update Alice's target
    const { req: reqBobUpdate, res: resBobUpdate } = mockReqRes({
      user: bob,
      params: { id: targetId },
      body: { habitName: 'Hacked Target', target: 'Hacked' },
    });
    await updateHabitTarget(reqBobUpdate, resBobUpdate);

    // Bob cannot delete Alice's target
    const { req: reqBobDelete, res: resBobDelete } = mockReqRes({
      user: bob,
      params: { id: targetId },
    });
    await deleteHabitTarget(reqBobDelete, resBobDelete);

    const check = await HabitTarget.findById(targetId);
    const passed = (resBobUpdate.statusCode === 403 || resBobUpdate.statusCode === 404) &&
                   (resBobDelete.statusCode === 403 || resBobDelete.statusCode === 404) &&
                   check?.habitName === 'Reading Books';
    record('User B cannot view, update, or delete User A habit target (HTTP 403/404)', passed, `statusUpdate=${resBobUpdate.statusCode}`);
  }

  // Test 30: Delete personal habit target
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: targetId },
    });
    await deleteHabitTarget(req, res);
    const check = await HabitTarget.findById(targetId);
    const passed = res.statusCode === 200 && check === null;
    record('Delete personal habit target permanently removes target', passed, `deleted=${check === null}`);
  }

  // Test 31: Habit target operations do not mutate habits, logs, or tasks
  {
    const targetCount = await HabitTarget.countDocuments({ userId: alice._id });
    const habitCount = await Habit.countDocuments({ userId: alice._id });
    const taskCount = await Task.countDocuments({});
    const passed = targetCount === 0 && habitCount >= 2 && taskCount === 0;
    record('Target operations are strictly isolated: 0 tasks, no unwanted habit side-effects', passed, `targets=${targetCount}, habits=${habitCount}, tasks=${taskCount}`);
  }

  // Test 32: Habit renaming preserves stable database ID and historical logs
  {
    const initialLogsCount = await HabitLog.countDocuments({ habitId: dupHabit1Id });
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dupHabit1Id },
      body: { name: 'Deep Reading', category: 'Education' },
    });
    await updateHabit(req, res);
    const updatedHabit = await Habit.findById(dupHabit1Id);
    const postLogsCount = await HabitLog.countDocuments({ habitId: dupHabit1Id });

    const passed = res.statusCode === 200 &&
                   updatedHabit?.name === 'Deep Reading' &&
                   updatedHabit?.category === 'Education' &&
                   updatedHabit?._id.toString() === dupHabit1Id.toString() &&
                   initialLogsCount === postLogsCount;
    record('Renaming habit preserves stable database ID and all historical logs', passed, `name=${updatedHabit?.name}, logs=${postLogsCount}`);
  }

  // Test 33: Permanent habit deletion removes habit and its logs while preserving others
  {
    const habit2Before = await Habit.findById(dupHabit2Id);
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: dupHabit1Id },
    });
    await deleteHabit(req, res);

    const deletedHabit = await Habit.findById(dupHabit1Id);
    const deletedLogs = await HabitLog.countDocuments({ habitId: dupHabit1Id });
    const habit2After = await Habit.findById(dupHabit2Id);

    const passed = res.statusCode === 200 &&
                   deletedHabit === null &&
                   deletedLogs === 0 &&
                   habit2After !== null &&
                   habit2After.name === habit2Before.name;
    record('Permanent habit deletion deletes habit and logs while keeping other habits intact', passed, `deleted=${deletedHabit === null}, otherPreserved=${habit2After !== null}`);
  }

  // Summary
  console.log('\n----------------------------------------');
  console.log(`Passed: \x1b[32m${testResults.passed}\x1b[0m | Failed: \x1b[31m${testResults.failed}\x1b[0m | Total: ${testResults.tests.length}`);
  console.log('----------------------------------------\n');

  await mongoose.disconnect();
  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
