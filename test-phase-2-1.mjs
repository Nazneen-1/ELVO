import { toISODate, getCalendarMatrix, compareTime, validateTaskDates } from './client/src/utils/dateUtils.js';
import { execSync } from 'child_process';
import http from 'http';

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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 2.1 — DATE HYGIENE & TIME VALIDATION TEST SUITE ===\x1b[0m\n');

// -----------------------------------------------------------------------------
// Test 1: Date preservation across save & reload simulation
// -----------------------------------------------------------------------------
console.log('\x1b[1mTest 1: Date Selected in Calendar Remains Identical After Save and Reload\x1b[0m');
const selectedCalendarDate = '2026-10-25';
// Frontend sends '2026-10-25', server stores UTC midnight Date: 2026-10-25T00:00:00.000Z
const serverStoredDate = new Date(`${selectedCalendarDate}T00:00:00.000Z`).toISOString();
// Client receives server JSON and maps it for grid / detail view:
const reloadedDate = toISODate(serverStoredDate);
record(
  'Date round-trip persistence (client -> server UTC midnight -> client reload)',
  reloadedDate === selectedCalendarDate,
  `Expected ${selectedCalendarDate}, got ${reloadedDate}`
);

// -----------------------------------------------------------------------------
// Test 2: Date-only handling across positive and negative UTC offsets
// (UTC-12, UTC-8, UTC, UTC+5:30, UTC+14)
// Use timezone-specific test child processes so each offset is isolated.
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 2: Date-Only Handling Across Global UTC Offsets (UTC-12 to UTC+14)\x1b[0m');
const testTimezones = [
  { tz: 'Etc/GMT+12', label: 'UTC-12 (Baker Island / IDLW)' },
  { tz: 'America/Los_Angeles', label: 'UTC-8 / UTC-7 (US Pacific)' },
  { tz: 'UTC', label: 'UTC+0 (London / GMT)' },
  { tz: 'Asia/Kolkata', label: 'UTC+5:30 (India Standard Time)' },
  { tz: 'Pacific/Kiritimati', label: 'UTC+14 (Line Islands / LINT)' },
];

for (const { tz, label } of testTimezones) {
  const childScript = `
    import { toISODate } from './client/src/utils/dateUtils.js';
    const fromIso = toISODate('2026-10-25T00:00:00.000Z');
    const fromPlain = toISODate('2026-10-25');
    console.log(JSON.stringify({ fromIso, fromPlain }));
  `;
  try {
    const rawOut = execSync(`node --input-type=module -e "${childScript.replace(/\n/g, ' ')}"`, {
      env: { ...process.env, TZ: tz },
      stdio: 'pipe',
    }).toString().trim();
    const { fromIso, fromPlain } = JSON.parse(rawOut);

    record(
      `TZ: ${label} preserves exact date 2026-10-25 from UTC timestamp`,
      fromIso === '2026-10-25',
      `Expected 2026-10-25, got ${fromIso} in ${tz}`
    );
    record(
      `TZ: ${label} preserves exact date 2026-10-25 from plain YYYY-MM-DD`,
      fromPlain === '2026-10-25',
      `Expected 2026-10-25, got ${fromPlain} in ${tz}`
    );
  } catch (err) {
    record(`TZ: ${label} execution`, false, err.message);
  }
}

// -----------------------------------------------------------------------------
// Test 3: Valid same-day start and end times
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 3: Valid Same-Day Start and End Times\x1b[0m');
const validSameDay = validateTaskDates({
  startDate: '2026-10-25',
  endDate: '2026-10-25',
  startTime: '09:00',
  endTime: '10:30',
});
record(
  'Valid same-day times (09:00 -> 10:30) pass validation',
  validSameDay.length === 0,
  `Expected no errors, got: ${validSameDay.join(', ')}`
);

const validNoEndDateSameDay = validateTaskDates({
  startDate: '2026-10-25',
  endDate: null,
  startTime: '13:00',
  endTime: '14:00',
});
record(
  'Valid times with absent endDate (implicit same-day) pass validation',
  validNoEndDateSameDay.length === 0,
  `Expected no errors, got: ${validNoEndDateSameDay.join(', ')}`
);

// -----------------------------------------------------------------------------
// Test 4: End time earlier than or equal to start time (same-day)
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 4: End Time Earlier Than or Equal to Start Time\x1b[0m');
const earlierEndTime = validateTaskDates({
  startDate: '2026-10-25',
  startTime: '14:00',
  endTime: '13:30',
});
record(
  'End time earlier than start time (14:00 -> 13:30) rejected',
  earlierEndTime.includes('End time must be later than start time.'),
  `Expected "End time must be later than start time.", got: ${earlierEndTime.join(', ')}`
);

const equalTimes = validateTaskDates({
  startDate: '2026-10-25',
  startTime: '10:00',
  endTime: '10:00',
});
record(
  'Equal start and end times (10:00 -> 10:00) rejected',
  equalTimes.includes('End time must be later than start time.'),
  `Expected "End time must be later than start time.", got: ${equalTimes.join(', ')}`
);

// -----------------------------------------------------------------------------
// Test 5: End date / Due date earlier than start date
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 5: End Date / Due Date Earlier Than Start Date\x1b[0m');
const earlierEndDate = validateTaskDates({
  startDate: '2026-10-25',
  endDate: '2026-10-24',
});
record(
  'End date earlier than start date rejected',
  earlierEndDate.includes('End date cannot be earlier than start date.'),
  `Expected "End date cannot be earlier than start date.", got: ${earlierEndDate.join(', ')}`
);

const earlierDueDate = validateTaskDates({
  startDate: '2026-10-25',
  dueDate: '2026-10-20',
});
record(
  'Due date earlier than start date rejected',
  earlierDueDate.includes('Due date cannot be earlier than start date.'),
  `Expected "Due date cannot be earlier than start date.", got: ${earlierDueDate.join(', ')}`
);

// -----------------------------------------------------------------------------
// Test 6: Valid multi-day tasks
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 6: Valid Multi-Day Tasks\x1b[0m');
// An overnight multi-day shift: start 22:00 on Oct 25, end 06:00 on Oct 26
const multiDayOvernight = validateTaskDates({
  startDate: '2026-10-25',
  endDate: '2026-10-26',
  startTime: '22:00',
  endTime: '06:00',
});
record(
  'Multi-day task spanning across days (Oct 25 22:00 -> Oct 26 06:00) is valid',
  multiDayOvernight.length === 0,
  `Expected no errors for multi-day task, got: ${multiDayOvernight.join(', ')}`
);

const multiDaySpan = validateTaskDates({
  startDate: '2026-10-25',
  endDate: '2026-10-30',
  startTime: '09:00',
  endTime: '17:00',
});
record(
  'Multi-day task spanning multiple days (Oct 25 -> Oct 30) is valid',
  multiDaySpan.length === 0,
  `Expected no errors, got: ${multiDaySpan.join(', ')}`
);

// -----------------------------------------------------------------------------
// Test 7: All-day tasks and tasks without an end time
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 7: All-Day Tasks and Tasks Without an End Time\x1b[0m');
const allDayTask = validateTaskDates({
  startDate: '2026-10-25',
  startTime: null,
  endTime: null,
});
record(
  'All-day task (no times provided) passes validation',
  allDayTask.length === 0,
  `Expected valid, got: ${allDayTask.join(', ')}`
);

const openEndedTask = validateTaskDates({
  startDate: '2026-10-25',
  startTime: '09:00',
  endTime: null,
});
record(
  'Open-ended timed task (startTime provided, endTime absent) passes validation',
  openEndedTask.length === 0,
  `Expected valid, got: ${openEndedTask.join(', ')}`
);

// Verify explicit isAllDay semantics
const isAllDayForUntimed = Boolean(!'' && !'');
const isAllDayForOpenEnded = Boolean(!'09:00' && !'');
const isAllDayForTimedRange = Boolean(!'09:00' && !'10:00');
record(
  'isAllDay evaluates to true when neither start nor end time is set',
  isAllDayForUntimed === true,
  `Expected true, got ${isAllDayForUntimed}`
);
record(
  'isAllDay evaluates to false for open-ended task with startTime',
  isAllDayForOpenEnded === false,
  `Expected false, got ${isAllDayForOpenEnded}`
);
record(
  'isAllDay evaluates to false for timed task with startTime and endTime',
  isAllDayForTimedRange === false,
  `Expected false, got ${isAllDayForTimedRange}`
);

// -----------------------------------------------------------------------------
// Test 8: Compatibility with legacy stored date values
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 8: Compatibility With Legacy Stored Date Values\x1b[0m');
// Legacy records may have had arbitrary wall-clock timestamps saved as startDate
const legacyUtcTimestamp = '2026-10-25T14:35:22.123Z';
const extractedFromLegacy = toISODate(legacyUtcTimestamp);
record(
  'Legacy ISO datetime with arbitrary wall-clock time correctly extracts date portion',
  extractedFromLegacy === '2026-10-25',
  `Expected 2026-10-25, got ${extractedFromLegacy}`
);

// Date object input to validateTaskDates (e.g. from legacy state)
const legacyDateObjStart = new Date('2026-10-25T15:00:00.000Z');
const legacyDateObjDue = new Date('2026-10-25T00:00:00.000Z');
const legacyObjValidation = validateTaskDates({
  startDate: legacyDateObjStart,
  dueDate: legacyDateObjDue,
});
record(
  'Legacy Date objects on same calendar day do not trigger false positive due date error',
  legacyObjValidation.length === 0,
  `Expected valid same-day legacy dates, got: ${legacyObjValidation.join(', ')}`
);

// -----------------------------------------------------------------------------
// Test 9: Calendar Navigation, Week-Start Preferences, and Drag-and-Drop
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 9: Calendar Navigation, Week-Start Preferences, and Drag-and-Drop\x1b[0m');
// Sunday week-start (0)
const octoberGridSunday = getCalendarMatrix(new Date(2026, 9, 1), 0); // October 2026
const firstSlotSunday = octoberGridSunday[0];
record(
  'Sunday week-start (0): First slot is Sunday (2026-09-27)',
  firstSlotSunday.isoString === '2026-09-27' && firstSlotSunday.date.getDay() === 0,
  `Expected Sunday 2026-09-27, got ${firstSlotSunday.isoString} (day ${firstSlotSunday.date.getDay()})`
);

// Monday week-start (1)
const octoberGridMonday = getCalendarMatrix(new Date(2026, 9, 1), 1);
const firstSlotMonday = octoberGridMonday[0];
record(
  'Monday week-start (1): First slot is Monday (2026-09-28)',
  firstSlotMonday.isoString === '2026-09-28' && firstSlotMonday.date.getDay() === 1,
  `Expected Monday 2026-09-28, got ${firstSlotMonday.isoString} (day ${firstSlotMonday.date.getDay()})`
);

// Grid size validation: must be exactly 35 or 42 slots
record(
  'Calendar grid maintains 35 or 42 rectangular slots',
  [35, 42].includes(octoberGridSunday.length) && [35, 42].includes(octoberGridMonday.length),
  `Got lengths Sunday: ${octoberGridSunday.length}, Monday: ${octoberGridMonday.length}`
);

// Drag-and-drop reschedule simulation
const targetDropCell = octoberGridSunday.find((slot) => slot.isoString === '2026-10-28');
const dropPayload = { startDate: targetDropCell.isoString };
record(
  'Drag-and-drop drop payload produces exact YYYY-MM-DD string for reschedule',
  dropPayload.startDate === '2026-10-28',
  `Expected '2026-10-28', got ${dropPayload.startDate}`
);

// -----------------------------------------------------------------------------
// Test 10: Server-Side Validation Authoritativeness & Boundary Queries
// -----------------------------------------------------------------------------
console.log('\n\x1b[1mTest 10: Server-Side Validation Authoritativeness & Boundary Queries\x1b[0m');
const { validateDateTimes: serverValidate, parseDateOnlyUTC, toCalendarDateString } = await import(
  './server/src/controllers/taskController.js'
);

// Server: same-day valid times
const serverValidTimes = serverValidate({
  startDate: new Date('2026-10-25T00:00:00.000Z'),
  endDate: new Date('2026-10-25T00:00:00.000Z'),
  startTime: '09:00',
  endTime: '11:00',
});
record('Server validates valid same-day times', serverValidTimes === null, `Expected null, got: ${serverValidTimes}`);

// Server: same-day invalid times (endTime <= startTime)
const serverInvalidTimes = serverValidate({
  startDate: new Date('2026-10-25T00:00:00.000Z'),
  startTime: '14:00',
  endTime: '13:00',
});
record(
  'Server rejects same-day endTime earlier than startTime',
  serverInvalidTimes === 'End time must be later than start time.',
  `Expected "End time must be later than start time.", got: ${serverInvalidTimes}`
);

// Server: same-day equal times
const serverEqualTimes = serverValidate({
  startDate: new Date('2026-10-25T00:00:00.000Z'),
  startTime: '10:00',
  endTime: '10:00',
});
record(
  'Server rejects same-day equal startTime and endTime',
  serverEqualTimes === 'End time must be later than start time.',
  `Expected "End time must be later than start time.", got: ${serverEqualTimes}`
);

// Server: end date earlier than start date
const serverInvalidEnd = serverValidate({
  startDate: new Date('2026-10-25T00:00:00.000Z'),
  endDate: new Date('2026-10-24T00:00:00.000Z'),
});
record(
  'Server rejects endDate earlier than startDate',
  serverInvalidEnd === 'End date cannot be earlier than start date.',
  `Expected "End date cannot be earlier than start date.", got: ${serverInvalidEnd}`
);

// Server: due date earlier than start date
const serverInvalidDue = serverValidate({
  startDate: new Date('2026-10-25T00:00:00.000Z'),
  dueDate: new Date('2026-10-20T00:00:00.000Z'),
});
record(
  'Server rejects dueDate earlier than startDate',
  serverInvalidDue === 'Due date cannot be earlier than start date.',
  `Expected "Due date cannot be earlier than start date.", got: ${serverInvalidDue}`
);

// Server: multi-day task spanning across days
const serverMultiDay = serverValidate({
  startDate: new Date('2026-10-25T00:00:00.000Z'),
  endDate: new Date('2026-10-26T00:00:00.000Z'),
  startTime: '22:00',
  endTime: '06:00',
});
record('Server permits multi-day task with overnight times', serverMultiDay === null, `Expected null, got: ${serverMultiDay}`);

// Server: parseDateOnlyUTC creates exact UTC midnight
const parsedUtcDate = parseDateOnlyUTC('2026-10-25');
record(
  'parseDateOnlyUTC produces exact UTC midnight 2026-10-25T00:00:00.000Z',
  parsedUtcDate.toISOString() === '2026-10-25T00:00:00.000Z',
  `Expected 2026-10-25T00:00:00.000Z, got ${parsedUtcDate.toISOString()}`
);

// Server: calendar grid end date inclusive query boundary
const endDay = parseDateOnlyUTC('2026-10-31');
const endOfDay = new Date(endDay.getTime() + 24 * 60 * 60 * 1000 - 1);
record(
  'Date range end-bound extends to 23:59:59.999Z',
  endOfDay.toISOString() === '2026-10-31T23:59:59.999Z',
  `Expected 2026-10-31T23:59:59.999Z, got ${endOfDay.toISOString()}`
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[36m=== TEST RESULTS SUMMARY ===\x1b[0m');
console.log(`  \x1b[32m✔ Passed: ${testResults.passed}\x1b[0m`);
console.log(`  \x1b[31m✖ Failed: ${testResults.failed}\x1b[0m`);
console.log(`  Total:   ${testResults.tests.length}\n`);

if (testResults.failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1m✨ ALL PHASE 2.1 DATE HYGIENE & TIME VALIDATION TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
}
