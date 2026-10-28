/**
 * ELVO — My Work as an Aggregated Workspace Test Suite
 *
 * Verifies:
 * 1. My Work context and query aggregation logic.
 * 2. Inclusion of personal tasks and collaborative tasks assigned to current user.
 * 3. Exclusion of tasks assigned exclusively to other users.
 * 4. Exclusion of tasks from unauthorized workspaces.
 * 5. Source workspace filtering within My Work.
 * 6. Recurring task occurrence projection, completion, and isolation under My Work.
 * 7. Populated source workspace metadata on returned tasks.
 */

import mongoose from './server/node_modules/mongoose/index.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import {
  getTasks,
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

console.log('\n\x1b[1m\x1b[36m=== ELVO: MY WORK AGGREGATED WORKSPACE TEST SUITE ===\x1b[0m\n');

const testUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
assertSafeTestDatabase(testUri);

let userAlice = null;
let userBob = null;
let workspaceEng = null;
let workspaceDesign = null;
let workspaceSecret = null;
const createdTaskIds = [];

function mockReqRes({ query = {}, params = {}, body = {}, user = userAlice } = {}) {
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

async function runMyWorkAggregationTests() {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    console.log('  \x1b[32m✔\x1b[0m Connected to isolated local test database');

    const timestamp = Date.now();

    // 1. Create Users
    userAlice = await User.create({
      name: 'Alice Developer',
      email: `alice_${timestamp}@elvo.test`,
      password: 'password123',
    });
    userBob = await User.create({
      name: 'Bob Designer',
      email: `bob_${timestamp}@elvo.test`,
      password: 'password123',
    });

    // 2. Create Workspaces
    // Workspace 1: Engineering (Alice is owner, Bob is member)
    workspaceEng = await Workspace.create({
      name: 'Engineering',
      owner: userAlice._id,
      members: [
        { user: userAlice._id, role: 'owner' },
        { user: userBob._id, role: 'member' },
      ],
      color: 'indigo',
    });

    // Workspace 2: Design (Bob is owner, Alice is member)
    workspaceDesign = await Workspace.create({
      name: 'Design',
      owner: userBob._id,
      members: [
        { user: userBob._id, role: 'owner' },
        { user: userAlice._id, role: 'member' },
      ],
      color: 'purple',
    });

    // Workspace 3: Secret Admin (Bob is owner, Alice is NOT a member)
    workspaceSecret = await Workspace.create({
      name: 'Secret Admin',
      owner: userBob._id,
      members: [{ user: userBob._id, role: 'owner' }],
      color: 'rose',
    });

    // 3. Create Seed Tasks
    // Task 1: Alice's Personal Task
    const alicePersonal = await Task.create({
      userId: userAlice._id,
      workspaceId: null,
      title: "Alice's Solo Journal",
      startDate: new Date('2026-11-02T10:00:00.000Z'),
      status: 'To Do',
      priority: 'Low',
    });
    createdTaskIds.push(alicePersonal._id);

    // Task 2: Engineering Workspace Task assigned to Alice
    const engAliceTask = await Task.create({
      userId: userAlice._id,
      workspaceId: workspaceEng._id,
      assignedTo: userAlice._id,
      title: 'Implement API Auth Service',
      startDate: new Date('2026-11-02T14:00:00.000Z'),
      status: 'In Progress',
      priority: 'High',
    });
    createdTaskIds.push(engAliceTask._id);

    // Task 3: Design Workspace Task assigned to Alice (created by Bob)
    const designAliceTask = await Task.create({
      userId: userBob._id,
      workspaceId: workspaceDesign._id,
      assignedTo: userAlice._id,
      title: 'Review Mobile UI Wireframes',
      startDate: new Date('2026-11-03T11:00:00.000Z'),
      status: 'To Do',
      priority: 'Medium',
    });
    createdTaskIds.push(designAliceTask._id);

    // Task 4: Engineering Workspace Task assigned exclusively to Bob (created by Alice)
    const engBobTask = await Task.create({
      userId: userAlice._id,
      workspaceId: workspaceEng._id,
      assignedTo: userBob._id,
      title: 'Bob System Architecture Review',
      startDate: new Date('2026-11-02T16:00:00.000Z'),
      status: 'To Do',
      priority: 'High',
    });
    createdTaskIds.push(engBobTask._id);

    // Task 5: Secret Workspace Task (Alice is not a member)
    const secretTask = await Task.create({
      userId: userBob._id,
      workspaceId: workspaceSecret._id,
      assignedTo: userAlice._id, // Even if assignedTo was set, Alice has no access to workspace
      title: 'Secret Unviewable Project',
      startDate: new Date('2026-11-02T12:00:00.000Z'),
      status: 'To Do',
      priority: 'High',
    });
    createdTaskIds.push(secretTask._id);

    console.log('\n\x1b[1mSuite 1: My Work Context Task Inclusion & Exclusion Rules\x1b[0m');
    {
      const { req, res, next, getStatus, getData } = mockReqRes({
        query: { workspaceId: 'my-work' },
        user: userAlice,
      });
      await getTasks(req, res, next);
      record('1.1. Query with workspaceId=my-work responds with 200', getStatus() === 200);

      const tasks = getData()?.data || [];
      const titles = tasks.map((t) => t.title);

      // Inclusions
      record('1.2. Includes Alice personal task', titles.includes("Alice's Solo Journal"));
      record('1.3. Includes Engineering workspace task assigned to Alice', titles.includes('Implement API Auth Service'));
      record('1.4. Includes Design workspace task assigned to Alice', titles.includes('Review Mobile UI Wireframes'));

      // Exclusions
      record('1.5. Excludes Engineering task assigned exclusively to Bob', !titles.includes('Bob System Architecture Review'));
      record('1.6. Excludes task from unauthorized Secret workspace', !titles.includes('Secret Unviewable Project'));
      record('1.7. Total aggregated tasks for Alice is exactly 3', tasks.length === 3);
    }

    console.log('\n\x1b[1mSuite 2: Source Workspace Metadata Population\x1b[0m');
    {
      const { req, res, next, getData } = mockReqRes({
        query: { workspaceId: 'my-work' },
        user: userAlice,
      });
      await getTasks(req, res, next);
      const tasks = getData()?.data || [];

      const personalItem = tasks.find((t) => t.title === "Alice's Solo Journal");
      record('2.1. Personal task has null/empty workspaceId', !personalItem.workspaceId);

      const engItem = tasks.find((t) => t.title === 'Implement API Auth Service');
      record('2.2. Engineering task carries populated workspaceId with name and color',
        typeof engItem.workspaceId === 'object' &&
        engItem.workspaceId.name === 'Engineering' &&
        engItem.workspaceId.color === 'indigo'
      );

      const designItem = tasks.find((t) => t.title === 'Review Mobile UI Wireframes');
      record('2.3. Design task carries populated workspaceId with name and color',
        typeof designItem.workspaceId === 'object' &&
        designItem.workspaceId.name === 'Design' &&
        designItem.workspaceId.color === 'purple'
      );
    }

    console.log('\n\x1b[1mSuite 3: Source Workspace Filtering within My Work\x1b[0m');
    {
      // 3.1 Source filter: Personal only
      const personalFilterMock = mockReqRes({
        query: { workspaceId: 'my-work', sourceWorkspaceId: 'personal' },
        user: userAlice,
      });
      await getTasks(personalFilterMock.req, personalFilterMock.res, personalFilterMock.next);
      const personalOnly = personalFilterMock.getData()?.data || [];
      record('3.1. sourceWorkspaceId=personal returns only personal tasks (length 1)',
        personalOnly.length === 1 && personalOnly[0].title === "Alice's Solo Journal"
      );

      // 3.2 Source filter: Engineering workspace only
      const engFilterMock = mockReqRes({
        query: { workspaceId: 'my-work', sourceWorkspaceId: workspaceEng._id.toString() },
        user: userAlice,
      });
      await getTasks(engFilterMock.req, engFilterMock.res, engFilterMock.next);
      const engOnly = engFilterMock.getData()?.data || [];
      record('3.2. sourceWorkspaceId=<engId> returns only Engineering tasks (length 1)',
        engOnly.length === 1 && engOnly[0].title === 'Implement API Auth Service'
      );

      // 3.3 Source filter: Unauthorized workspace returns 403
      const unauthorizedFilterMock = mockReqRes({
        query: { workspaceId: 'my-work', sourceWorkspaceId: workspaceSecret._id.toString() },
        user: userAlice,
      });
      await getTasks(unauthorizedFilterMock.req, unauthorizedFilterMock.res, unauthorizedFilterMock.next);
      record('3.3. Querying unauthorized source workspace in My Work returns 403',
        unauthorizedFilterMock.getStatus() === 403
      );
    }

    console.log('\n\x1b[1mSuite 4: Recurring Occurrences Aggregation in Calendar Date Windows\x1b[0m');
    {
      // Create a recurring task assigned to Alice in Engineering workspace
      const recurringWsTask = await Task.create({
        userId: userAlice._id,
        workspaceId: workspaceEng._id,
        assignedTo: userAlice._id,
        title: 'Daily Eng Standup',
        startDate: new Date('2026-11-01T09:00:00.000Z'),
        isAllDay: false,
        startTime: '09:00',
        endTime: '09:15',
        status: 'To Do',
        recurrence: { frequency: 'daily', interval: 1 },
      });
      createdTaskIds.push(recurringWsTask._id);

      // Query My Work for 3-day window: 2026-11-01 to 2026-11-03
      const windowMock = mockReqRes({
        query: {
          workspaceId: 'my-work',
          start: '2026-11-01',
          end: '2026-11-03',
        },
        user: userAlice,
      });
      await getTasks(windowMock.req, windowMock.res, windowMock.next);
      record('4.1. Window query under workspaceId=my-work returns 200', windowMock.getStatus() === 200);

      const windowTasks = windowMock.getData()?.data || [];
      const standupOccurrences = windowTasks.filter((t) => t.title === 'Daily Eng Standup');
      record('4.2. Projects exactly 3 standup occurrences within 3-day window', standupOccurrences.length === 3);

      record('4.3. Every projected occurrence carries unique occurrenceId and populated workspaceId',
        standupOccurrences.every(
          (occ) =>
            occ.isOccurrence &&
            occ.occurrenceId &&
            typeof occ.workspaceId === 'object' &&
            occ.workspaceId.name === 'Engineering'
        )
      );

      // Complete occurrence on 2026-11-02
      const completeMock = mockReqRes({
        params: { id: recurringWsTask._id.toString(), date: '2026-11-02' },
        body: { action: 'complete', status: 'Done' },
        user: userAlice,
      });
      await updateTaskOccurrence(completeMock.req, completeMock.res, completeMock.next);
      record('4.4. Complete occurrence in aggregated workspace task responds with 200', completeMock.getStatus() === 200);

      // Re-query window
      const recheckMock = mockReqRes({
        query: {
          workspaceId: 'my-work',
          start: '2026-11-01',
          end: '2026-11-03',
        },
        user: userAlice,
      });
      await getTasks(recheckMock.req, recheckMock.res, recheckMock.next);
      const recheckTasks = recheckMock.getData()?.data || [];
      const occNov1 = recheckTasks.find((t) => t.occurrenceDate === '2026-11-01' && t.title === 'Daily Eng Standup');
      const occNov2 = recheckTasks.find((t) => t.occurrenceDate === '2026-11-02' && t.title === 'Daily Eng Standup');
      const occNov3 = recheckTasks.find((t) => t.occurrenceDate === '2026-11-03' && t.title === 'Daily Eng Standup');

      record('4.5. Nov 2 occurrence status is Done', occNov2?.status === 'Done');
      record('4.6. Nov 1 and Nov 3 occurrences remain To Do', occNov1?.status === 'To Do' && occNov3?.status === 'To Do');

      // Check master series status was NOT altered
      const masterCheck = await Task.findById(recurringWsTask._id);
      record('4.7. Master task series document status remains To Do', masterCheck.status === 'To Do');
    }

    console.log('\n\x1b[1mSuite 5: Teardown & Test Cleanup\x1b[0m');
    {
      if (createdTaskIds.length > 0) {
        await Task.deleteMany({ _id: { $in: createdTaskIds } });
      }
      if (workspaceEng) await Workspace.findByIdAndDelete(workspaceEng._id);
      if (workspaceDesign) await Workspace.findByIdAndDelete(workspaceDesign._id);
      if (workspaceSecret) await Workspace.findByIdAndDelete(workspaceSecret._id);
      if (userAlice) await User.findByIdAndDelete(userAlice._id);
      if (userBob) await User.findByIdAndDelete(userBob._id);

      record('5.1. All test users, workspaces, and tasks cleaned up', true);

      await mongoose.disconnect();
      record('5.2. Mongoose disconnected cleanly', true);
    }

    console.log('\n\x1b[1m=== TEST RESULTS SUMMARY ===\x1b[0m');
    console.log(`  \x1b[32m✔ Passed:\x1b[0m ${testResults.passed}`);
    console.log(`  \x1b[31m✖ Failed:\x1b[0m ${testResults.failed}`);
    console.log(`  \x1b[1mTotal:   ${testResults.tests.length}\x1b[0m\n`);

    if (testResults.failed > 0) {
      process.exit(1);
    } else {
      console.log('\x1b[32m\x1b[1m✨ ALL MY WORK AGGREGATION TESTS PASSED! ✨\x1b[0m\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('Test suite error:', err);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

runMyWorkAggregationTests();
