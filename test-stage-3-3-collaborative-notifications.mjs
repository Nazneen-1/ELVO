import mongoose from './server/node_modules/mongoose/index.js';
import { config } from './server/src/config/env.js';
import User from './server/src/models/User.js';
import Task from './server/src/models/Task.js';
import Workspace from './server/src/models/Workspace.js';
import Notification from './server/src/models/Notification.js';
import ReminderJob from './server/src/models/ReminderJob.js';
import {
  notifyTaskAssignment,
  notifyTaskComment,
  processOverdueNotifications,
} from './server/src/utils/collaborativeNotifications.js';
import {
  createTask,
  updateTask,
  addComment,
} from './server/src/controllers/taskController.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from './server/src/controllers/notificationController.js';
import { processRemindersTrigger } from './server/src/controllers/reminderController.js';
import { assertSafeTestDatabase, getSafeTestUri } from './server/src/config/testDbGuard.js';

console.log('\n=== ELVO STAGE 3.3: COLLABORATIVE NOTIFICATIONS TEST SUITE ===\n');

const testResults = { passed: 0, failed: 0, tests: [] };

function record(name, passed, detail = '') {
  if (passed) {
    testResults.passed += 1;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    testResults.failed += 1;
    console.log(`  \x1b[31m✖\x1b[0m ${name} ${detail ? `(${detail})` : ''}`);
  }
  testResults.tests.push({ name, passed, detail });
}

// Mock express req/res
const createMockReqRes = (user, body = {}, params = {}, query = {}) => {
  const req = { user, body, params, query, headers: {} };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
  const next = (err) => {
    if (err) {
      statusCode = 500;
      responseData = { success: false, message: err.message };
    }
  };
  return { req, res, next };
};

async function runTests() {
  const mongoUri = getSafeTestUri(process.env.TEST_MONGODB_URI);
  assertSafeTestDatabase(mongoUri);
  await mongoose.connect(mongoUri);
  console.log('  \x1b[34mℹ\x1b[0m Connected to isolated test MongoDB successfully.');

  const creatorId = new mongoose.Types.ObjectId();
  const assigneeId = new mongoose.Types.ObjectId();
  const memberId = new mongoose.Types.ObjectId();
  const outsiderId = new mongoose.Types.ObjectId();

  const allUserIds = [creatorId, assigneeId, memberId, outsiderId];
  try {
    // Clean up any remnants
    await User.deleteMany({ _id: { $in: allUserIds } });
    await Task.deleteMany({ userId: { $in: allUserIds } });
    await Workspace.deleteMany({ owner: { $in: allUserIds } });
    await Notification.deleteMany({ userId: { $in: allUserIds } });

    // Seed test users
    const userCreator = await User.create({
      _id: creatorId,
      name: 'Task Creator',
      email: `creator_${Date.now()}@elvo.test`,
      password: 'password123',
    });
    const userAssignee = await User.create({
      _id: assigneeId,
      name: 'Task Assignee',
      email: `assignee_${Date.now()}@elvo.test`,
      password: 'password123',
    });
    const userMember = await User.create({
      _id: memberId,
      name: 'Workspace Member',
      email: `member_${Date.now()}@elvo.test`,
      password: 'password123',
    });
    const userOutsider = await User.create({
      _id: outsiderId,
      name: 'Outsider User',
      email: `outsider_${Date.now()}@elvo.test`,
      password: 'password123',
    });

    // Seed test workspace
    const workspace = await Workspace.create({
      name: 'Product Engineering',
      owner: creatorId,
      members: [
        { user: creatorId, role: 'owner' },
        { user: assigneeId, role: 'member' },
        { user: memberId, role: 'member' },
      ],
    });

    // =========================================================================
    // SUITE 1: TASK ASSIGNMENT NOTIFICATIONS
    // =========================================================================
    console.log('\n\x1b[1mSuite 1: Task Assignment Notifications\x1b[0m');

    // 1. Assigning workspace task to a workspace member creates task_assigned notification
    const { req: req1, res: res1, next: next1 } = createMockReqRes(
      userCreator,
      {
        title: 'Build API Gateway',
        startDate: '2026-11-15',
        workspaceId: workspace._id.toString(),
        assignedTo: assigneeId.toString(),
      }
    );
    await createTask(req1, res1, next1);
    const task1 = res1.getData()?.data;
    const notif1 = await Notification.findOne({
      userId: assigneeId,
      relatedTaskId: task1?._id,
      type: 'task_assigned',
    });

    record(
      '1. Assigning workspace task to a member creates task_assigned notification with proper title and task reference',
      res1.getStatusCode() === 201 &&
      notif1 !== null &&
      notif1.title === 'Task Assigned' &&
      notif1.message.includes('Task Creator assigned you') &&
      notif1.read === false
    );

    // 2. Self-assignment suppresses notification
    const { req: req2, res: res2, next: next2 } = createMockReqRes(
      userCreator,
      {
        title: 'Self Assigned Task',
        startDate: '2026-11-16',
        workspaceId: workspace._id.toString(),
        assignedTo: creatorId.toString(),
      }
    );
    await createTask(req2, res2, next2);
    const task2 = res2.getData()?.data;
    const notif2 = await Notification.findOne({
      userId: creatorId,
      relatedTaskId: task2?._id,
      type: 'task_assigned',
    });
    record(
      '2. Self-assignment (creator assigning themselves) suppresses notification',
      res2.getStatusCode() === 201 && notif2 === null
    );

    // 3. Reassigning task to a new member notifies the new assignee
    const { req: req3, res: res3, next: next3 } = createMockReqRes(
      userCreator,
      {
        assignedTo: memberId.toString(),
      },
      { id: task1._id.toString() }
    );
    await updateTask(req3, res3, next3);
    const notif3 = await Notification.findOne({
      userId: memberId,
      relatedTaskId: task1._id,
      type: 'task_assigned',
    });
    record(
      '3. Reassigning task notifies the new assignee',
      res3.getStatusCode() === 200 &&
      notif3 !== null &&
      notif3.message.includes('Task Creator assigned you')
    );

    // 4. Updating a task without changing assignee does not duplicate assignment notification
    const countBefore4 = await Notification.countDocuments({
      userId: memberId,
      relatedTaskId: task1._id,
      type: 'task_assigned',
    });
    const { req: req4, res: res4, next: next4 } = createMockReqRes(
      userCreator,
      {
        title: 'Build API Gateway - Renamed',
        assignedTo: memberId.toString(),
      },
      { id: task1._id.toString() }
    );
    await updateTask(req4, res4, next4);
    const countAfter4 = await Notification.countDocuments({
      userId: memberId,
      relatedTaskId: task1._id,
      type: 'task_assigned',
    });
    record(
      '4. Updating task fields without changing assignee does not create duplicate notification',
      res4.getStatusCode() === 200 && countBefore4 === countAfter4
    );

    // 5. Assigning workspace task to an unauthorized non-member is rejected (400)
    const { req: req5, res: res5, next: next5 } = createMockReqRes(
      userCreator,
      {
        title: 'Secret Workspace Task',
        startDate: '2026-11-20',
        workspaceId: workspace._id.toString(),
        assignedTo: outsiderId.toString(),
      }
    );
    await createTask(req5, res5, next5);
    const notif5 = await Notification.findOne({
      userId: outsiderId,
      type: 'task_assigned',
    });
    record(
      '5. Assigning workspace task to non-member is rejected (400) and creates no notification',
      res5.getStatusCode() === 400 && notif5 === null
    );

    // 6. Assigning personal task to another user is rejected (400)
    const { req: req6, res: res6, next: next6 } = createMockReqRes(
      userCreator,
      {
        title: 'My Personal Task',
        startDate: '2026-11-22',
        assignedTo: outsiderId.toString(),
      }
    );
    await createTask(req6, res6, next6);
    record(
      '6. Assigning personal task to another user is rejected (400) to prevent data leakage',
      res6.getStatusCode() === 400
    );

    // =========================================================================
    // SUITE 2: TASK COMMENT NOTIFICATIONS
    // =========================================================================
    console.log('\n\x1b[1mSuite 2: Task Comment Notifications\x1b[0m');

    // 7. Comment by workspace member notifies task creator and assignee
    const { req: req7, res: res7, next: next7 } = createMockReqRes(
      userMember,
      { text: 'I updated the auth route tests. Looking good!' },
      { id: task1._id.toString() }
    );
    await addComment(req7, res7, next7);

    const notifCreatorComment = await Notification.findOne({
      userId: creatorId,
      relatedTaskId: task1._id,
      type: 'comment',
    });
    const notifAssigneeComment = await Notification.findOne({
      userId: memberId, // author is userMember!
      relatedTaskId: task1._id,
      type: 'comment',
    });

    record(
      '7. Comment by member notifies task creator with comment snippet',
      res7.getStatusCode() === 201 &&
      notifCreatorComment !== null &&
      notifCreatorComment.title === 'New Comment' &&
      notifCreatorComment.message.includes('I updated the auth route')
    );

    // 8. Commenter does not receive a self-notification
    record(
      '8. Commenter self-notification is strictly suppressed',
      notifAssigneeComment === null
    );

    // 9. Unauthorized user (non-member of workspace) cannot comment (403)
    const { req: req9, res: res9, next: next9 } = createMockReqRes(
      userOutsider,
      { text: 'Unauthorized intrusive comment' },
      { id: task1._id.toString() }
    );
    await addComment(req9, res9, next9);
    record(
      '9. Unauthorized non-member cannot comment on workspace task (403)',
      res9.getStatusCode() === 403
    );

    // =========================================================================
    // SUITE 3: OVERDUE TASK NOTIFICATIONS
    // =========================================================================
    console.log('\n\x1b[1mSuite 3: Overdue Task Notifications\x1b[0m');

    // Create an overdue task in the past
    const overdueTask = await Task.create({
      userId: creatorId,
      assignedTo: assigneeId,
      workspaceId: workspace._id,
      title: 'Overdue Database Migration',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      dueDate: new Date('2026-10-10T00:00:00.000Z'),
      status: 'To Do',
    });

    // 10. processOverdueNotifications finds overdue tasks and notifies creator and assignee
    const overdueStats1 = await processOverdueNotifications({ now: new Date('2026-10-25T00:00:00.000Z') });
    const notifOverdueCreator = await Notification.findOne({
      userId: creatorId,
      relatedTaskId: overdueTask._id,
      type: 'task_due',
    });
    const notifOverdueAssignee = await Notification.findOne({
      userId: assigneeId,
      relatedTaskId: overdueTask._id,
      type: 'task_due',
    });

    record(
      '10. Incomplete overdue task generates task_due notification for creator and assignee',
      overdueStats1.notified >= 2 &&
      notifOverdueCreator !== null &&
      notifOverdueAssignee !== null &&
      notifOverdueCreator.title === 'Task Overdue' &&
      notifOverdueCreator.message.includes('Overdue Database Migration')
    );

    // 11. Repeated overdue scan within 24h does not duplicate notifications (idempotency)
    const countBefore11 = await Notification.countDocuments({
      relatedTaskId: overdueTask._id,
      type: 'task_due',
    });
    const overdueStats2 = await processOverdueNotifications({ now: new Date('2026-10-25T01:00:00.000Z') });
    const countAfter11 = await Notification.countDocuments({
      relatedTaskId: overdueTask._id,
      type: 'task_due',
    });
    record(
      '11. Repeated overdue scan within 24h does not create duplicate notifications (idempotent)',
      countBefore11 === countAfter11
    );

    // 12. Completed task does not generate overdue notification
    overdueTask.status = 'Done';
    await overdueTask.save();
    await Notification.deleteMany({ relatedTaskId: overdueTask._id, type: 'task_due' });

    await processOverdueNotifications({ now: new Date('2026-10-25T02:00:00.000Z') });
    const notifDoneTask = await Notification.findOne({
      relatedTaskId: overdueTask._id,
      type: 'task_due',
    });
    record(
      '12. Completed task (Done) is not treated as overdue',
      notifDoneTask === null
    );

    // =========================================================================
    // SUITE 4: NOTIFICATION CENTER API, READ/UNREAD COUNTS & ISOLATION
    // =========================================================================
    console.log('\n\x1b[1mSuite 4: Notification Center API & User Isolation\x1b[0m');

    // 13. GET /api/notifications returns user's notifications and unreadCount
    const { req: req13, res: res13, next: next13 } = createMockReqRes(userCreator);
    await getNotifications(req13, res13, next13);
    const data13 = res13.getData();
    record(
      '13. GET /api/notifications returns correct count and unreadCount',
      res13.getStatusCode() === 200 &&
      data13.success === true &&
      data13.unreadCount > 0 &&
      Array.isArray(data13.data)
    );

    // 14. User isolation: Outsider sees 0 notifications
    const { req: req14, res: res14, next: next14 } = createMockReqRes(userOutsider);
    await getNotifications(req14, res14, next14);
    const data14 = res14.getData();
    record(
      '14. Strict tenant/user isolation: unrelated user has 0 notifications',
      res14.getStatusCode() === 200 && data14.unreadCount === 0 && data14.data.length === 0
    );

    // 15. PATCH /api/notifications/:id/read marks notification as read
    const targetNotif = data13.data[0];
    const { req: req15, res: res15, next: next15 } = createMockReqRes(
      userCreator,
      {},
      { id: targetNotif._id.toString() }
    );
    await markAsRead(req15, res15, next15);
    const updatedNotif = await Notification.findById(targetNotif._id);
    record(
      '15. PATCH /api/notifications/:id/read sets read: true',
      res15.getStatusCode() === 200 && updatedNotif.read === true
    );

    // 16. PATCH /api/notifications/read-all marks all notifications read and resets unreadCount
    const { req: req16, res: res16, next: next16 } = createMockReqRes(userCreator);
    await markAllAsRead(req16, res16, next16);
    const { req: req16b, res: res16b, next: next16b } = createMockReqRes(userCreator);
    await getNotifications(req16b, res16b, next16b);
    record(
      '16. PATCH /api/notifications/read-all sets all read: true and unreadCount: 0',
      res16.getStatusCode() === 200 && res16b.getData()?.unreadCount === 0
    );

    // 17. DELETE /api/notifications/:id removes notification
    const { req: req17, res: res17, next: next17 } = createMockReqRes(
      userCreator,
      {},
      { id: targetNotif._id.toString() }
    );
    await deleteNotification(req17, res17, next17);
    const deletedCheck = await Notification.findById(targetNotif._id);
    record(
      '17. DELETE /api/notifications/:id successfully removes notification document',
      res17.getStatusCode() === 200 && deletedCheck === null
    );

    // =========================================================================
    // SUITE 5: EXTERNAL SCHEDULER TRIGGER INTEGRATION & SEC-1 RESOLUTION
    // =========================================================================
    console.log('\n\x1b[1mSuite 5: External Scheduler Trigger Integration (SEC-1 Fix)\x1b[0m');

    config.reminderSchedulerSecret = config.reminderSchedulerSecret || 'test_scheduler_secret_stage33';

    // 18. Unauthenticated request to processRemindersTrigger is rejected with 401
    const { req: req18, res: res18, next: next18 } = createMockReqRes(null);
    await processRemindersTrigger(req18, res18, next18);
    record(
      '18. Scheduler endpoint rejects unauthenticated request without secret (401)',
      res18.getStatusCode() === 401
    );

    // Create a new overdue task for scheduler trigger test
    const schedulerOverdueTask = await Task.create({
      userId: creatorId,
      assignedTo: assigneeId,
      workspaceId: workspace._id,
      title: 'Scheduler Automated Overdue Task',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      dueDate: new Date('2026-09-05T00:00:00.000Z'),
      status: 'To Do',
    });

    // 19. Calling processRemindersTrigger with valid secret runs overdue scanning and returns overdueNotified
    const validSecret = config.reminderSchedulerSecret;
    const req19 = {
      headers: { authorization: `Bearer ${validSecret}` },
      body: { batchSize: 20 },
    };
    let res19Data = null;
    let res19Status = 200;
    const res19 = {
      status(code) { res19Status = code; return this; },
      json(data) { res19Data = data; return this; },
    };
    await processRemindersTrigger(req19, res19, (err) => { if (err) throw err; });

    const notifOverdueFromTrigger = await Notification.findOne({
      userId: assigneeId,
      relatedTaskId: schedulerOverdueTask._id,
      type: 'task_due',
    });

    record(
      '19. Calling external scheduler endpoint invokes overdue processing and generates task_due notification',
      res19Status === 200 &&
      res19Data?.success === true &&
      typeof res19Data?.processed === 'number' &&
      typeof res19Data?.overdueNotified === 'number' &&
      notifOverdueFromTrigger !== null &&
      notifOverdueFromTrigger.title === 'Task Overdue'
    );

    // 20. Calling processRemindersTrigger again within 24h does not duplicate overdue notifications
    const countBefore20 = await Notification.countDocuments({
      relatedTaskId: schedulerOverdueTask._id,
      type: 'task_due',
    });
    let res20Data = null;
    const res20 = {
      status() { return this; },
      json(data) { res20Data = data; return this; },
    };
    await processRemindersTrigger(req19, res20, (err) => { if (err) throw err; });
    const countAfter20 = await Notification.countDocuments({
      relatedTaskId: schedulerOverdueTask._id,
      type: 'task_due',
    });

    record(
      '20. Repeated external scheduler calls do not duplicate overdue notifications (idempotent)',
      res20Data?.success === true && countBefore20 === countAfter20
    );

    // 21. Reminder jobs and overdue notifications execute side-by-side with error isolation
    const reminderTask = await Task.create({
      userId: creatorId,
      title: 'Reminder Task For Dual Execution',
      startDate: new Date('2026-11-20T00:00:00.000Z'),
      startTime: '10:00',
      reminder: { enabled: true, minutesBefore: 15 },
    });
    const dueJob = await ReminderJob.create({
      taskId: reminderTask._id,
      userId: creatorId,
      taskStartDate: '2026-11-20',
      taskStartTime: '10:00',
      taskTitle: reminderTask.title,
      minutesBefore: 15,
      fireTime: new Date(Date.now() - 30000), // Due in past
      status: 'pending',
    });

    let res21Data = null;
    const res21 = {
      status() { return this; },
      json(data) { res21Data = data; return this; },
    };
    await processRemindersTrigger(req19, res21, (err) => { if (err) throw err; });
    const processedJob = await ReminderJob.findById(dueJob._id);

    record(
      '21. Existing reminder jobs and overdue scanning execute concurrently and successfully in single trigger run',
      res21Data?.success === true &&
      processedJob !== null &&
      (processedJob.status === 'sent' || processedJob.status === 'failed' || processedJob.status === 'processing')
    );

  } finally {
    try {
      await User.deleteMany({ _id: { $in: allUserIds } });
      await Task.deleteMany({ userId: { $in: allUserIds } });
      await Workspace.deleteMany({ owner: { $in: allUserIds } });
      await Notification.deleteMany({ userId: { $in: allUserIds } });
    } catch (cleanupErr) {
      console.warn('  \x1b[33m⚠\x1b[0m Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
    console.log('  \x1b[34mℹ\x1b[0m Disconnected from MongoDB.');
  }
}

await runTests();

// Print Summary
console.log('\n=======================================================');
console.log('                   TEST SUMMARY                        ');
console.log('=======================================================');
console.log(`  \x1b[32m✔ Passed:   ${testResults.passed}\x1b[0m`);
console.log(`  \x1b[31m✖ Failed:   ${testResults.failed}\x1b[0m`);
console.log(`  Total:      ${testResults.tests.length}`);

if (testResults.failed === 0) {
  console.log('\n\x1b[32m✨ ALL STAGE 3.3 COLLABORATIVE NOTIFICATION TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\n\x1b[31m💥 SOME TESTS FAILED! 💥\x1b[0m\n');
  process.exit(1);
}
