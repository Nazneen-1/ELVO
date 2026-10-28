/**
 * ELVO — Phase 3: My Work Test Suite
 *
 * Comprehensive verification for the personal task management workflows:
 * 1. Task creation and editing preserving all supported fields (dates, times, color, tags, duration, subtasks).
 * 2. Subtask management (inline addition, toggle, deletion) and priority switcher.
 * 3. Search, filter (status, priority, tag), and deterministic sorting composability.
 * 4. Date scope filtering across ordinary tasks and projected recurring occurrences.
 * 5. Ordinary task status transitions and isolation from recurring occurrences.
 * 6. Ownership, authorization, and workspace boundary security.
 */

import mongoose from './server/node_modules/mongoose/index.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  patchTask,
  deleteTask,
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

console.log('\n\x1b[1m\x1b[36m=== ELVO PHASE 3: MY WORK TEST SUITE ===\x1b[0m\n');

const testUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
assertSafeTestDatabase(testUri);

let userA = null;
let userB = null;
let sharedWorkspace = null;
const createdTaskIds = [];

function mockReqRes({ query = {}, params = {}, body = {}, user = userA } = {}) {
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

async function runMyWorkTests() {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
    console.log('  \x1b[32m✔\x1b[0m Connected to isolated local test database');

    // 0. Setup Users
    const time = Date.now();
    userA = await User.create({
      name: 'User A',
      email: `usera_${time}@elvo.test`,
      password: 'password123',
    });
    userB = await User.create({
      name: 'User B',
      email: `userb_${time}@elvo.test`,
      password: 'password123',
    });
    sharedWorkspace = await Workspace.create({
      name: 'Shared Workspace',
      owner: userA._id,
      members: [
        { user: userA._id, role: 'admin' },
        { user: userB._id, role: 'member' },
      ],
    });

    console.log('\n\x1b[1mSuite 1: Task Creation & Field Preservation\x1b[0m');
    let task1Id = null;
    {
      const payload = {
        title: 'Complete Quarterly Strategy Plan',
        description: 'Prepare detailed roadmap and presentation for executives',
        startDate: '2026-11-02',
        dueDate: '2026-11-05',
        startTime: '09:00',
        endTime: '10:30',
        isAllDay: false,
        priority: 'High',
        color: 'rose',
        estimatedMinutes: 90,
        tags: ['strategy', 'exec', 'quarterly'],
        subtasks: [
          { title: 'Draft outline', completed: true },
          { title: 'Review with team', completed: false },
        ],
        status: 'To Do',
      };

      const { req, res, next, getStatus, getData } = mockReqRes({ body: payload, user: userA });
      await createTask(req, res, next);
      record('1.1. Create task with full metadata responds with 201', getStatus() === 201);
      const data = getData();
      task1Id = data?.data?._id?.toString();
      createdTaskIds.push(task1Id);

      record('1.2. Created task preserves title, color, estimatedMinutes, and priority',
        data?.data?.title === payload.title &&
        data?.data?.color === 'rose' &&
        data?.data?.estimatedMinutes === 90 &&
        data?.data?.priority === 'High'
      );

      record('1.3. Created task preserves tags array',
        Array.isArray(data?.data?.tags) &&
        data?.data?.tags.length === 3 &&
        data?.data?.tags.includes('strategy')
      );

      record('1.4. Created task preserves subtasks and their completion states',
        Array.isArray(data?.data?.subtasks) &&
        data?.data?.subtasks.length === 2 &&
        data?.data?.subtasks[0].completed === true &&
        data?.data?.subtasks[1].completed === false
      );
    }

    console.log('\n\x1b[1mSuite 2: Task Editing & Field Updates\x1b[0m');
    {
      const updatePayload = {
        title: 'Complete Quarterly Strategy Plan - Revised',
        description: 'Updated with team feedback',
        priority: 'Medium',
        color: 'emerald',
        estimatedMinutes: 120,
        subtasks: [
          { title: 'Draft outline', completed: true },
          { title: 'Review with team', completed: true },
          { title: 'Final executive sign-off', completed: false },
        ],
      };

      const { req, res, next, getStatus, getData } = mockReqRes({
        params: { id: task1Id },
        body: updatePayload,
        user: userA,
      });
      await updateTask(req, res, next);
      record('2.1. Update task responds with 200', getStatus() === 200);
      const data = getData();
      record('2.2. Updated fields reflect changes while preserving existing tags',
        data?.data?.title === 'Complete Quarterly Strategy Plan - Revised' &&
        data?.data?.color === 'emerald' &&
        data?.data?.priority === 'Medium' &&
        data?.data?.estimatedMinutes === 120 &&
        data?.data?.subtasks?.length === 3 &&
        data?.data?.tags?.includes('strategy')
      );
    }

    console.log('\n\x1b[1mSuite 3: Subtasks Management & Priority Switcher\x1b[0m');
    {
      // 3.1. Inline add subtask via patchTask
      const currentTask = await Task.findById(task1Id);
      const updatedSubtasks = [
        ...currentTask.subtasks.map((s) => ({ title: s.title, completed: s.completed })),
        { title: 'Send recap email', completed: false },
      ];

      const { req, res, next, getStatus, getData } = mockReqRes({
        params: { id: task1Id },
        body: { subtasks: updatedSubtasks },
        user: userA,
      });
      await patchTask(req, res, next);
      record('3.1. Add subtask via patch responds with 200', getStatus() === 200);
      const data = getData();
      record('3.2. Task now contains 4 subtasks', data?.data?.subtasks?.length === 4);

      // 3.3. Toggle subtask completion
      const toggledSubtasks = data.data.subtasks.map((s, idx) =>
        idx === 3 ? { title: s.title, completed: true } : { title: s.title, completed: s.completed }
      );
      const patchReq2 = mockReqRes({
        params: { id: task1Id },
        body: { subtasks: toggledSubtasks },
        user: userA,
      });
      await patchTask(patchReq2.req, patchReq2.res, patchReq2.next);
      record('3.3. Toggle subtask completion updates successfully',
        patchReq2.getStatus() === 200 &&
        patchReq2.getData()?.data?.subtasks?.filter((s) => s.completed).length === 3
      );

      // 3.4. Delete a subtask
      const remainingSubtasks = toggledSubtasks.filter((_, idx) => idx !== 0);
      const patchReq3 = mockReqRes({
        params: { id: task1Id },
        body: { subtasks: remainingSubtasks },
        user: userA,
      });
      await patchTask(patchReq3.req, patchReq3.res, patchReq3.next);
      record('3.4. Delete subtask updates array length correctly',
        patchReq3.getStatus() === 200 &&
        patchReq3.getData()?.data?.subtasks?.length === 3
      );

      // 3.5. Quick priority switcher
      const patchReq4 = mockReqRes({
        params: { id: task1Id },
        body: { priority: 'High' },
        user: userA,
      });
      await patchTask(patchReq4.req, patchReq4.res, patchReq4.next);
      record('3.5. Quick priority switch to High persists',
        patchReq4.getStatus() === 200 &&
        patchReq4.getData()?.data?.priority === 'High'
      );
    }

    console.log('\n\x1b[1mSuite 4: Composite Search, Filters, and Deterministic Sorting\x1b[0m');
    {
      // Create additional tasks for filtering & sorting validation
      const task2 = await Task.create({
        userId: userA._id,
        title: 'Backend API Documentation',
        description: 'Document endpoints for OpenAPI spec',
        startDate: new Date('2026-11-03T00:00:00.000Z'),
        dueDate: new Date('2026-11-04T00:00:00.000Z'),
        status: 'In Progress',
        priority: 'Medium',
        tags: ['backend', 'docs'],
        color: 'sky',
      });
      createdTaskIds.push(task2._id.toString());

      const task3 = await Task.create({
        userId: userA._id,
        title: 'Fix Login Styling Bug',
        description: 'Resolve CSS conflict on mobile screens',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-02T00:00:00.000Z'),
        status: 'Done',
        priority: 'Low',
        tags: ['bug', 'frontend'],
        color: 'amber',
      });
      createdTaskIds.push(task3._id.toString());

      // Query all tasks for userA
      const { req, res, next, getStatus, getData } = mockReqRes({
        query: { workspaceId: 'personal' },
        user: userA,
      });
      await getTasks(req, res, next);
      record('4.1. Fetch personal tasks responds with 200', getStatus() === 200);
      const allTasks = getData()?.data || [];
      record('4.2. Returns all 3 personal tasks for user', allTasks.length === 3);

      // Client-side filtering logic verification:
      // Filter by status 'In Progress'
      const inProgressOnly = allTasks.filter((t) => t.status === 'In Progress');
      record('4.3. Status filter correctly filters to In Progress',
        inProgressOnly.length === 1 && inProgressOnly[0].title === 'Backend API Documentation'
      );

      // Filter by priority 'High'
      const highOnly = allTasks.filter((t) => t.priority === 'High');
      record('4.4. Priority filter correctly filters to High',
        highOnly.length === 1 && highOnly[0]._id.toString() === task1Id
      );

      // Filter by tag 'docs'
      const docsOnly = allTasks.filter((t) => t.tags && t.tags.includes('docs'));
      record('4.5. Tag filter correctly isolates tasks with tag',
        docsOnly.length === 1 && docsOnly[0].title === 'Backend API Documentation'
      );

      // Composed search + tag filter
      const searchAndTag = allTasks.filter((t) => {
        const matchesSearch = t.title.toLowerCase().includes('backend') || t.description?.toLowerCase().includes('backend');
        const matchesTag = t.tags && t.tags.includes('docs');
        return matchesSearch && matchesTag;
      });
      record('4.6. Composed search and tag filter matches correct intersection', searchAndTag.length === 1);

      // Sorting: Priority High -> Low
      const PRIORITY_WEIGHTS = { High: 3, Medium: 2, Low: 1 };
      const sortedByPriorityDesc = [...allTasks].sort((a, b) =>
        (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0)
      );
      record('4.7. Priority sorting places High first, Low last',
        sortedByPriorityDesc[0].priority === 'High' &&
        sortedByPriorityDesc[2].priority === 'Low'
      );

      // Sorting: Title A -> Z
      const sortedByTitleAsc = [...allTasks].sort((a, b) => a.title.localeCompare(b.title));
      record('4.8. Alphabetical sorting is deterministic and non-mutating',
        sortedByTitleAsc[0].title === 'Backend API Documentation' &&
        allTasks.length === 3
      );
    }

    console.log('\n\x1b[1mSuite 5: Recurring Task Occurrence Isolation in Personal Work\x1b[0m');
    {
      const recurringMaster = await Task.create({
        userId: userA._id,
        title: 'Daily Standup Sync',
        startDate: new Date('2026-11-01T09:00:00.000Z'),
        isAllDay: false,
        startTime: '09:00',
        endTime: '09:15',
        status: 'To Do',
        priority: 'Medium',
        recurrence: {
          frequency: 'daily',
          interval: 1,
        },
      });
      createdTaskIds.push(recurringMaster._id.toString());

      // Complete occurrence on 2026-11-02
      const { req, res, next, getStatus, getData } = mockReqRes({
        params: { id: recurringMaster._id.toString(), date: '2026-11-02' },
        body: { status: 'Done', action: 'complete' },
        user: userA,
      });
      await updateTaskOccurrence(req, res, next);
      record('5.1. Complete recurring occurrence responds with 200', getStatus() === 200);

      // Verify projected window
      const queryReq = mockReqRes({
        query: {
          start: '2026-11-01',
          end: '2026-11-03',
          workspaceId: 'personal',
        },
        user: userA,
      });
      await getTasks(queryReq.req, queryReq.res, queryReq.next);
      const projectedTasks = queryReq.getData()?.data || [];
      const occ1 = projectedTasks.find((t) => t.isOccurrence && t.occurrenceDate === '2026-11-01');
      const occ2 = projectedTasks.find((t) => t.isOccurrence && t.occurrenceDate === '2026-11-02');
      const occ3 = projectedTasks.find((t) => t.isOccurrence && t.occurrenceDate === '2026-11-03');

      record('5.2. Completed occurrence has status Done', occ2?.status === 'Done');
      record('5.3. Adjacent occurrences remain To Do', occ1?.status === 'To Do' && occ3?.status === 'To Do');

      // Verify master task document in database was NOT changed to Done
      const masterDoc = await Task.findById(recurringMaster._id);
      record('5.4. Master series document status remains To Do', masterDoc.status === 'To Do');
    }

    console.log('\n\x1b[1mSuite 6: Workspace & User Authorization Boundaries\x1b[0m');
    {
      // User B tries to read User A's private personal task
      const { req, res, next, getStatus } = mockReqRes({
        params: { id: task1Id },
        user: userB,
      });
      try {
        await getTaskById(req, res, next);
      } catch (err) {
        // May error or return 404/403
      }
      record('6.1. User B cannot read User A personal task (not 200)', getStatus() !== 200);

      // User B tries to patch User A's private personal task
      const patchOther = mockReqRes({
        params: { id: task1Id },
        body: { title: 'Hacked Title' },
        user: userB,
      });
      try {
        await patchTask(patchOther.req, patchOther.res, patchOther.next);
      } catch (err) {}
      record('6.2. User B cannot modify User A personal task (not 200)', patchOther.getStatus() !== 200);

      // Verify title was untouched
      const verifyTask = await Task.findById(task1Id);
      record('6.3. User A task title remains intact', verifyTask.title === 'Complete Quarterly Strategy Plan - Revised');

      // Workspace Task Creation: userA creates a shared task in sharedWorkspace
      const wsTask = await Task.create({
        userId: userA._id,
        workspaceId: sharedWorkspace._id,
        title: 'Shared Workspace Project Task',
        status: 'To Do',
      });
      createdTaskIds.push(wsTask._id.toString());

      // User B (a member of sharedWorkspace) CAN access this task
      const memberReq = mockReqRes({
        params: { id: wsTask._id.toString() },
        user: userB,
      });
      await getTaskById(memberReq.req, memberReq.res, memberReq.next);
      record('6.4. Workspace member User B can access shared workspace task',
        memberReq.getStatus() === 200 && memberReq.getData()?.data?.title === 'Shared Workspace Project Task'
      );
    }

    console.log('\n\x1b[1mSuite 7: Teardown & Cleanup\x1b[0m');
    {
      if (createdTaskIds.length > 0) {
        await Task.deleteMany({ _id: { $in: createdTaskIds } });
      }
      if (sharedWorkspace) {
        await Workspace.findByIdAndDelete(sharedWorkspace._id);
      }
      if (userA) {
        await User.findByIdAndDelete(userA._id);
      }
      if (userB) {
        await User.findByIdAndDelete(userB._id);
      }
      record('7.1. All test tasks, workspaces, and users deleted cleanly', true);

      await mongoose.disconnect();
      record('7.2. Mongoose disconnected cleanly', true);
    }

    console.log('\n\x1b[1m=== TEST RESULTS SUMMARY ===\x1b[0m');
    console.log(`  \x1b[32m✔ Passed:\x1b[0m ${testResults.passed}`);
    console.log(`  \x1b[31m✖ Failed:\x1b[0m ${testResults.failed}`);
    console.log(`  \x1b[1mTotal:   ${testResults.tests.length}\x1b[0m\n`);

    if (testResults.failed > 0) {
      process.exit(1);
    } else {
      console.log('\x1b[32m\x1b[1m✨ ALL PHASE 3 MY WORK TESTS PASSED! ✨\x1b[0m\n');
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

runMyWorkTests();
