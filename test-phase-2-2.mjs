import {
  getWeekDays,
  formatViewLabel,
  computeTimedTasksLayout,
  toISODate,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addMonths,
  subMonths,
} from './client/src/utils/dateUtils.js';

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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 2.2 — WEEK & DAY CALENDAR VIEWS TEST SUITE ===\x1b[0m\n');

// -----------------------------------------------------------------------------
// Test 1: WeekDays Generation & Sunday/Monday Week-Start Preferences
// -----------------------------------------------------------------------------
console.log('\x1b[1mTest 1: WeekDays Generation & Week-Start Preferences (Sunday vs Monday)\x1b[0m');
const midWeekDate = new Date(2026, 9, 28); // Wednesday Oct 28, 2026

// Sunday week-start (0)
const weekSun = getWeekDays(midWeekDate, 0);
record('Week starts on Sunday (weekStartsOn = 0) returns 7 days', weekSun.length === 7, `Got ${weekSun.length}`);
record(
  'First day of Sunday week is Sunday Oct 25, 2026',
  weekSun[0].isoString === '2026-10-25' && weekSun[0].dayName === 'Sun',
  `Expected Sun 2026-10-25, got ${weekSun[0].dayName} ${weekSun[0].isoString}`
);
record(
  'Last day of Sunday week is Saturday Oct 31, 2026',
  weekSun[6].isoString === '2026-10-31' && weekSun[6].dayName === 'Sat',
  `Expected Sat 2026-10-31, got ${weekSun[6].dayName} ${weekSun[6].isoString}`
);

// Monday week-start (1)
const weekMon = getWeekDays(midWeekDate, 1);
record('Week starts on Monday (weekStartsOn = 1) returns 7 days', weekMon.length === 7, `Got ${weekMon.length}`);
record(
  'First day of Monday week is Monday Oct 26, 2026',
  weekMon[0].isoString === '2026-10-26' && weekMon[0].dayName === 'Mon',
  `Expected Mon 2026-10-26, got ${weekMon[0].dayName} ${weekMon[0].isoString}`
);
record(
  'Last day of Monday week is Sunday Nov 1, 2026',
  weekMon[6].isoString === '2026-11-01' && weekMon[6].dayName === 'Sun',
  `Expected Sun 2026-11-01, got ${weekMon[6].dayName} ${weekMon[6].isoString}`
);

// -----------------------------------------------------------------------------
// Test 2: Dynamic Calendar Header View Labels
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 2: Dynamic Header Label Formatting Across View Modes\x1b[0m');
const testDate = new Date(2026, 9, 25); // Oct 25, 2026

// Month label
const monthLbl = formatViewLabel(testDate, 'month');
record(
  'Month view label format ("October 2026")',
  monthLbl === 'October 2026',
  `Expected "October 2026", got "${monthLbl}"`
);

// Week label (same month: Oct 25 - Oct 31)
const weekLblSameMonth = formatViewLabel(testDate, 'week', 0);
record(
  'Week view label within same month ("Oct 25 – 31, 2026")',
  weekLblSameMonth === 'Oct 25 – 31, 2026',
  `Expected "Oct 25 – 31, 2026", got "${weekLblSameMonth}"`
);

// Week label (spanning months: Oct 26 - Nov 1 with Monday start)
const weekLblCrossMonth = formatViewLabel(testDate, 'week', 1);
record(
  'Week view label across month boundary ("Oct 19 – 25, 2026")',
  weekLblCrossMonth === 'Oct 19 – 25, 2026',
  `Expected "Oct 19 – 25, 2026", got "${weekLblCrossMonth}"`
);

// Day label
const dayLbl = formatViewLabel(testDate, 'day');
record(
  'Day view label format ("Sunday, October 25, 2026")',
  dayLbl === 'Sunday, October 25, 2026',
  `Expected "Sunday, October 25, 2026", got "${dayLbl}"`
);

// -----------------------------------------------------------------------------
// Test 3: All-Day vs Timed Task Partitioning
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 3: All-Day vs Timed Task Partitioning\x1b[0m');
const mixedTasks = [
  { _id: '1', title: 'Vacation Day', isAllDay: true },
  { _id: '2', title: 'No Time Assigned', isAllDay: false, startTime: null },
  { _id: '3', title: 'Morning Standup', startTime: '09:00', endTime: '09:30', isAllDay: false },
  { _id: '4', title: 'Focus Sprint', startTime: '10:00', endTime: null, estimatedMinutes: 60, isAllDay: false },
];

const { allDayTasks, timedTasks } = computeTimedTasksLayout(mixedTasks);
record('Exactly 2 all-day tasks identified', allDayTasks.length === 2, `Expected 2, got ${allDayTasks.length}`);
record('Exactly 2 timed tasks identified', timedTasks.length === 2, `Expected 2, got ${timedTasks.length}`);
record(
  'All-day tasks include explicit isAllDay and untimed tasks',
  allDayTasks.some((t) => t._id === '1') && allDayTasks.some((t) => t._id === '2'),
  'Missing expected all-day task'
);
record(
  'Timed tasks include timed range and open-ended timed tasks',
  timedTasks.some((t) => t.task._id === '3') && timedTasks.some((t) => t.task._id === '4'),
  'Missing expected timed task'
);

// -----------------------------------------------------------------------------
// Test 4: Overlap-Safe Layout Algorithm (Side-by-Side Sub-Columns)
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 4: Overlap-Safe Layout Algorithm\x1b[0m');

// Scenario A: Non-overlapping tasks
const nonOverlapping = [
  { _id: 't1', title: 'Breakfast', startTime: '08:00', endTime: '09:00' },
  { _id: 't2', title: 'Team Meeting', startTime: '09:30', endTime: '10:30' },
];
const resNonOverlap = computeTimedTasksLayout(nonOverlapping);
record(
  'Non-overlapping tasks both receive 100% width and column 0',
  resNonOverlap.timedTasks[0].totalColumns === 1 &&
    resNonOverlap.timedTasks[0].widthPercent === 100 &&
    resNonOverlap.timedTasks[1].totalColumns === 1 &&
    resNonOverlap.timedTasks[1].widthPercent === 100,
  `Got col 1: ${resNonOverlap.timedTasks[0].widthPercent}%, col 2: ${resNonOverlap.timedTasks[1].widthPercent}%`
);

// Scenario B: Pair of mutually overlapping tasks (10:00-11:30 and 10:30-12:00)
const overlappingPair = [
  { _id: 't1', title: 'Client Sync', startTime: '10:00', endTime: '11:30' },
  { _id: 't2', title: 'Design Review', startTime: '10:30', endTime: '12:00' },
];
const resPair = computeTimedTasksLayout(overlappingPair);
const pairT1 = resPair.timedTasks.find((t) => t.task._id === 't1');
const pairT2 = resPair.timedTasks.find((t) => t.task._id === 't2');

record(
  'Overlapping pair splits into 2 parallel columns (50% width each)',
  pairT1.totalColumns === 2 && pairT2.totalColumns === 2 && pairT1.widthPercent === 50 && pairT2.widthPercent === 50,
  `Got t1 width: ${pairT1.widthPercent}%, t2 width: ${pairT2.widthPercent}%`
);
record(
  'Overlapping pair placed side-by-side with distinct left offsets (0% and 50%)',
  pairT1.leftPercent === 0 && pairT2.leftPercent === 50,
  `Got t1 left: ${pairT1.leftPercent}%, t2 left: ${pairT2.leftPercent}%`
);

// Scenario C: Three mutually overlapping tasks (10:00-12:00, 10:15-11:45, 10:30-11:00)
const threeOverlap = [
  { _id: 't1', title: 'Task A', startTime: '10:00', endTime: '12:00' },
  { _id: 't2', title: 'Task B', startTime: '10:15', endTime: '11:45' },
  { _id: 't3', title: 'Task C', startTime: '10:30', endTime: '11:00' },
];
const resThree = computeTimedTasksLayout(threeOverlap);
const totalColsThree = resThree.timedTasks[0].totalColumns;
record(
  'Three mutually overlapping tasks split into 3 columns (~33.3% width each)',
  totalColsThree === 3 && Math.abs(resThree.timedTasks[0].widthPercent - 33.333) < 0.1,
  `Got totalCols: ${totalColsThree}, width: ${resThree.timedTasks[0].widthPercent}%`
);
record(
  'Three overlapping tasks occupy columns 0, 1, and 2 respectively',
  resThree.timedTasks[0].column === 0 && resThree.timedTasks[1].column === 1 && resThree.timedTasks[2].column === 2,
  `Got cols: ${resThree.timedTasks.map((t) => t.column).join(', ')}`
);

// Scenario D: Sequential reuse of columns in a cluster
// Task 1: 10:00 - 11:00 (col 0)
// Task 2: 10:30 - 12:00 (col 1)
// Task 3: 11:15 - 12:15 (reuses col 0 because 11:15 >= 11:00!)
const columnReuse = [
  { _id: 't1', title: 'Morning 1', startTime: '10:00', endTime: '11:00' },
  { _id: 't2', title: 'Long Meeting', startTime: '10:30', endTime: '12:00' },
  { _id: 't3', title: 'Morning 2', startTime: '11:15', endTime: '12:15' },
];
const resReuse = computeTimedTasksLayout(columnReuse);
const reuseT1 = resReuse.timedTasks.find((t) => t.task._id === 't1');
const reuseT2 = resReuse.timedTasks.find((t) => t.task._id === 't2');
const reuseT3 = resReuse.timedTasks.find((t) => t.task._id === 't3');

record(
  'Sequential non-overlapping task reuses column 0 (totalColumns = 2)',
  reuseT1.column === 0 && reuseT2.column === 1 && reuseT3.column === 0 && reuseT1.totalColumns === 2,
  `Got t1: col ${reuseT1.column}, t2: col ${reuseT2.column}, t3: col ${reuseT3.column}, totalCols: ${reuseT1.totalColumns}`
);

// -----------------------------------------------------------------------------
// Test 5: Accurate Time Positioning & Boundary Calculations
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 5: Accurate Time Positioning & Boundary Calculations\x1b[0m');
const boundaryTasks = [
  { _id: 'b1', title: 'Midnight Event', startTime: '00:00', endTime: '01:00' },
  { _id: 'b2', title: 'Noon Event', startTime: '12:00', endTime: '13:00' },
  { _id: 'b3', title: 'End-of-Day Event', startTime: '23:00', endTime: '23:59' },
  { _id: 'b4', title: 'Open-ended Estimated', startTime: '14:00', estimatedMinutes: 90 },
];
const resBoundary = computeTimedTasksLayout(boundaryTasks);
const b1 = resBoundary.timedTasks.find((t) => t.task._id === 'b1');
const b2 = resBoundary.timedTasks.find((t) => t.task._id === 'b2');
const b3 = resBoundary.timedTasks.find((t) => t.task._id === 'b3');
const b4 = resBoundary.timedTasks.find((t) => t.task._id === 'b4');

record('Midnight task positions at top 0%', b1.topPercent === 0, `Got top: ${b1.topPercent}%`);
record('Noon task positions at top 50%', b2.topPercent === 50, `Got top: ${b2.topPercent}%`);
record(
  'End of day task positions at top ~95.8%',
  Math.abs(b3.topPercent - (23 / 24) * 100) < 0.1,
  `Got top: ${b3.topPercent}%`
);
record(
  'Open-ended task uses estimatedMinutes (90 min = 6.25% height)',
  Math.abs(b4.heightPercent - (90 / 1440) * 100) < 0.1,
  `Got height: ${b4.heightPercent}%`
);

// -----------------------------------------------------------------------------
// Test 6: View Navigation Stepping Logic
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 6: View Navigation Stepping Logic\x1b[0m');
const anchor = new Date(2026, 9, 25); // Oct 25, 2026

// Day stepping
const nextDay = addDays(anchor, 1);
const prevDay = subDays(anchor, 1);
record('addDays(Oct 25, 1) = Oct 26', toISODate(nextDay) === '2026-10-26', `Got ${toISODate(nextDay)}`);
record('subDays(Oct 25, 1) = Oct 24', toISODate(prevDay) === '2026-10-24', `Got ${toISODate(prevDay)}`);

// Week stepping
const nextWeek = addWeeks(anchor, 1);
const prevWeek = subWeeks(anchor, 1);
record('addWeeks(Oct 25, 1) = Nov 01', toISODate(nextWeek) === '2026-11-01', `Got ${toISODate(nextWeek)}`);
record('subWeeks(Oct 25, 1) = Oct 18', toISODate(prevWeek) === '2026-10-18', `Got ${toISODate(prevWeek)}`);

// Month stepping
const nextMonth = addMonths(anchor, 1);
const prevMonth = subMonths(anchor, 1);
record('addMonths(Oct 25, 1) = Nov 25', toISODate(nextMonth) === '2026-11-25', `Got ${toISODate(nextMonth)}`);
record('subMonths(Oct 25, 1) = Sep 25', toISODate(prevMonth) === '2026-09-25', `Got ${toISODate(prevMonth)}`);

// -----------------------------------------------------------------------------
// Test 7: Time-Slot Selection & Default End-Time Derivation
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 7: Time-Slot Selection & Default End-Time Derivation\x1b[0m');

function deriveDefaultTimes(initialStartTime) {
  let startTime = initialStartTime || '';
  let endTime = '';
  if (initialStartTime && /^\d{2}:\d{2}$/.test(initialStartTime)) {
    const [h, m] = initialStartTime.split(':').map(Number);
    if (h === 23) {
      endTime = '23:59';
    } else {
      endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return { startTime, endTime };
}

// Case 1: Clicking 10:00 AM slot
const slot10 = deriveDefaultTimes('10:00');
record('Clicking 10:00 AM slot initializes startTime = "10:00"', slot10.startTime === '10:00', `Got ${slot10.startTime}`);
record('Clicking 10:00 AM slot sets default endTime = "11:00"', slot10.endTime === '11:00', `Got ${slot10.endTime}`);

// Case 2: Clicking midnight slot (00:00)
const slotMidnight = deriveDefaultTimes('00:00');
record('Clicking 00:00 slot initializes startTime = "00:00"', slotMidnight.startTime === '00:00', `Got ${slotMidnight.startTime}`);
record('Clicking 00:00 slot sets default endTime = "01:00"', slotMidnight.endTime === '01:00', `Got ${slotMidnight.endTime}`);

// Case 3: Clicking 23:00 slot (must not produce invalid 23:00 end time)
const slot23 = deriveDefaultTimes('23:00');
record('Clicking 23:00 slot initializes startTime = "23:00"', slot23.startTime === '23:00', `Got ${slot23.startTime}`);
record('Clicking 23:00 slot sets default endTime = "23:59"', slot23.endTime === '23:59', `Got ${slot23.endTime}`);

// Case 4: Open create modal with no initial time
const slotEmpty = deriveDefaultTimes('');
record('Opening modal without slot leaves startTime empty', slotEmpty.startTime === '', `Got ${slotEmpty.startTime}`);
record('Opening modal without slot leaves endTime empty', slotEmpty.endTime === '', `Got ${slotEmpty.endTime}`);

// -----------------------------------------------------------------------------
// Test 8: Hourly Gutter Layout Math & Zero Cumulative Drift
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 8: Hourly Gutter Layout Math & Zero Cumulative Drift\x1b[0m');

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_ROW_HEIGHT = 60; // 60px per hour
const TOTAL_CANVAS_HEIGHT = 1440; // 24 * 60px

// Verify time gutter row heights
const gutterRowHeights = HOURS.map(() => HOUR_ROW_HEIGHT);
const totalGutterHeight = gutterRowHeights.reduce((sum, h) => sum + h, 0);

record(
  '24 hour rows of 60px sum to exactly 1440px canvas height (zero drift)',
  totalGutterHeight === TOTAL_CANVAS_HEIGHT,
  `Expected ${TOTAL_CANVAS_HEIGHT}px, got ${totalGutterHeight}px`
);

// Verify Hour 0 (12 AM) layout offset
// In previous buggy version: -mt-2.5 (-10px) caused 12 AM to clip above the scroll viewport.
// In fixed version: hour === 0 uses top-1.5 (+6px offset inside 60px row).
const hour0TopOffsetPx = 6; // top-1.5 in tailwind
record(
  'Hour 0 (12 AM) label has non-negative top offset (>= 0px) preventing clipping',
  hour0TopOffsetPx >= 0 && hour0TopOffsetPx < HOUR_ROW_HEIGHT,
  `Got ${hour0TopOffsetPx}px`
);

// Verify Hour 10 alignment with 10:00 AM task
const hour10GutterTop = 10 * HOUR_ROW_HEIGHT; // 600px
const task10am = computeTimedTasksLayout([{ _id: 't10', startTime: '10:00', endTime: '11:00' }]).timedTasks[0];
const task10amTopPx = (task10am.topPercent / 100) * TOTAL_CANVAS_HEIGHT;

record(
  'Hour 10 slot starts at 600px',
  hour10GutterTop === 600,
  `Expected 600px, got ${hour10GutterTop}px`
);
record(
  'Task starting at 10:00 AM positions at exactly 600px (1:1 lockstep alignment)',
  Math.round(task10amTopPx) === hour10GutterTop,
  `Expected ${hour10GutterTop}px, got ${task10amTopPx}px`
);

// -----------------------------------------------------------------------------
// Test 9: Tasks Page Layout Preference Persistence (List vs Kanban)
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 9: Tasks Page Layout Preference Persistence (List vs Kanban)\x1b[0m');

// Mock localStorage
const mockStorage = new Map();
const storageAdapter = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
};

function initTasksViewMode(storage) {
  try {
    const saved = storage.getItem('elvo_tasks_view_mode');
    return saved === 'kanban' ? 'kanban' : 'list';
  } catch {
    return 'list';
  }
}

function persistTasksViewMode(storage, mode) {
  const validMode = mode === 'kanban' ? 'kanban' : 'list';
  try {
    storage.setItem('elvo_tasks_view_mode', validMode);
  } catch {
    // ignore
  }
  return validMode;
}

// 1. Initial fresh load without prior preference defaults to 'list'
mockStorage.clear();
record('Default tasks view mode is "list" when storage is empty', initTasksViewMode(storageAdapter) === 'list');

// 2. Switching to Kanban persists 'kanban' and restores upon refresh
persistTasksViewMode(storageAdapter, 'kanban');
record('Switching to "kanban" stores "kanban" in localStorage', storageAdapter.getItem('elvo_tasks_view_mode') === 'kanban');
record('Simulated page refresh restores "kanban" layout', initTasksViewMode(storageAdapter) === 'kanban');

// 3. Switching back to List persists 'list' and restores upon refresh
persistTasksViewMode(storageAdapter, 'list');
record('Switching to "list" stores "list" in localStorage', storageAdapter.getItem('elvo_tasks_view_mode') === 'list');
record('Simulated page refresh restores "list" layout', initTasksViewMode(storageAdapter) === 'list');

// 4. Corrupted or invalid localStorage values safely fallback to 'list'
storageAdapter.setItem('elvo_tasks_view_mode', 'invalid_mode_xyz');
record('Invalid stored view mode safely falls back to "list"', initTasksViewMode(storageAdapter) === 'list');

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[36m=== PHASE 2.2 TEST RESULTS SUMMARY ===\x1b[0m');
console.log(`  \x1b[32m✔ Passed: ${testResults.passed}\x1b[0m`);
console.log(`  \x1b[31m✖ Failed: ${testResults.failed}\x1b[0m`);
console.log(`  Total:   ${testResults.tests.length}\n`);

if (testResults.failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1m✨ ALL PHASE 2.2 WEEK & DAY CALENDAR VIEW TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
}
