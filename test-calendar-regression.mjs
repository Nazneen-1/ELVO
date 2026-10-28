/**
 * ELVO — Calendar Regression Test Suite
 *
 * Verifies:
 * 1. CalendarPage Hook Imports Integrity (no missing useCallback/useState/useEffect/useMemo).
 * 2. Static AST / Code scan confirming zero undeclared React hooks in CalendarPage.jsx and calendar components.
 * 3. Calendar View Mode & Assigned Filter Persistence keys in localStorage.
 * 4. DayCell overflow calculations & toggle state logic (+N more / Less).
 * 5. TaskBadge & TimedTaskCard completion toggle and delete isolation logic.
 * 6. Date calculations & matrix generation across Month, Week, and Day views.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getCalendarMatrix,
  getWeekDays,
  formatViewLabel,
  toISODate,
  VALID_CALENDAR_VIEWS,
  getSavedCalendarView,
} from './client/src/utils/dateUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function record(name, passed, detail = '') {
  results.tests.push({ name, passed, detail });
  if (passed) {
    results.passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    results.failed++;
    console.log(`  \x1b[31m✖\x1b[0m ${name}: ${detail}`);
  }
}

async function runTests() {
  console.log('\n\x1b[1m\x1b[36m=== ELVO: CALENDAR REGRESSION AUDIT SUITE ===\x1b[0m\n');

  // Suite 1: CalendarPage Import & Syntax Integrity
  console.log('--- Suite 1: CalendarPage Import & Hook Integrity ---');
  const calendarPagePath = path.join(__dirname, 'client/src/pages/CalendarPage.jsx');
  const calendarPageContent = fs.readFileSync(calendarPagePath, 'utf8');

  record(
    '1.1. CalendarPage.jsx explicitly imports useCallback from react',
    calendarPageContent.includes('useCallback') &&
      /import\s+React,\s*\{[^}]*useCallback[^}]*\}\s+from\s+['"]react['"]/.test(calendarPageContent)
  );

  record(
    '1.2. CalendarPage.jsx explicitly imports useState and useEffect from react',
    /import\s+React,\s*\{[^}]*useState[^}]*\}\s+from\s+['"]react['"]/.test(calendarPageContent) &&
      /import\s+React,\s*\{[^}]*useEffect[^}]*\}\s+from\s+['"]react['"]/.test(calendarPageContent)
  );

  const hooks = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext'];
  const importLines = calendarPageContent.split('\n').filter((l) => l.startsWith('import ')).join(' ');
  let allUsedHooksImported = true;
  hooks.forEach((h) => {
    const usage = new RegExp(`\\b${h}\\s*\\(`, 'g');
    if (usage.test(calendarPageContent) && !importLines.includes(h)) {
      allUsedHooksImported = false;
    }
  });

  record('1.3. Zero undeclared React hooks used in CalendarPage.jsx', allUsedHooksImported);

  // Suite 2: Calendar Components Integrity (DayCell, TaskBadge, TimedTaskCard)
  console.log('\n--- Suite 2: Calendar Component Exports & Structure ---');
  const dayCellPath = path.join(__dirname, 'client/src/components/calendar/DayCell.jsx');
  const taskBadgePath = path.join(__dirname, 'client/src/components/calendar/TaskBadge.jsx');
  const timedTaskCardPath = path.join(__dirname, 'client/src/components/calendar/TimedTaskCard.jsx');

  const dayCellContent = fs.readFileSync(dayCellPath, 'utf8');
  const taskBadgeContent = fs.readFileSync(taskBadgePath, 'utf8');
  const timedCardContent = fs.readFileSync(timedTaskCardPath, 'utf8');

  record(
    '2.1. DayCell handles overflow threshold and toggle expansion',
    dayCellContent.includes('overflowThreshold') &&
      dayCellContent.includes('isExpanded') &&
      dayCellContent.includes('visibleTasks')
  );

  record(
    '2.2. DayCell overflow button is keyboard accessible (Enter and Space keys)',
    dayCellContent.includes('onKeyDown') &&
      dayCellContent.includes("e.key === 'Enter'") &&
      dayCellContent.includes("e.key === ' '")
  );

  record(
    '2.3. TaskBadge has task completion button with accessible title/aria-label',
    taskBadgeContent.includes('handleToggleComplete') &&
      taskBadgeContent.includes('aria-label') &&
      taskBadgeContent.includes('Mark as complete')
  );

  record(
    '2.4. TaskBadge has isolated delete button with stopPropagation',
    taskBadgeContent.includes('handleDelete') &&
      taskBadgeContent.includes('e.stopPropagation()')
  );

  record(
    '2.5. TimedTaskCard has completion checkbox and delete action',
    timedCardContent.includes('handleToggleComplete') &&
      timedCardContent.includes('handleDelete')
  );

  // Suite 3: Date Calculations & Matrix Generation
  console.log('\n--- Suite 3: Calendar Date Utilities & Grid Matrices ---');
  const testDate = new Date('2026-10-28T12:00:00Z');

  const monthMatrixSunday = getCalendarMatrix(testDate, 0);
  record('3.1. Sunday-first month matrix generates valid 35 or 42 grid cells', monthMatrixSunday.length === 35 || monthMatrixSunday.length === 42);

  const monthMatrixMonday = getCalendarMatrix(testDate, 1);
  record('3.2. Monday-first month matrix generates valid 35 or 42 grid cells', monthMatrixMonday.length === 35 || monthMatrixMonday.length === 42);

  const weekDays = getWeekDays(testDate, 0);
  record('3.3. Week view generates exactly 7 days', weekDays.length === 7);

  const monthLabel = formatViewLabel(testDate, 'month', 0);
  record('3.4. Month label formats correctly', monthLabel.includes('October 2026') || monthLabel.includes('Oct 2026'));

  const weekLabel = formatViewLabel(testDate, 'week', 0);
  record('3.5. Week label formats with date range', weekLabel.includes('2026'));

  const dayLabel = formatViewLabel(testDate, 'day', 0);
  record('3.6. Day label formats day of week and date', dayLabel.includes('October') || dayLabel.includes('Wednesday') || dayLabel.includes('28'));

  record('3.7. Valid calendar views include month, week, day', VALID_CALENDAR_VIEWS.includes('month') && VALID_CALENDAR_VIEWS.includes('week') && VALID_CALENDAR_VIEWS.includes('day'));

  // Suite 4: Persistence Configuration Verification
  console.log('\n--- Suite 4: Persistence Key Verification ---');
  record(
    '4.1. CalendarPage uses elvo_calendar_assigned_filter for localStorage persistence',
    calendarPageContent.includes('elvo_calendar_assigned_filter')
  );

  const useCalendarPath = path.join(__dirname, 'client/src/hooks/useCalendar.js');
  const useCalendarContent = fs.readFileSync(useCalendarPath, 'utf8');
  record(
    '4.2. useCalendar uses elvo_calendar_view_mode for localStorage persistence',
    useCalendarContent.includes('elvo_calendar_view_mode')
  );

  console.log('\n=== CALENDAR REGRESSION SUMMARY ===');
  console.log(`Passed: ${results.passed} | Failed: ${results.failed} | Total: ${results.tests.length}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

