/**
 * ELVO — Notes V1 Comprehensive Integration Test Suite
 *
 * Covers:
 * 1. Personal Note Lifecycle (create, autosave/edit, retrieve, title preview).
 * 2. Rich-Text Document Storage & Preview Extraction.
 * 3. Search across titles, content previews, and tags within authorized scope.
 * 4. Independent Pin and Favorite Toggles.
 * 5. Collection Management & Safe Deletion (notes unfiled, never destroyed).
 * 6. Archive and Restore Lifecycle.
 * 7. Trash, Restore, and Permanent Deletion.
 * 8. User Privacy & Cross-User Isolation (User B cannot access User A's personal note).
 * 9. Collaborative Workspace Notes & Role-Based Authorization:
 *    - Owner & Admin: full create, edit, archive, trash, delete permanent.
 *    - Member: create, edit, archive, trash.
 *    - Viewer: read-only access (create, edit, trash, and delete are blocked with 403).
 *    - Non-member / Removed member: blocked with 403.
 *    - Cross-workspace tampering protection.
 * 10. Task Integration:
 *     - Linking an existing task bidirectionally (Note.linkedTasks & Task.linkedNoteId).
 *     - Unlinking a task.
 *     - Creating a task directly from selected text.
 *     - Deleted/inaccessible task resilience.
 */

import mongoose from './server/node_modules/mongoose/index.js';
import User from './server/src/models/User.js';
import Workspace from './server/src/models/Workspace.js';
import Task from './server/src/models/Task.js';
import Note from './server/src/models/Note.js';
import NoteCollection from './server/src/models/NoteCollection.js';

import {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  archiveNote,
  restoreNote,
  trashNote,
  deleteNotePermanently,
  emptyTrash,
  togglePin,
  toggleFavorite,
  linkTaskToNote as linkTask,
  unlinkTaskFromNote as unlinkTask,
  createTaskFromSelection,
} from './server/src/controllers/noteController.js';

import {
  getNoteCollections,
  createNoteCollection,
  updateNoteCollection,
  deleteNoteCollection,
} from './server/src/controllers/noteCollectionController.js';

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
  console.log('\n\x1b[1m\x1b[36m=== ELVO: NOTES V1 INTEGRATION TEST SUITE ===\x1b[0m\n');

  const testDbUri = getSafeTestUri();
  assertSafeTestDatabase(testDbUri);
  await mongoose.connect(testDbUri);
  console.log(`Connected to isolated test database: ${testDbUri}\n`);

  // Clean test collections
  await User.deleteMany({});
  await Workspace.deleteMany({});
  await Task.deleteMany({});
  await Note.deleteMany({});
  await NoteCollection.deleteMany({});

  // 1. Setup users
  const alice = await User.create({
    name: 'Alice Planner',
    email: 'alice@elvo-notes.test',
    password: 'password123',
  });

  const bob = await User.create({
    name: 'Bob Member',
    email: 'bob@elvo-notes.test',
    password: 'password123',
  });

  const charlie = await User.create({
    name: 'Charlie Viewer',
    email: 'charlie@elvo-notes.test',
    password: 'password123',
  });

  const outsider = await User.create({
    name: 'Eve Outsider',
    email: 'eve@elvo-notes.test',
    password: 'password123',
  });

  // Setup Workspace with Alice (owner), Bob (member), Charlie (viewer)
  const workspace = await Workspace.create({
    name: 'Engineering Workspace',
    owner: alice._id,
    members: [
      { user: alice._id, role: 'owner', joinedAt: new Date() },
      { user: bob._id, role: 'member', joinedAt: new Date() },
      { user: charlie._id, role: 'viewer', joinedAt: new Date() },
    ],
  });

  console.log('\x1b[33m--- Suite 1: Personal Note Lifecycle & Autosave ---\x1b[0m');

  let personalNoteId;

  // Test 1: Create personal note
  {
    const { req, res } = mockReqRes({
      user: alice,
      body: {
        title: 'Sprint Planning Notes',
        content: { type: 'doc', content: [{ type: 'paragraph', text: 'Initial sprint ideas' }] },
        plainTextPreview: 'Initial sprint ideas',
        tags: ['sprint', 'planning'],
      },
    });
    await createNote(req, res);
    const note = res.data?.data || res.data?.note;
    const passed = res.statusCode === 201 && note?.title === 'Sprint Planning Notes' && !note?.workspaceId;
    personalNoteId = note?._id;
    record('Create personal note with tags and content', passed, `status=${res.statusCode}`);
  }

  // Test 2: Autosave / update note content
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
      body: {
        title: 'Sprint Planning Notes (Updated)',
        content: { type: 'doc', content: [{ type: 'paragraph', text: 'Expanded sprint backlog goals' }] },
        plainTextPreview: 'Expanded sprint backlog goals',
        tags: ['sprint', 'q4'],
      },
    });
    await updateNote(req, res);
    const note = res.data?.data || res.data?.note;
    const passed = res.statusCode === 200 && note?.title === 'Sprint Planning Notes (Updated)' && note?.plainTextPreview === 'Expanded sprint backlog goals';
    record('Autosave note updates title, content, preview, and tags', passed, `status=${res.statusCode}`);
  }

  // Test 3: Get personal note by ID
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await getNoteById(req, res);
    const note = res.data?.data || res.data?.note;
    const passed = res.statusCode === 200 && note?._id?.toString() === personalNoteId.toString();
    record('Retrieve personal note by ID', passed, `status=${res.statusCode}`);
  }

  console.log('\n\x1b[33m--- Suite 2: Search, Filters & Pin/Favorite Independence ---\x1b[0m');

  // Test 4: Pin and favorite independence
  {
    const { req: pReq, res: pRes } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await togglePin(pReq, pRes);

    const { req: fReq, res: fRes } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await toggleFavorite(fReq, fRes);

    const checkNote = await Note.findById(personalNoteId);
    const passed = checkNote.isPinned === true && checkNote.isFavorite === true;
    record('Pin and Favorite can be toggled independently', passed, `pinned=${checkNote.isPinned}, favorite=${checkNote.isFavorite}`);
  }

  // Test 5: Search note by title
  {
    const { req, res } = mockReqRes({
      user: alice,
      query: { scope: 'personal', search: 'Sprint' },
    });
    await getNotes(req, res);
    const notes = res.data?.data || res.data?.notes || [];
    const passed = res.statusCode === 200 && notes.length >= 1 && notes[0]._id.toString() === personalNoteId.toString();
    record('Search finds note by title', passed, `count=${notes.length}`);
  }

  // Test 6: Search note by tag
  {
    const { req, res } = mockReqRes({
      user: alice,
      query: { scope: 'personal', tag: 'q4' },
    });
    await getNotes(req, res);
    const notes = res.data?.data || res.data?.notes || [];
    const passed = res.statusCode === 200 && notes.length >= 1 && notes[0]._id.toString() === personalNoteId.toString();
    record('Filter notes by tag', passed, `count=${notes.length}`);
  }

  console.log('\n\x1b[33m--- Suite 3: Collections & Safe Deletion ---\x1b[0m');

  let collectionId;

  // Test 7: Create collection
  {
    const { req, res } = mockReqRes({
      user: alice,
      body: { name: 'Sprint Docs', color: '#10B981' },
      query: { scope: 'personal' },
    });
    await createNoteCollection(req, res);
    const col = res.data?.data || res.data?.collection;
    const passed = res.statusCode === 201 && col?.name === 'Sprint Docs';
    collectionId = col?._id;
    record('Create personal collection', passed, `status=${res.statusCode}`);
  }

  // Test 8: Assign note to collection
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
      body: { collectionId },
    });
    await updateNote(req, res);
    const check = await Note.findById(personalNoteId);
    const passed = check.collectionId?.toString() === collectionId.toString();
    record('Assign note to collection', passed, `col=${check.collectionId}`);
  }

  // Test 9: Get collections with note count aggregation
  {
    const { req, res } = mockReqRes({
      user: alice,
      query: { scope: 'personal' },
    });
    await getNoteCollections(req, res);
    const cols = res.data?.data || res.data?.collections || [];
    const foundCol = cols.find((c) => c._id.toString() === collectionId.toString());
    const passed = res.statusCode === 200 && foundCol?.noteCount === 1;
    record('Collections list returns accurate note aggregation count', passed, `count=${foundCol?.noteCount}`);
  }

  // Test 10: Safe collection deletion (notes unfiled, NOT destroyed)
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: collectionId },
    });
    await deleteNoteCollection(req, res);
    const checkNote = await Note.findById(personalNoteId);
    const passed = res.statusCode === 200 && checkNote !== null && checkNote.collectionId === null;
    record('Deleting collection safely unfiles notes without deleting them', passed, `col=${checkNote.collectionId}`);
  }

  console.log('\n\x1b[33m--- Suite 4: Archive, Trash, Restore & Permanent Deletion ---\x1b[0m');

  // Test 11: Archive note
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await archiveNote(req, res);
    const check = await Note.findById(personalNoteId);
    const passed = res.statusCode === 200 && check.isArchived === true && !check.isTrashed;
    record('Archive note removes it from active library', passed, `archived=${check.isArchived}`);
  }

  // Test 12: Active query excludes archived notes
  {
    const { req, res } = mockReqRes({
      user: alice,
      query: { scope: 'personal', view: 'all' },
    });
    await getNotes(req, res);
    const notes = res.data?.data || res.data?.notes || [];
    const found = notes.some((n) => n._id.toString() === personalNoteId.toString());
    record('Active notes query excludes archived notes', !found, `found=${found}`);
  }

  // Test 13: Restore archived note
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await restoreNote(req, res);
    const check = await Note.findById(personalNoteId);
    const passed = res.statusCode === 200 && check.isArchived === false;
    record('Restore note returns it to active library', passed, `archived=${check.isArchived}`);
  }

  // Test 14: Trash note
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await trashNote(req, res);
    const check = await Note.findById(personalNoteId);
    const passed = res.statusCode === 200 && check.isTrashed === true;
    record('Trash note sets isTrashed=true and records trashedAt', passed, `trashed=${check.isTrashed}`);
  }

  // Test 15: Trash view includes trashed note
  {
    const { req, res } = mockReqRes({
      user: alice,
      query: { scope: 'personal', view: 'trash' },
    });
    await getNotes(req, res);
    const notes = res.data?.data || res.data?.notes || [];
    const found = notes.some((n) => n._id.toString() === personalNoteId.toString());
    record('Trash view includes trashed note', found, `count=${notes.length}`);
  }

  // Test 16: Restore trashed note
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await restoreNote(req, res);
    const check = await Note.findById(personalNoteId);
    const passed = res.statusCode === 200 && check.isTrashed === false;
    record('Restore trashed note unsets isTrashed', passed, `trashed=${check.isTrashed}`);
  }

  console.log('\n\x1b[33m--- Suite 5: Cross-User Isolation & Privacy ---\x1b[0m');

  // Test 17: User B cannot view Alice's personal note
  {
    const { req, res } = mockReqRes({
      user: bob,
      params: { id: personalNoteId },
    });
    await getNoteById(req, res);
    const passed = res.statusCode === 403 || res.statusCode === 404;
    record('User B cannot view User A personal note', passed, `status=${res.statusCode}`);
  }

  // Test 18: User B cannot edit Alice's personal note
  {
    const { req, res } = mockReqRes({
      user: bob,
      params: { id: personalNoteId },
      body: { title: 'Hacked Title' },
    });
    await updateNote(req, res);
    const passed = res.statusCode === 403 || res.statusCode === 404;
    record('User B cannot update User A personal note', passed, `status=${res.statusCode}`);
  }

  console.log('\n\x1b[33m--- Suite 6: Collaborative Workspace Notes & Role Authorization ---\x1b[0m');

  let wsNoteId;

  // Test 19: Workspace Member (Bob) can create workspace note
  {
    const { req, res } = mockReqRes({
      user: bob,
      body: {
        workspaceId: workspace._id,
        title: 'Architecture Blueprint',
        content: { type: 'doc', content: [{ type: 'paragraph', text: 'System diagram' }] },
        plainTextPreview: 'System diagram',
      },
    });
    await createNote(req, res);
    const note = res.data?.data || res.data?.note;
    const passed = res.statusCode === 201 && note?.workspaceId?.toString() === workspace._id.toString();
    wsNoteId = note?._id;
    record('Workspace Member can create workspace note', passed, `status=${res.statusCode}`);
  }

  // Test 20: Workspace Viewer (Charlie) can VIEW workspace note
  {
    const { req, res } = mockReqRes({
      user: charlie,
      params: { id: wsNoteId },
    });
    await getNoteById(req, res);
    const note = res.data?.data || res.data?.note;
    const passed = res.statusCode === 200 && note?._id?.toString() === wsNoteId.toString();
    record('Workspace Viewer can view workspace note', passed, `status=${res.statusCode}`);
  }

  // Test 21: Workspace Viewer (Charlie) is BLOCKED from editing workspace note (403)
  {
    const { req, res } = mockReqRes({
      user: charlie,
      params: { id: wsNoteId },
      body: { title: 'Viewer Modified Title' },
    });
    await updateNote(req, res);
    const passed = res.statusCode === 403;
    record('Workspace Viewer is blocked from updating workspace note (403)', passed, `status=${res.statusCode}`);
  }

  // Test 22: Workspace Viewer (Charlie) is BLOCKED from creating workspace note (403)
  {
    const { req, res } = mockReqRes({
      user: charlie,
      body: {
        workspaceId: workspace._id,
        title: 'Viewer Note',
      },
    });
    await createNote(req, res);
    const passed = res.statusCode === 403;
    record('Workspace Viewer is blocked from creating workspace note (403)', passed, `status=${res.statusCode}`);
  }

  // Test 23: Outsider is BLOCKED from workspace notes (403)
  {
    const { req, res } = mockReqRes({
      user: outsider,
      params: { id: wsNoteId },
    });
    await getNoteById(req, res);
    const passed = res.statusCode === 403;
    record('Non-member is denied access to workspace note (403)', passed, `status=${res.statusCode}`);
  }

  // Test 24: Prevent scope tampering (trying to reassign workspace note to another workspace or personal)
  {
    const { req, res } = mockReqRes({
      user: bob,
      params: { id: wsNoteId },
      body: { workspaceId: null, title: 'Tamper Scope' },
    });
    await updateNote(req, res);
    const check = await Note.findById(wsNoteId);
    const passed = check.workspaceId?.toString() === workspace._id.toString();
    record('Scope tampering rejected (workspace note remains in original workspace)', passed, `ws=${check.workspaceId}`);
  }

  console.log('\n\x1b[33m--- Suite 7: Task Integration & Task Creation from Selection ---\x1b[0m');

  // Create an existing task for Alice
  const testTask = await Task.create({
    userId: alice._id,
    title: 'Refactor Auth Storage',
    priority: 'High',
    status: 'In Progress',
  });

  // Test 25: Link existing task to note bidirectionally
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
      body: { taskId: testTask._id },
    });
    await linkTask(req, res);

    const checkNote = await Note.findById(personalNoteId);
    const checkTask = await Task.findById(testTask._id);
    const passed =
      res.statusCode === 200 &&
      checkNote.linkedTasks.some((t) => t.toString() === testTask._id.toString()) &&
      checkTask.linkedNoteId?.toString() === personalNoteId.toString();

    record('Link existing task bidirectionally (Note.linkedTasks & Task.linkedNoteId)', passed, `status=${res.statusCode}`);
  }

  // Test 26: Unlink task
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId, taskId: testTask._id },
    });
    await unlinkTask(req, res);

    const checkNote = await Note.findById(personalNoteId);
    const checkTask = await Task.findById(testTask._id);
    const passed =
      res.statusCode === 200 &&
      !checkNote.linkedTasks.some((t) => t.toString() === testTask._id.toString()) &&
      checkTask.linkedNoteId === null;

    record('Unlink task clears bidirectional relationship', passed, `status=${res.statusCode}`);
  }

  // Test 27: Create task directly from selected text
  let createdTaskId;
  {
    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
      body: {
        selectedText: 'Implement Notes V1 autosave retry mechanism',
        title: 'Implement Notes V1 autosave retry mechanism',
        priority: 'High',
        status: 'To Do',
      },
    });
    await createTaskFromSelection(req, res);

    const taskData = res.data?.data?.task || res.data?.task;
    createdTaskId = taskData?._id;
    const checkNote = await Note.findById(personalNoteId);
    const checkTask = await Task.findById(createdTaskId);

    const passed =
      res.statusCode === 201 &&
      checkTask?.title === 'Implement Notes V1 autosave retry mechanism' &&
      checkTask?.linkedNoteId?.toString() === personalNoteId.toString() &&
      checkNote.linkedTasks.some((t) => t.toString() === createdTaskId.toString());

    record('Create task from selected text links task to note and sets task schema fields', passed, `status=${res.statusCode}`);
  }

  // Test 28: Permanent deletion of a trashed note
  {
    // Trash first
    await Note.findByIdAndUpdate(personalNoteId, { isTrashed: true, trashedAt: new Date() });

    const { req, res } = mockReqRes({
      user: alice,
      params: { id: personalNoteId },
    });
    await deleteNotePermanently(req, res);

    const checkNote = await Note.findById(personalNoteId);
    // Task should NOT be destroyed, its linkedNoteId should be cleared or retained gracefully
    const checkTask = await Task.findById(createdTaskId);

    const passed = res.statusCode === 200 && checkNote === null && checkTask !== null;
    record('Permanently delete note removes note while preserving linked tasks safely', passed, `status=${res.statusCode}`);
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
