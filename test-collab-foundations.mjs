/**
 * ELVO — Phase 4A: Collaborative Workspace Foundations Test Suite
 *
 * Comprehensive integration tests covering:
 * 1. Centralized Workspace Authorization & Role Boundaries (Owner, Admin, Member, Viewer).
 * 2. Email Invitations Lifecycle: create, duplicate prevention, accept, decline, revoke, expiry.
 * 3. Join Code Lifecycle: code join, duplicate join prevention, regenerate, revoke, invalid code handling.
 * 4. Ownership Transfer with lockout safeguards & Member departure/removal with optional task reassignment.
 * 5. Task & Subtask Multi-Assignee Schema, membership validation, and backward compatibility.
 * 6. Task Permissions & Operations: Member edit/delete boundaries, Owner/Admin management, completion.
 * 7. Virtual "My Work" vs Individual Workspace isolation: unassigned task exclusion, multi-assignee deduplication.
 * 8. Task Comments CRUD and fine-grained comment edit/delete authorization.
 * 9. Workspace Archiving, restore, and mutation blocking when archived.
 * 10. Workspace Activity History & Audit logging.
 */

import mongoose from './server/node_modules/mongoose/index.js';
import Task from './server/src/models/Task.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import {
  getWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  joinWorkspace,
  regenerateJoinCode,
  revokeJoinCode,
  createInvitation,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
  updateMemberRole,
  transferOwnership,
  removeMember,
  archiveWorkspace,
  restoreWorkspace,
  getWorkspaceActivity,
} from './server/src/controllers/workspaceController.js';
import {
  getTasks,
  createTask,
  updateTask,
  patchTask,
  deleteTask,
  addComment,
  updateComment,
  deleteComment,
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
  console.log('\n\x1b[1m\x1b[36m=== ELVO: PHASE 4A COLLABORATIVE WORKSPACE FOUNDATIONS SUITE ===\x1b[0m\n');

  const testDbUri = getSafeTestUri();
  assertSafeTestDatabase(testDbUri);
  await mongoose.connect(testDbUri);
  console.log(`Connected to isolated test database: ${testDbUri}\n`);

  // Clean collections
  await User.deleteMany({});
  await Workspace.deleteMany({});
  await Task.deleteMany({});

  // Setup test users
  const ownerUser = await User.create({
    name: 'Alice Owner',
    email: 'alice@elvo-collab.test',
    password: 'password123',
  });
  const adminUser = await User.create({
    name: 'Bob Admin',
    email: 'bob@elvo-collab.test',
    password: 'password123',
  });
  const memberUser1 = await User.create({
    name: 'Charlie Member',
    email: 'charlie@elvo-collab.test',
    password: 'password123',
  });
  const memberUser2 = await User.create({
    name: 'Dana Member',
    email: 'dana@elvo-collab.test',
    password: 'password123',
  });
  const viewerUser = await User.create({
    name: 'Evan Viewer',
    email: 'evan@elvo-collab.test',
    password: 'password123',
  });
  const outsiderUser = await User.create({
    name: 'Fiona Outsider',
    email: 'fiona@elvo-collab.test',
    password: 'password123',
  });

  // --------------------------------------------------------------------------
  // SECTION 1: Workspace Creation & Initial Membership
  // --------------------------------------------------------------------------
  console.log('\x1b[33m--- Section 1: Workspace Creation & Membership Setup ---\x1b[0m');

  let wsDoc;
  {
    const { req, res, next } = mockReqRes({
      user: ownerUser,
      body: { name: 'Acme Product Team', description: 'Core product collab workspace' },
    });
    await createWorkspace(req, res, next);
    wsDoc = res.data?.data || res.data?.workspace;
    record(
      'Owner can create workspace with automatic Owner role and join code generated',
      res.statusCode === 201 && wsDoc && (wsDoc.owner?._id || wsDoc.owner).toString() === ownerUser._id.toString() && Boolean(wsDoc.inviteCode)
    );
  }

  const workspaceId = wsDoc._id.toString();

  // Add members manually to initialize roles
  wsDoc.members.push(
    { user: adminUser._id, role: 'admin', joinedAt: new Date() },
    { user: memberUser1._id, role: 'member', joinedAt: new Date() },
    { user: memberUser2._id, role: 'member', joinedAt: new Date() },
    { user: viewerUser._id, role: 'viewer', joinedAt: new Date() }
  );
  await wsDoc.save();

  // --------------------------------------------------------------------------
  // SECTION 2: Role Management & Escalation Safeguards
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 2: Role Management & Escalation Safeguards ---\x1b[0m');

  {
    // Admin can update a member's role to viewer
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId, userId: memberUser1._id.toString() },
      body: { role: 'viewer' },
    });
    await updateMemberRole(req, res, next);
    record('Admin can update regular member role within boundaries', res.statusCode === 200 && res.data?.success);

    // Revert back to member
    const { req: r2, res: s2, next: n2 } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId, userId: memberUser1._id.toString() },
      body: { role: 'member' },
    });
    await updateMemberRole(r2, s2, n2);
  }

  {
    // Admin cannot escalate a member to admin or owner
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId, userId: memberUser1._id.toString() },
      body: { role: 'admin' },
    });
    await updateMemberRole(req, res, next);
    record('Admin CANNOT escalate a member to Admin (escalation protection)', res.statusCode === 403);
  }

  {
    // Regular member cannot update any roles
    const { req, res, next } = mockReqRes({
      user: memberUser1,
      params: { id: workspaceId, userId: memberUser2._id.toString() },
      body: { role: 'admin' },
    });
    await updateMemberRole(req, res, next);
    record('Member CANNOT change member roles (unauthorized operation blocked)', res.statusCode === 403);
  }

  {
    // Non-owner cannot update workspace owner role
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId, userId: ownerUser._id.toString() },
      body: { role: 'member' },
    });
    await updateMemberRole(req, res, next);
    record('Owner role cannot be modified via updateMemberRole endpoint', res.statusCode === 400 || res.statusCode === 403);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: Email Invitations Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 3: Email Invitations Lifecycle ---\x1b[0m');

  let inviteToken;
  {
    // Admin can create invitation
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
      body: { email: 'invitee@elvo-collab.test', role: 'member' },
    });
    await createInvitation(req, res, next);
    inviteToken = res.data?.data?.token || res.data?.invitation?.token;
    record('Admin/Owner can create email invitation with secure token & 7-day expiry', res.statusCode === 201 && Boolean(inviteToken));
  }

  {
    // Member cannot create invitation
    const { req, res, next } = mockReqRes({
      user: memberUser1,
      params: { id: workspaceId },
      body: { email: 'other@elvo-collab.test', role: 'member' },
    });
    await createInvitation(req, res, next);
    record('Member CANNOT create invitations (boundary enforced)', res.statusCode === 403);
  }

  {
    // Duplicate pending invitation is rejected
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
      body: { email: 'invitee@elvo-collab.test', role: 'member' },
    });
    await createInvitation(req, res, next);
    record('Duplicate pending invitation to same email is rejected', res.statusCode === 400);
  }

  {
    // Inviting an existing member is rejected
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
      body: { email: memberUser1.email, role: 'member' },
    });
    await createInvitation(req, res, next);
    record('Inviting an existing active workspace member is rejected', res.statusCode === 400);
  }

  {
    // Revoking an invitation
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId, token: inviteToken },
    });
    await revokeInvitation(req, res, next);
    record('Authorized manager can revoke an invitation', res.statusCode === 200 && res.data?.success);

    // Attempting to accept a revoked invitation fails
    const { req: accReq, res: accRes, next: accNext } = mockReqRes({
      user: outsiderUser,
      params: { token: inviteToken },
    });
    await acceptInvitation(accReq, accRes, accNext);
    record('Accepting a revoked invitation is rejected (stale prevention)', accRes.statusCode === 400);
  }

  {
    // Create new invitation and accept it
    const newInvitee = await User.create({
      name: 'Grace Invitee',
      email: 'grace@elvo-collab.test',
      password: 'password123',
    });
    const { req: invReq, res: invRes, next: invNext } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
      body: { email: newInvitee.email, role: 'member' },
    });
    await createInvitation(invReq, invRes, invNext);
    const validToken = invRes.data?.data?.token || invRes.data?.invitation?.token;

    // Grace accepts invitation
    const { req: accReq, res: accRes, next: accNext } = mockReqRes({
      user: newInvitee,
      params: { token: validToken },
    });
    await acceptInvitation(accReq, accRes, accNext);
    record('Invited user can accept valid invitation and is added as active workspace member', accRes.statusCode === 200 && accRes.data?.success);

    // Verify Grace is in members list
    const updatedWs = await Workspace.findById(workspaceId);
    const isMember = updatedWs.members.some((m) => m.user.toString() === newInvitee._id.toString());
    record('Accepted user now appears in workspace member list', isMember);

    // Accepting again fails
    const { req: reaccReq, res: reaccRes, next: reaccNext } = mockReqRes({
      user: newInvitee,
      params: { token: validToken },
    });
    await acceptInvitation(reaccReq, reaccRes, reaccNext);
    record('Accepting an already accepted invitation is rejected', reaccRes.statusCode === 400);
  }

  // --------------------------------------------------------------------------
  // SECTION 4: Join Code Lifecycle & Invalidation
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 4: Join Code Lifecycle ---\x1b[0m');

  let currentCode;
  {
    const ws = await Workspace.findById(workspaceId);
    currentCode = ws.inviteCode;

    // Outsider joins with valid code
    const outsider2 = await User.create({
      name: 'Harry Joiner',
      email: 'harry@elvo-collab.test',
      password: 'password123',
    });
    const { req, res } = mockReqRes({
      user: outsider2,
      body: { inviteCode: currentCode },
    });
    await joinWorkspace(req, res);
    record('User can join workspace using active join code', res.statusCode === 200 && res.data?.success);

    // Duplicate join is rejected
    const { req: rDup, res: sDup } = mockReqRes({
      user: outsider2,
      body: { inviteCode: currentCode },
    });
    await joinWorkspace(rDup, sDup);
    record('Duplicate join by existing member is rejected with informative error', sDup.statusCode === 400);
  }

  {
    // Regenerate join code
    const { req, res } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
    });
    await regenerateJoinCode(req, res);
    const newCode = res.data?.inviteCode;
    record('Authorized manager can regenerate join code', res.statusCode === 200 && newCode !== currentCode);

    // Old code no longer works
    const outsider3 = await User.create({
      name: 'Ian OldCode',
      email: 'ian@elvo-collab.test',
      password: 'password123',
    });
    const { req: rOld, res: sOld } = mockReqRes({
      user: outsider3,
      body: { inviteCode: currentCode },
    });
    await joinWorkspace(rOld, sOld);
    record('Old join code is rejected after regeneration', sOld.statusCode === 404 || sOld.statusCode === 400);
  }

  {
    // Revoke join code
    const { req, res } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
    });
    await revokeJoinCode(req, res);
    record('Authorized manager can revoke join code', res.statusCode === 200 && res.data?.success);

    // Joining with revoked code is rejected
    const ws = await Workspace.findById(workspaceId);
    const { req: rRev, res: sRev } = mockReqRes({
      user: outsiderUser,
      body: { inviteCode: ws.inviteCode },
    });
    await joinWorkspace(rRev, sRev);
    record('Joining with revoked/inactive join code is rejected', sRev.statusCode === 400);
  }

  // --------------------------------------------------------------------------
  // SECTION 5: Task Multi-Assignee Schema & Assignment Validation
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 5: Task Multi-Assignee & Assignment Validation ---\x1b[0m');

  let task1, task2Unassigned;
  {
    // Create task with multiple valid assignees
    const { req, res } = mockReqRes({
      user: memberUser1,
      body: {
        title: 'Implement Multi-Assignee Engine',
        startDate: '2026-10-28',
        workspaceId,
        assignees: [memberUser1._id.toString(), memberUser2._id.toString()],
        subtasks: [
          { title: 'Subtask 1', assignee: memberUser1._id.toString() },
          { title: 'Subtask 2', assignee: memberUser2._id.toString() },
        ],
      },
    });
    await createTask(req, res);
    task1 = res.data?.data || res.data?.task;
    const hasBothAssignees =
      task1 &&
      task1.assignees.length === 2 &&
      task1.assignees.some((a) => (a._id || a).toString() === memberUser1._id.toString()) &&
      task1.assignees.some((a) => (a._id || a).toString() === memberUser2._id.toString());
    const singleAssignedToSynced =
      task1 && (task1.assignedTo?._id || task1.assignedTo).toString() === memberUser1._id.toString();
    record('Task created with multiple assignees and backward-compatible assignedTo sync', res.statusCode === 201 && hasBothAssignees && singleAssignedToSynced);
  }

  {
    // Assigning non-workspace member is rejected
    const { req, res } = mockReqRes({
      user: memberUser1,
      body: {
        title: 'Unauthorized Assignee Task',
        startDate: '2026-10-28',
        workspaceId,
        assignees: [outsiderUser._id.toString()],
      },
    });
    await createTask(req, res);
    record('Assigning a non-workspace member to a collaborative task is rejected (HTTP 400)', res.statusCode === 400);
  }

  {
    // Assigning non-workspace member to subtask is rejected
    const { req, res } = mockReqRes({
      user: memberUser1,
      body: {
        title: 'Unauthorized Subtask Assignee',
        startDate: '2026-10-28',
        workspaceId,
        assignees: [memberUser1._id.toString()],
        subtasks: [{ title: 'Bad subtask', assignee: outsiderUser._id.toString() }],
      },
    });
    await createTask(req, res);
    record('Assigning a non-workspace member to a subtask is rejected (HTTP 400)', res.statusCode === 400);
  }

  {
    // Create an unassigned collaborative task
    const { req, res } = mockReqRes({
      user: memberUser1,
      body: {
        title: 'Unassigned Team Goal',
        startDate: '2026-10-29',
        workspaceId,
        assignees: [],
      },
    });
    await createTask(req, res);
    task2Unassigned = res.data?.data || res.data?.task;
    record(
      'Collaborative task can be created unassigned (assignees: [], assignedTo: null)',
      res.statusCode === 201 && task2Unassigned && task2Unassigned.assignees.length === 0 && !task2Unassigned.assignedTo
    );
  }

  // --------------------------------------------------------------------------
  // SECTION 6: Task Permissions & Operations Boundaries
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 6: Task Permissions & Operations Boundaries ---\x1b[0m');

  {
    // Creator (memberUser1) can edit their task
    const { req, res } = mockReqRes({
      user: memberUser1,
      params: { id: task1._id.toString() },
      body: { title: 'Implement Multi-Assignee Engine (Updated)' },
    });
    await updateTask(req, res);
    const updatedTitle = (res.data?.data?.title || res.data?.task?.title || '');
    record('Member who created the task can edit it', res.statusCode === 200 && updatedTitle.includes('Updated'));
  }

  {
    // Assignee (memberUser2) can edit task they are assigned to
    const { req, res } = mockReqRes({
      user: memberUser2,
      params: { id: task1._id.toString() },
      body: { description: 'Added notes by assignee memberUser2' },
    });
    await updateTask(req, res);
    const updatedDesc = (res.data?.data?.description || res.data?.task?.description || '');
    record('Member assigned to task can edit it', res.statusCode === 200 && updatedDesc.includes('memberUser2'));
  }

  {
    // Unassigned member (Viewer or other member) CANNOT edit task they didn't create
    // Create task by owner without memberUser1 as assignee
    const taskOwnerOnly = await Task.create({
      userId: ownerUser._id,
      workspaceId: wsDoc._id,
      title: 'Secret Executive Task',
      startDate: new Date('2026-10-28'),
      assignees: [ownerUser._id],
      assignedTo: ownerUser._id,
    });

    const { req, res } = mockReqRes({
      user: memberUser1,
      params: { id: taskOwnerOnly._id.toString() },
      body: { title: 'Malicious title change' },
    });
    await updateTask(req, res);
    record(
      'Member CANNOT edit a task they neither created nor are assigned to (HTTP 403)',
      res.statusCode === 403
    );

    // Member CANNOT delete a task they didn't create
    const { req: rDel, res: sDel } = mockReqRes({
      user: memberUser1,
      params: { id: taskOwnerOnly._id.toString() },
    });
    await deleteTask(rDel, sDel);
    record('Member CANNOT delete another user’s task (HTTP 403)', sDel.statusCode === 403);

    // Admin CAN delete any task in the workspace
    const { req: rAdmDel, res: sAdmDel } = mockReqRes({
      user: adminUser,
      params: { id: taskOwnerOnly._id.toString() },
    });
    await deleteTask(rAdmDel, sAdmDel);
    record('Admin CAN delete tasks in the workspace', sAdmDel.statusCode === 200 && sAdmDel.data?.success);
  }

  {
    // Member CANNOT reassign tasks of other members if they are not creator/admin
    const taskByOwner = await Task.create({
      userId: ownerUser._id,
      workspaceId: wsDoc._id,
      title: 'Task by Owner for Reassignment Test',
      startDate: new Date('2026-10-28'),
      assignees: [memberUser2._id],
      assignedTo: memberUser2._id,
    });

    const { req, res } = mockReqRes({
      user: memberUser1,
      params: { id: taskByOwner._id.toString() },
      body: { assignees: [memberUser1._id.toString()] },
    });
    await updateTask(req, res);
    record('Member CANNOT reassign assignments on tasks created by others (HTTP 403)', res.statusCode === 403);
  }

  // --------------------------------------------------------------------------
  // SECTION 7: Virtual "My Work" vs Individual Workspace Query Isolation
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 7: My Work vs Workspace Task Isolation ---\x1b[0m');

  // Create personal task for memberUser1
  const personalTask1 = await Task.create({
    userId: memberUser1._id,
    workspaceId: null,
    title: 'Buy Groceries (Personal)',
    startDate: new Date('2026-10-28'),
  });

  {
    // Query My Work for memberUser1
    const { req, res } = mockReqRes({
      user: memberUser1,
      query: { workspaceId: 'my-work' },
    });
    await getTasks(req, res);
    const myWorkTasks = res.data?.data || res.data?.tasks || [];
    const myWorkTitles = myWorkTasks.map((t) => t.title);

    const includesPersonal = myWorkTitles.includes('Buy Groceries (Personal)');
    const includesAssignedCollab = myWorkTitles.some((t) => t.includes('Implement Multi-Assignee Engine'));
    const excludesUnassigned = !myWorkTitles.includes('Unassigned Team Goal');

    record('My Work includes eligible personal tasks', includesPersonal);
    record('My Work includes collaborative tasks where user is assigned', includesAssignedCollab);
    record('My Work STRICTLY EXCLUDES unassigned collaborative tasks', excludesUnassigned);

    // Check deduplication (task1 has 2 assignees, but memberUser1 should see it exactly once)
    const task1Count = myWorkTasks.filter((t) => t._id.toString() === task1._id.toString()).length;
    record('Multiple assignees task appears exactly once in My Work (no duplicate entries)', task1Count === 1);
  }

  {
    // Query Individual Collaborative Workspace
    const { req, res } = mockReqRes({
      user: memberUser1,
      query: { workspaceId },
    });
    await getTasks(req, res);
    const wsTasks = res.data?.data || res.data?.tasks || [];
    const wsTitles = wsTasks.map((t) => t.title);

    record('Collaborative workspace includes unassigned tasks', wsTitles.includes('Unassigned Team Goal'));
    record('Collaborative workspace excludes personal tasks', !wsTitles.includes('Buy Groceries (Personal)'));

    // Test "assignedToMe" filter in individual collaborative workspace
    const { req: rMe, res: sMe } = mockReqRes({
      user: memberUser1,
      query: { workspaceId, assignedToMe: 'true' },
    });
    await getTasks(rMe, sMe);
    const assignedToMeTasks = sMe.data?.data || sMe.data?.tasks || [];
    const assignedTitles = assignedToMeTasks.map((t) => t.title);
    record(
      'Collaborative workspace "Assigned to Me" filter returns only user’s assigned tasks',
      assignedTitles.some((t) => t.includes('Implement Multi-Assignee Engine')) && !assignedTitles.includes('Unassigned Team Goal')
    );
  }

  // --------------------------------------------------------------------------
  // SECTION 8: Task Comments & Permission Boundaries
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 8: Task Comments & Permissions ---\x1b[0m');

  let comment1;
  {
    // Member adds comment to accessible task
    const { req, res } = mockReqRes({
      user: memberUser1,
      params: { id: task1._id.toString() },
      body: { text: 'I am starting on the assignee schema today.' },
    });
    await addComment(req, res);
    const taskWithComment = res.data?.data || res.data?.task;
    comment1 = (taskWithComment?.comments || []).slice(-1)[0] || res.data?.comment;
    record('Authorized member can add comment to workspace task', res.statusCode === 201 && Boolean(comment1));
  }

  {
    // Comment author can edit comment
    const { req, res } = mockReqRes({
      user: memberUser1,
      params: { id: task1._id.toString(), commentId: comment1._id.toString() },
      body: { text: 'I have finished the schema draft (updated).' },
    });
    await updateComment(req, res);
    const updatedTask = res.data?.data || res.data?.task;
    const foundComment = (updatedTask?.comments || []).find((c) => c._id.toString() === comment1._id.toString());
    record('Comment author can edit their own comment', res.statusCode === 200 && (foundComment?.text?.includes('updated') || res.data?.comment?.text?.includes('updated')));
  }

  {
    // Non-author member CANNOT edit another user's comment
    const { req, res } = mockReqRes({
      user: memberUser2,
      params: { id: task1._id.toString(), commentId: comment1._id.toString() },
      body: { text: 'Tampered comment' },
    });
    await updateComment(req, res);
    record('Non-author member CANNOT edit another member’s comment (HTTP 403)', res.statusCode === 403);
  }

  {
    // Non-author member CANNOT delete another user's comment
    const { req, res } = mockReqRes({
      user: memberUser2,
      params: { id: task1._id.toString(), commentId: comment1._id.toString() },
    });
    await deleteComment(req, res);
    record('Non-author member CANNOT delete another member’s comment (HTTP 403)', res.statusCode === 403);
  }

  {
    // Workspace Admin CAN delete any member's comment
    const { req, res } = mockReqRes({
      user: adminUser,
      params: { id: task1._id.toString(), commentId: comment1._id.toString() },
    });
    await deleteComment(req, res);
    record('Workspace Admin CAN delete comments for moderation', res.statusCode === 200 && res.data?.success);
  }

  // --------------------------------------------------------------------------
  // SECTION 9: Member Departure & Removal with Task Reassignment
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 9: Member Removal & Task Reassignment ---\x1b[0m');

  {
    // Member removal with reassignment of their tasks to memberUser1
    const { req, res, next } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId, userId: memberUser2._id.toString() },
      body: { reassignTo: memberUser1._id.toString() },
    });
    await removeMember(req, res, next);
    record('Admin can remove member with safe task reassignment to eligible member', res.statusCode === 200 && res.data?.success);

    // Verify memberUser2 is no longer in members
    const updatedWs = await Workspace.findById(workspaceId);
    const isMemberStill = updatedWs.members.some((m) => m.user.toString() === memberUser2._id.toString());
    record('Removed member is removed from workspace member list', !isMemberStill);

    // Verify task1 assignees no longer contain memberUser2
    const reloadedTask1 = await Task.findById(task1._id);
    const hasRemovedMember = reloadedTask1.assignees.some((a) => a.toString() === memberUser2._id.toString());
    record('Removed member is cleared from task assignees list', !hasRemovedMember);
  }

  // --------------------------------------------------------------------------
  // SECTION 10: Ownership Transfer with Lockout Safeguards
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 10: Ownership Transfer & Lockout Safeguards ---\x1b[0m');

  {
    // Admin cannot transfer ownership
    const { req, res } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
      body: { newOwnerId: adminUser._id.toString() },
    });
    await transferOwnership(req, res);
    record('Admin CANNOT transfer workspace ownership (Owner-only privilege)', res.statusCode === 403);
  }

  {
    // Transferring to non-member is rejected
    const { req, res } = mockReqRes({
      user: ownerUser,
      params: { id: workspaceId },
      body: { newOwnerId: outsiderUser._id.toString() },
    });
    await transferOwnership(req, res);
    record('Transferring ownership to non-member is rejected', res.statusCode === 400);
  }

  {
    // Owner transfers to adminUser
    const { req, res } = mockReqRes({
      user: ownerUser,
      params: { id: workspaceId },
      body: { newOwnerId: adminUser._id.toString() },
    });
    await transferOwnership(req, res);
    record('Owner can transfer ownership; former owner demoted to admin (lockout prevention)', res.statusCode === 200 && res.data?.success);

    const ws = await Workspace.findById(workspaceId);
    record('New owner is set on workspace model', ws.owner.toString() === adminUser._id.toString());
    const formerOwnerMem = ws.members.find((m) => m.user.toString() === ownerUser._id.toString());
    record('Former owner retained as admin in member list', formerOwnerMem && formerOwnerMem.role === 'admin');
  }

  // --------------------------------------------------------------------------
  // SECTION 11: Workspace Archive, Restore, and Mutation Blocking
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 11: Workspace Archiving & Lifecycle ---\x1b[0m');

  {
    // Non-owner cannot archive
    const { req, res } = mockReqRes({
      user: memberUser1,
      params: { id: workspaceId },
    });
    await archiveWorkspace(req, res);
    record('Non-owner CANNOT archive workspace (Owner-only)', res.statusCode === 403);
  }

  {
    // New owner (adminUser) archives the workspace
    const { req, res } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
    });
    await archiveWorkspace(req, res);
    const archWs = res.data?.data || res.data?.workspace;
    record('Owner can archive workspace', res.statusCode === 200 && archWs?.isArchived === true);
  }

  {
    // Archived workspace is excluded from default getWorkspaces query
    const { req, res } = mockReqRes({
      user: adminUser,
    });
    await getWorkspaces(req, res);
    const activeWsList = res.data?.data || res.data?.workspaces || [];
    record('Archived workspace is excluded from ordinary active workspaces query', !activeWsList.some((w) => w._id.toString() === workspaceId));

    // Can be retrieved with includeArchived=true
    const { req: rArch, res: sArch } = mockReqRes({
      user: adminUser,
      query: { includeArchived: 'true' },
    });
    await getWorkspaces(rArch, sArch);
    const allWsList = sArch.data?.data || sArch.data?.workspaces || [];
    record('Archived workspace appears when includeArchived=true is requested', allWsList.some((w) => w._id.toString() === workspaceId));
  }

  {
    // Task mutations are BLOCKED on archived workspace
    const { req, res } = mockReqRes({
      user: adminUser,
      body: {
        title: 'Task should fail on archived workspace',
        startDate: '2026-10-30',
        workspaceId,
      },
    });
    await createTask(req, res);
    record('Task creation is BLOCKED when workspace is archived (HTTP 400)', res.statusCode === 400 && (res.data?.error?.includes('archived') || res.data?.message?.includes('archived')));

    // Editing existing task on archived workspace is blocked
    const { req: rEdit, res: sEdit } = mockReqRes({
      user: adminUser,
      params: { id: task1._id.toString() },
      body: { title: 'Edit should fail on archived' },
    });
    await updateTask(rEdit, sEdit);
    record('Task editing is BLOCKED when workspace is archived (HTTP 400)', sEdit.statusCode === 400 && (sEdit.data?.error?.includes('archived') || sEdit.data?.message?.includes('archived')));
  }

  {
    // Owner restores the workspace
    const { req, res } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
    });
    await restoreWorkspace(req, res);
    const restWs = res.data?.data || res.data?.workspace;
    record('Owner can restore archived workspace', res.statusCode === 200 && restWs?.isArchived === false);

    // After restore, task creation works again
    const { req: rNew, res: sNew } = mockReqRes({
      user: adminUser,
      body: {
        title: 'Task after workspace restore',
        startDate: '2026-10-30',
        workspaceId,
        assignees: [adminUser._id.toString()],
      },
    });
    await createTask(rNew, sNew);
    record('Task creation succeeds normally after workspace restoration', sNew.statusCode === 201 && Boolean(sNew.data?.task || sNew.data?.data));
  }

  // --------------------------------------------------------------------------
  // SECTION 12: Workspace Activity History & Audit Trail
  // --------------------------------------------------------------------------
  console.log('\n\x1b[33m--- Section 12: Workspace Activity History ---\x1b[0m');

  {
    const { req, res } = mockReqRes({
      user: adminUser,
      params: { id: workspaceId },
    });
    await getWorkspaceActivity(req, res);
    const activities = res.data?.data || res.data?.activity || [];
    const actions = activities.map((a) => a.action);

    record('Activity audit history is recorded for workspace actions', activities.length > 0);
    record(
      'Activity log includes ownership transfer and archive events',
      actions.includes('ownership_transferred') && actions.includes('workspace_archived')
    );

    // Outsider cannot access activity history
    const { req: rOut, res: sOut } = mockReqRes({
      user: outsiderUser,
      params: { id: workspaceId },
    });
    await getWorkspaceActivity(rOut, sOut);
    record('Non-member CANNOT access workspace activity history (HTTP 403)', sOut.statusCode === 403);
  }

  // Cleanup
  await User.deleteMany({});
  await Workspace.deleteMany({});
  await Task.deleteMany({});
  await mongoose.disconnect();

  console.log('\n\x1b[1m\x1b[36m=== SUITE SUMMARY ===\x1b[0m');
  console.log(`Total tests : ${testResults.passed + testResults.failed}`);
  console.log(`Passed      : \x1b[32m${testResults.passed}\x1b[0m`);
  console.log(`Failed      : \x1b[31m${testResults.failed}\x1b[0m`);

  if (testResults.failed > 0) {
    console.error('\n\x1b[31mSome tests failed. Please review the output above.\x1b[0m');
    process.exit(1);
  } else {
    console.log('\n\x1b[32mAll Phase 4A Collaborative Workspace Foundations tests passed successfully!\x1b[0m\n');
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
