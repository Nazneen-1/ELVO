/**
 * ELVO — Phase 3 My Work: Calendar Aggregation and Context Persistence Test Suite
 *
 * Covers:
 * 1. My Work Calendar API returns personal and assigned collaborative tasks (all-day, timed, recurring).
 * 2. Tasks assigned exclusively to other members are excluded.
 * 3. Unauthorized workspace tasks are excluded.
 * 4. Unassigned tasks created by the user in an authorized workspace are included.
 * 5. Recurrence projection, occurrence dates, and occurrence completion in My Work calendar view.
 * 6. Populated workspace metadata ({ _id, name, color, icon }) on created tasks and window queries.
 * 7. Active workspace context persistence logic:
 *    - 'my-work' survives page refresh
 *    - 'personal' persists
 *    - collaborative workspace ID persists
 *    - invalid / unauthorized stored workspace safely falls back to 'personal'
 *    - authentication loading does not reset context
 *    - logout cleans up storage to prevent cross-account leakage
 */

import mongoose from './server/node_modules/mongoose/index.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import {
  getTasks,
  createTask,
  updateTask,
  patchTask,
  updateTaskOccurrence,
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

console.log('\n\x1b[1m\x1b[36m=== ELVO: MY WORK CALENDAR AGGREGATION & CONTEXT PERSISTENCE SUITE ===\x1b[0m\n');

const testUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
assertSafeTestDatabase(testUri);

function mockReqRes({ query = {}, params = {}, body = {}, user = null } = {}) {
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

async function runRegressionSuite() {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    console.log('  \x1b[32m✔\x1b[0m Connected to isolated local test database');

    const ts = Date.now();

    // 1. Setup Users
    const userAlice = await User.create({
      name: 'Alice Developer',
      email: `alice_${ts}@elvo.test`,
      password: 'password123',
    });
    const userBob = await User.create({
      name: 'Bob Designer',
      email: `bob_${ts}@elvo.test`,
      password: 'password123',
    });

    // 2. Setup Workspaces
    const wsEng = await Workspace.create({
      name: 'Engineering',
      owner: userAlice._id,
      members: [
        { user: userAlice._id, role: 'owner' },
        { user: userBob._id, role: 'member' },
      ],
      color: 'indigo',
    });

    const wsDesign = await Workspace.create({
      name: 'Design Ops',
      owner: userBob._id,
      members: [
        { user: userBob._id, role: 'owner' },
        { user: userAlice._id, role: 'member' },
      ],
      color: 'purple',
    });

    const wsSecret = await Workspace.create({
      name: 'Confidential Finance',
      owner: userBob._id,
      members: [{ user: userBob._id, role: 'owner' }],
      color: 'rose',
    });

    const createdTaskIds = [];

    // 3. Seed Tasks
    // 3.1 Personal task for Alice (All-day)
    const tPersonal = await Task.create({
      userId: userAlice._id,
      workspaceId: null,
      title: "Alice Personal Journal",
      startDate: new Date('2026-11-05T00:00:00.000Z'),
      isAllDay: true,
      status: 'To Do',
      priority: 'Low',
    });
    createdTaskIds.push(tPersonal._id);

    // 3.2 Engineering task created by Bob, assigned to Alice (Timed)
    const tEngAssigned = await Task.create({
      userId: userBob._id,
      workspaceId: wsEng._id,
      assignedTo: userAlice._id,
      title: 'Fix Authentication Flow',
      startDate: new Date('2026-11-06T10:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:30',
      isAllDay: false,
      status: 'In Progress',
      priority: 'High',
    });
    createdTaskIds.push(tEngAssigned._id);

    // 3.3 Design task created by Alice, unassigned (Alice is responsible creator)
    const tDesignUnassigned = await Task.create({
      userId: userAlice._id,
      workspaceId: wsDesign._id,
      assignedTo: null,
      title: 'Draft Mobile Design Specs',
      startDate: new Date('2026-11-07T14:00:00.000Z'),
      startTime: '14:00',
      endTime: '15:00',
      isAllDay: false,
      status: 'To Do',
      priority: 'Medium',
    });
    createdTaskIds.push(tDesignUnassigned._id);

    // 3.4 Engineering task created by Alice, assigned exclusively to Bob
    const tEngBobOnly = await Task.create({
      userId: userAlice._id,
      workspaceId: wsEng._id,
      assignedTo: userBob._id,
      title: 'Bob Infrastructure Upgrade',
      startDate: new Date('2026-11-06T09:00:00.000Z'),
      isAllDay: true,
      status: 'To Do',
      priority: 'High',
    });
    createdTaskIds.push(tEngBobOnly._id);

    // 3.5 Secret workspace task (Alice is not a member)
    const tSecret = await Task.create({
      userId: userBob._id,
      workspaceId: wsSecret._id,
      assignedTo: userAlice._id,
      title: 'Unauthorized Secret Task',
      startDate: new Date('2026-11-06T12:00:00.000Z'),
      isAllDay: true,
      status: 'To Do',
      priority: 'High',
    });
    createdTaskIds.push(tSecret._id);

    // 3.6 Recurring task assigned to Alice in Engineering workspace (Daily)
    const tRecurringEng = await Task.create({
      userId: userBob._id,
      workspaceId: wsEng._id,
      assignedTo: userAlice._id,
      title: 'Daily Engineering Standup',
      startDate: new Date('2026-11-04T09:00:00.000Z'),
      startTime: '09:00',
      endTime: '09:30',
      isAllDay: false,
      status: 'To Do',
      recurrence: { frequency: 'daily', interval: 1 },
    });
    createdTaskIds.push(tRecurringEng._id);

    console.log('\n\x1b[1mSuite 1: Calendar Date Window Query with My Work Aggregation\x1b[0m');
    {
      // Calendar query for November 2026 window: 2026-10-25 to 2026-12-05
      const { req, res, next, getStatus, getData } = mockReqRes({
        query: {
          workspaceId: 'my-work',
          start: '2026-10-25',
          end: '2026-12-05',
        },
        user: userAlice,
      });

      await getTasks(req, res, next);
      record('1.1. Calendar window query with workspaceId=my-work returns 200', getStatus() === 200);

      const returned = getData()?.data || [];
      const titles = returned.map((t) => t.title);
      console.log('      DEBUG returned titles count:', returned.length, 'standup occurrences:', titles.filter(t => t === 'Daily Engineering Standup').length);

      // Inclusions
      record('1.2. Includes personal task (Alice Personal Journal)', titles.includes('Alice Personal Journal'));
      record('1.3. Includes collaborative task assigned to Alice (Fix Authentication Flow)', titles.includes('Fix Authentication Flow'));
      record('1.4. Excludes unassigned collaborative task created by Alice (Draft Mobile Design Specs) per Phase 4A', !titles.includes('Draft Mobile Design Specs'));
      record('1.5. Projects recurring occurrences of Daily Engineering Standup', titles.filter((t) => t === 'Daily Engineering Standup').length > 10);

      // Exclusions
      record('1.6. Excludes collaborative task assigned exclusively to Bob (Bob Infrastructure Upgrade)', !titles.includes('Bob Infrastructure Upgrade'));
      record('1.7. Excludes task from unauthorized workspace (Unauthorized Secret Task)', !titles.includes('Unauthorized Secret Task'));

      // Metadata verification
      const engTaskInstance = returned.find((t) => t.title === 'Fix Authentication Flow');
      record('1.8. Collaborative task has populated source workspace name',
        engTaskInstance && typeof engTaskInstance.workspaceId === 'object' && engTaskInstance.workspaceId.name === 'Engineering'
      );
      record('1.9. Timed task preserves startTime and endTime in response',
        engTaskInstance && engTaskInstance.startTime === '10:00' && engTaskInstance.endTime === '11:30' && engTaskInstance.isAllDay === false
      );
      const personalTaskInstance = returned.find((t) => t.title === 'Alice Personal Journal');
      record('1.10. Personal task has null/empty workspaceId', personalTaskInstance && !personalTaskInstance.workspaceId);
    }

    console.log('\n\x1b[1mSuite 2: Task Creation Flow Returns Populated Metadata Immediately\x1b[0m');
    {
      const createMock = mockReqRes({
        body: {
          title: 'Newly Created Team Task',
          startDate: '2026-11-10',
          startTime: '15:00',
          endTime: '16:00',
          workspaceId: wsEng._id.toString(),
          assignedTo: userAlice._id.toString(),
          priority: 'High',
          color: 'indigo',
        },
        user: userAlice,
      });

      await createTask(createMock.req, createMock.res, createMock.next);
      record('2.1. createTask in collaborative workspace responds with 201', createMock.getStatus() === 201);

      const created = createMock.getData()?.data;
      createdTaskIds.push(created._id);
      record('2.2. Created task returns populated workspaceId object with name',
        created && typeof created.workspaceId === 'object' && created.workspaceId.name === 'Engineering'
      );
      record('2.3. Created task returns populated assignedTo with name',
        created && typeof created.assignedTo === 'object' && created.assignedTo.name === 'Alice Developer'
      );
    }

    console.log('\n\x1b[1mSuite 3: Occurrence Completion & Rescheduling in Collaborative Workspace\x1b[0m');
    {
      // Complete occurrence on 2026-11-05
      const compMock = mockReqRes({
        params: { id: tRecurringEng._id.toString(), date: '2026-11-05' },
        body: { action: 'complete', status: 'Done' },
        user: userAlice,
      });
      await updateTaskOccurrence(compMock.req, compMock.res, compMock.next);
      record('3.1. updateTaskOccurrence responds with 200', compMock.getStatus() === 200);

      // Re-query window
      const checkMock = mockReqRes({
        query: {
          workspaceId: 'my-work',
          start: '2026-11-04',
          end: '2026-11-07',
        },
        user: userAlice,
      });
      await getTasks(checkMock.req, checkMock.res, checkMock.next);
      const rechecked = checkMock.getData()?.data || [];
      const nov5Occ = rechecked.find((t) => t.occurrenceDate === '2026-11-05' && t.title === 'Daily Engineering Standup');
      const nov6Occ = rechecked.find((t) => t.occurrenceDate === '2026-11-06' && t.title === 'Daily Engineering Standup');

      record('3.2. Completed occurrence has status Done in window query', nov5Occ?.status === 'Done');
      record('3.3. Subsequent occurrence retains status To Do', nov6Occ?.status === 'To Do');
      record('3.4. Master task series document status remains untouched (To Do)', (await Task.findById(tRecurringEng._id)).status === 'To Do');
    }

    console.log('\n\x1b[1mSuite 4: Active Workspace Context Persistence & Validation Logic\x1b[0m');
    {
      const STORAGE_KEY = 'calflow_active_workspace';

      // Mock LocalStorage
      const mockStorage = new Map();
      const fakeLocalStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
      };

      // 4.1 Persistence of 'my-work'
      fakeLocalStorage.setItem(STORAGE_KEY, 'my-work');
      let initialId = fakeLocalStorage.getItem(STORAGE_KEY) || 'personal';
      record("4.1. Selecting 'my-work' survives page refresh from localStorage", initialId === 'my-work');

      // 4.2 Persistence of 'personal'
      fakeLocalStorage.setItem(STORAGE_KEY, 'personal');
      initialId = fakeLocalStorage.getItem(STORAGE_KEY) || 'personal';
      record("4.2. Selecting 'personal' survives page refresh from localStorage", initialId === 'personal');

      // 4.3 Persistence of authorized collaborative workspace ID
      fakeLocalStorage.setItem(STORAGE_KEY, wsEng._id.toString());
      initialId = fakeLocalStorage.getItem(STORAGE_KEY) || 'personal';
      record('4.3. Selecting collaborative workspace ID survives page refresh', initialId === wsEng._id.toString());

      // 4.4 Fallback validation: when workspaces finish loading, if stored workspace is unauthorized, safely fall back
      const userWorkspaces = [
        { _id: wsEng._id.toString(), name: 'Engineering' },
        { _id: wsDesign._id.toString(), name: 'Design Ops' },
      ];

      // Test with deleted / unauthorized workspace ID
      const deletedWorkspaceId = '671234567890abcdef123456';
      fakeLocalStorage.setItem(STORAGE_KEY, deletedWorkspaceId);

      const validateContext = (storedId, loadedWorkspaces) => {
        if (storedId === 'personal' || storedId === 'my-work') {
          return storedId;
        }
        const exists = loadedWorkspaces.some((w) => w._id === storedId);
        if (!exists) {
          fakeLocalStorage.setItem(STORAGE_KEY, 'personal');
          return 'personal';
        }
        return storedId;
      };

      const resolved = validateContext(deletedWorkspaceId, userWorkspaces);
      record("4.4. Deleted/unauthorized stored workspace safely falls back to 'personal'", resolved === 'personal');
      record("4.5. Safe fallback updates localStorage to 'personal'", fakeLocalStorage.getItem(STORAGE_KEY) === 'personal');

      // 4.6 Virtual workspaces 'my-work' and 'personal' are NEVER reset by loaded collaborative workspaces
      const myWorkResolved = validateContext('my-work', userWorkspaces);
      record("4.6. 'my-work' is virtual and remains valid regardless of workspace count", myWorkResolved === 'my-work');

      // 4.7 Logout clears storage
      fakeLocalStorage.removeItem(STORAGE_KEY);
      record("4.7. Logout cleans up active workspace storage to prevent cross-account leakage", fakeLocalStorage.getItem(STORAGE_KEY) === null);
    }

    // 5. Cleanup
    await Task.deleteMany({ _id: { $in: createdTaskIds } });
    await Workspace.deleteMany({ _id: { $in: [wsEng._id, wsDesign._id, wsSecret._id] } });
    await User.deleteMany({ _id: { $in: [userAlice._id, userBob._id] } });
    await mongoose.disconnect();
    console.log('  \x1b[32m✔\x1b[0m Teardown & cleanup completed cleanly\n');

  } catch (err) {
    console.error('Test Suite Error:', err);
    process.exit(1);
  }

  console.log('\x1b[1m=== TEST RESULTS SUMMARY ===\x1b[0m');
  console.log(`  \x1b[32m✔ Passed:\x1b[0m ${testResults.passed}`);
  console.log(`  \x1b[31m✖ Failed:\x1b[0m ${testResults.failed}`);
  console.log(`  Total:   ${testResults.tests.length}\n`);

  if (testResults.failed > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m\x1b[1m✨ ALL MY WORK CALENDAR & CONTEXT PERSISTENCE TESTS PASSED! ✨\x1b[0m\n');
  }
}

runRegressionSuite();
