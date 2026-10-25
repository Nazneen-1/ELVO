import {
  generateOccurrenceDates,
  projectTaskOccurrences,
  expandTasksForWindow,
  daysInMonth,
  isLeapYear,
  addDaysUTC,
  addMonthsUTC,
  toISODateOnly,
} from './server/src/utils/recurrenceEngine.js';

import {
  generateOccurrenceDates as clientGenerate,
  projectTaskOccurrences as clientProject,
  expandTasksForWindow as clientExpand,
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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 2.3A — RECURRENCE ENGINE TEST SUITE ===\x1b[0m\n');

// -----------------------------------------------------------------------------
// Test 1: Non-Recurring Tasks Remain Unchanged
// -----------------------------------------------------------------------------
console.log('\x1b[1mTest 1: Non-Recurring Tasks Remain Unchanged\x1b[0m');
const nonRecurringTask = {
  _id: 'task_nr_1',
  title: 'Standup',
  startDate: '2026-10-28',
  recurrence: { frequency: 'none' },
};
const nrOccurrences = projectTaskOccurrences(nonRecurringTask, '2026-10-25', '2026-11-05');
record('Non-recurring task inside window yields exactly 1 item', nrOccurrences.length === 1, `Got ${nrOccurrences.length}`);
record('Non-recurring task preserves original _id', nrOccurrences[0]._id === 'task_nr_1');
record('Non-recurring task isOccurrence is false', nrOccurrences[0].isOccurrence === false);
record('Non-recurring task occurrenceId is undefined/null', !nrOccurrences[0].occurrenceId);

const nrOutside = projectTaskOccurrences(nonRecurringTask, '2026-11-01', '2026-11-07');
record('Non-recurring task outside window yields 0 items', nrOutside.length === 0, `Got ${nrOutside.length}`);

// -----------------------------------------------------------------------------
// Test 2: Daily Recurrence Across Month Boundary
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 2: Daily Recurrence Across Month Boundary\x1b[0m');
const dailyDates = generateOccurrenceDates({
  startDate: '2026-10-30',
  frequency: 'daily',
  interval: 1,
  windowStart: '2026-10-25',
  windowEnd: '2026-11-03',
});
const expectedDaily = [
  '2026-10-30',
  '2026-10-31',
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
];
record(
  'Daily recurrence seamlessly crosses Oct 31 -> Nov 1',
  JSON.stringify(dailyDates) === JSON.stringify(expectedDaily),
  `Expected ${JSON.stringify(expectedDaily)}, got ${JSON.stringify(dailyDates)}`
);

// -----------------------------------------------------------------------------
// Test 3: Weekly Recurrence Starting Before Visible Range
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 3: Weekly Recurrence Starting Before Visible Range\x1b[0m');
// Series started on Tuesday Sep 01, 2026
const weeklyDates = generateOccurrenceDates({
  startDate: '2026-09-01',
  frequency: 'weekly',
  interval: 1,
  windowStart: '2026-10-25', // Sunday
  windowEnd: '2026-11-07',   // Saturday
});
const expectedWeekly = [
  '2026-10-27', // Tuesday
  '2026-11-03', // Tuesday
];
record(
  'Weekly recurrence projects only matching day of week in window (Tuesdays)',
  JSON.stringify(weeklyDates) === JSON.stringify(expectedWeekly),
  `Expected ${JSON.stringify(expectedWeekly)}, got ${JSON.stringify(weeklyDates)}`
);

// -----------------------------------------------------------------------------
// Test 4: Monthly Recurrence & Month-End Clamping (Jan 31 Case)
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 4: Monthly Recurrence & Month-End Clamping (Jan 31 Case)\x1b[0m');
// Jan 31 monthly series in non-leap year (2026)
const monthlyDates2026 = generateOccurrenceDates({
  startDate: '2026-01-31',
  frequency: 'monthly',
  interval: 1,
  windowStart: '2026-01-01',
  windowEnd: '2026-05-31',
});
const expectedMonthly2026 = [
  '2026-01-31',
  '2026-02-28', // Clamped to 28 in non-leap year Feb
  '2026-03-31', // Reverts to original day 31
  '2026-04-30', // Clamped to 30 in April
  '2026-05-31', // Reverts to original day 31
];
record(
  'Jan 31 clamps to Feb 28 and reverts to 31 in March and May',
  JSON.stringify(monthlyDates2026) === JSON.stringify(expectedMonthly2026),
  `Expected ${JSON.stringify(expectedMonthly2026)}, got ${JSON.stringify(monthlyDates2026)}`
);

// -----------------------------------------------------------------------------
// Test 5: Leap-Year Handling
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 5: Leap-Year Handling\x1b[0m');
record('2024 is identified as a leap year', isLeapYear(2024) === true);
record('2026 is identified as a non-leap year', isLeapYear(2026) === false);
record('Feb 2024 has 29 days', daysInMonth(2024, 2) === 29);
record('Feb 2026 has 28 days', daysInMonth(2026, 2) === 28);

// Jan 31 monthly in leap year 2024
const monthlyDates2024 = generateOccurrenceDates({
  startDate: '2024-01-31',
  frequency: 'monthly',
  interval: 1,
  windowStart: '2024-02-01',
  windowEnd: '2024-03-31',
});
record(
  'Jan 31 in leap year 2024 clamps to Feb 29',
  monthlyDates2024[0] === '2024-02-29' && monthlyDates2024[1] === '2024-03-31',
  `Got ${JSON.stringify(monthlyDates2024)}`
);

// Feb 29 series in non-leap year 2025
const leapDaySeries = generateOccurrenceDates({
  startDate: '2024-02-29',
  frequency: 'monthly',
  interval: 1,
  windowStart: '2025-02-01',
  windowEnd: '2025-03-31',
});
record(
  'Feb 29 series clamps to Feb 28 in 2025 and 29 in March',
  leapDaySeries[0] === '2025-02-28' && leapDaySeries[1] === '2025-03-29',
  `Got ${JSON.stringify(leapDaySeries)}`
);

// -----------------------------------------------------------------------------
// Test 6: Interval Values Greater Than One
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 6: Interval Values Greater Than One\x1b[0m');

// Every 3 days
const every3Days = generateOccurrenceDates({
  startDate: '2026-10-01',
  frequency: 'daily',
  interval: 3,
  windowStart: '2026-10-01',
  windowEnd: '2026-10-10',
});
record(
  'Daily interval = 3 yields Oct 1, 4, 7, 10',
  JSON.stringify(every3Days) === JSON.stringify(['2026-10-01', '2026-10-04', '2026-10-07', '2026-10-10']),
  `Got ${JSON.stringify(every3Days)}`
);

// Bi-weekly (every 2 weeks)
const biWeekly = generateOccurrenceDates({
  startDate: '2026-10-01',
  frequency: 'weekly',
  interval: 2,
  windowStart: '2026-10-01',
  windowEnd: '2026-10-31',
});
record(
  'Weekly interval = 2 yields Oct 1, 15, 29',
  JSON.stringify(biWeekly) === JSON.stringify(['2026-10-01', '2026-10-15', '2026-10-29']),
  `Got ${JSON.stringify(biWeekly)}`
);

// Quarterly (every 3 months)
const quarterly = generateOccurrenceDates({
  startDate: '2026-01-15',
  frequency: 'monthly',
  interval: 3,
  windowStart: '2026-01-01',
  windowEnd: '2026-12-31',
});
record(
  'Monthly interval = 3 yields Jan 15, Apr 15, Jul 15, Oct 15',
  JSON.stringify(quarterly) === JSON.stringify(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']),
  `Got ${JSON.stringify(quarterly)}`
);

// -----------------------------------------------------------------------------
// Test 7: Recurrence End-Date (until) Inclusion & Exclusion
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 7: Recurrence End-Date (until) Inclusion & Exclusion\x1b[0m');
const withUntil = generateOccurrenceDates({
  startDate: '2026-10-01',
  frequency: 'daily',
  interval: 1,
  until: '2026-10-05',
  windowStart: '2026-10-01',
  windowEnd: '2026-10-10',
});
record(
  'Occurrences include until date (Oct 5) and exclude days after (Oct 6-10)',
  JSON.stringify(withUntil) === JSON.stringify(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']),
  `Got ${JSON.stringify(withUntil)}`
);

const seriesEnded = generateOccurrenceDates({
  startDate: '2026-08-01',
  frequency: 'daily',
  interval: 1,
  until: '2026-08-15',
  windowStart: '2026-10-01',
  windowEnd: '2026-10-31',
});
record('Series ended before window start yields 0 occurrences', seriesEnded.length === 0, `Got ${seriesEnded.length}`);

// -----------------------------------------------------------------------------
// Test 8: No Occurrences Before Series Start Date
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 8: No Occurrences Before Series Start Date\x1b[0m');
const futureStart = generateOccurrenceDates({
  startDate: '2026-10-20',
  frequency: 'daily',
  interval: 1,
  windowStart: '2026-10-01',
  windowEnd: '2026-10-31',
});
record('First occurrence matches series start date (Oct 20)', futureStart[0] === '2026-10-20', `Got ${futureStart[0]}`);
record('No dates generated prior to series start date', !futureStart.some((d) => d < '2026-10-20'));

// -----------------------------------------------------------------------------
// Test 9: Occurrences Generated Only Within Requested Window
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 9: Occurrences Generated Only Within Requested Window\x1b[0m');
const subWindow = generateOccurrenceDates({
  startDate: '2026-01-01',
  frequency: 'daily',
  interval: 1,
  windowStart: '2026-06-10',
  windowEnd: '2026-06-15',
});
record('Generates exactly 6 days in 6-day subwindow', subWindow.length === 6, `Got ${subWindow.length}`);
record('Starts at windowStart (2026-06-10)', subWindow[0] === '2026-06-10');
record('Ends at windowEnd (2026-06-15)', subWindow[5] === '2026-06-15');

// -----------------------------------------------------------------------------
// Test 10: Stable, Unique Occurrence Identities & Real MongoDB ID Separation
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 10: Stable, Unique Occurrence Identities & Real MongoDB ID Separation\x1b[0m');
const recurringMaster = {
  _id: '661000000000000000000001',
  title: 'Daily Standup',
  startDate: '2026-10-01',
  startTime: '09:00',
  endTime: '09:30',
  recurrence: { frequency: 'daily', interval: 1 },
};
const projected = projectTaskOccurrences(recurringMaster, '2026-10-01', '2026-10-03');

record('Generates 3 projected instances', projected.length === 3, `Got ${projected.length}`);
record(
  'Every occurrence preserves real MongoDB ObjectId in _id',
  projected.every((p) => p._id === '661000000000000000000001')
);
record(
  'Every occurrence has unique occurrenceId format (${masterId}__${date})',
  projected[0].occurrenceId === '661000000000000000000001__2026-10-01' &&
  projected[1].occurrenceId === '661000000000000000000001__2026-10-02' &&
  projected[2].occurrenceId === '661000000000000000000001__2026-10-03'
);
record(
  'Every occurrence has masterTaskId pointing to master',
  projected.every((p) => p.masterTaskId === '661000000000000000000001')
);
record(
  'Every occurrence has isOccurrence = true',
  projected.every((p) => p.isOccurrence === true)
);

// -----------------------------------------------------------------------------
// Test 11: Recurrence Exceptions & Skipped/Completed Semantics
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 11: Recurrence Exceptions & Skipped/Completed Semantics\x1b[0m');
const taskWithExceptions = {
  _id: '661000000000000000000002',
  title: 'Team Sync',
  startDate: '2026-10-01',
  status: 'To Do',
  recurrence: { frequency: 'daily', interval: 1 },
  recurrenceExceptions: [
    { date: '2026-10-02', status: 'Done', action: 'completed' },
    { date: '2026-10-03', action: 'skipped' },
  ],
};
const projectedExceptions = projectTaskOccurrences(taskWithExceptions, '2026-10-01', '2026-10-04');
record(
  'Skipped occurrence on Oct 3 is omitted from output (3 remaining)',
  projectedExceptions.length === 3,
  `Got ${projectedExceptions.length}`
);
const oct2 = projectedExceptions.find((p) => p.occurrenceDate === '2026-10-02');
record('Completed exception on Oct 2 overrides status to "Done"', oct2.status === 'Done', `Got ${oct2.status}`);
const oct1 = projectedExceptions.find((p) => p.occurrenceDate === '2026-10-01');
record('Natural instance on Oct 1 retains master status "To Do"', oct1.status === 'To Do', `Got ${oct1.status}`);

// -----------------------------------------------------------------------------
// Test 12: Collection Expansion & Zero Duplicate Projection
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 12: Collection Expansion & Zero Duplicate Projection\x1b[0m');
const mixedTasks = [
  { _id: 'm1', title: 'Single Task', startDate: '2026-10-27', recurrence: { frequency: 'none' } },
  { _id: 'm2', title: 'Daily Series', startDate: '2026-10-26', recurrence: { frequency: 'daily', interval: 1 } },
];
const expanded = expandTasksForWindow(mixedTasks, '2026-10-25', '2026-10-28');
const occIds = expanded.map((t) => t.occurrenceId || t._id);
const uniqueOccIds = new Set(occIds);
record(
  'Expanded collection has zero duplicate keys / occurrence IDs',
  occIds.length === uniqueOccIds.size,
  `Total: ${occIds.length}, Unique: ${uniqueOccIds.size}`
);
record(
  'Mixed collection expanded into 4 daily occurrences + 1 single task = 4 items in window',
  expanded.length === 4,
  `Got ${expanded.length}`
);

// -----------------------------------------------------------------------------
// Test 13: Client/Server Engine Parity Check
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 13: Client and Server Engine Parity\x1b[0m');
const serverDates = generateOccurrenceDates({
  startDate: '2026-01-31',
  frequency: 'monthly',
  interval: 1,
  windowStart: '2026-01-01',
  windowEnd: '2026-04-30',
});
const clientDates = clientGenerate({
  startDate: '2026-01-31',
  frequency: 'monthly',
  interval: 1,
  windowStart: '2026-01-01',
  windowEnd: '2026-04-30',
});
record(
  'Client and server generateOccurrenceDates output is 100% identical',
  JSON.stringify(serverDates) === JSON.stringify(clientDates)
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[36m=== PHASE 2.3A TEST RESULTS SUMMARY ===\x1b[0m');
console.log(`  \x1b[32m✔ Passed: ${testResults.passed}\x1b[0m`);
console.log(`  \x1b[31m✖ Failed: ${testResults.failed}\x1b[0m`);
console.log(`  Total:   ${testResults.tests.length}\n`);

if (testResults.failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1m✨ ALL PHASE 2.3A RECURRENCE ENGINE TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
}
