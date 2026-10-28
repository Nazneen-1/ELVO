import Note from '../models/Note.js';
import Task from '../models/Task.js';
import Workspace from '../models/Workspace.js';
import NoteCollection from '../models/NoteCollection.js';
import {
  isWorkspaceMember,
  canManageWorkspace,
  canCreateNote,
  canViewNote,
  canEditNote,
  canArchiveNote,
  canRestoreNote,
  canTrashNote,
  canDeleteNotePermanently,
} from '../utils/workspaceAuth.js';

/**
 * Extracts plain text from TipTap JSON or HTML string for fast preview and indexing.
 */
function extractPlainText(content) {
  if (!content) return '';
  if (typeof content === 'string') {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  }
  if (typeof content === 'object') {
    const textPieces = [];
    const traverse = (node) => {
      if (!node) return;
      if (node.text) {
        textPieces.push(node.text);
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
    };
    traverse(content);
    return textPieces.join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  }
  return '';
}

// @desc    Get notes for active scope (personal or workspace) with filtering & search
// @route   GET /api/notes
// @access  Private
export const getNotes = async (req, res, next) => {
  try {
    const {
      workspaceId,
      view = 'all',
      collectionId,
      tag,
      search,
      sort = 'updatedAt',
      order = 'desc',
    } = req.query;

    const isPersonal = !workspaceId || workspaceId === 'personal';
    const query = {};

    // 1. Scope Partitioning
    let workspaceDoc = null;
    if (isPersonal) {
      query.userId = req.user._id;
      query.workspaceId = null;
    } else {
      workspaceDoc = await Workspace.findById(workspaceId);
      if (!workspaceDoc) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
      }
      if (!isWorkspaceMember(workspaceDoc, req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied to this workspace' });
      }
      query.workspaceId = workspaceDoc._id;
    }

    // 2. View Mode Filter
    switch (view) {
      case 'pinned':
        query.isTrashed = false;
        query.isArchived = false;
        query.isPinned = true;
        break;
      case 'favorites':
        query.isTrashed = false;
        query.isArchived = false;
        query.isFavorite = true;
        break;
      case 'archived':
        query.isTrashed = false;
        query.isArchived = true;
        break;
      case 'trash':
        query.isTrashed = true;
        break;
      case 'all':
      default:
        query.isTrashed = false;
        query.isArchived = false;
        break;
    }

    // 3. Collection Filter
    if (collectionId) {
      if (collectionId === 'unfiled') {
        query.collectionId = null;
      } else {
        query.collectionId = collectionId;
      }
    }

    // 4. Tag Filter
    if (tag && tag.trim()) {
      query.tags = tag.trim();
    }

    // 5. Search Filter (Title, preview content, and tags)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { title: searchRegex },
        { plainTextPreview: searchRegex },
        { tags: searchRegex },
      ];
    }

    // 6. Sorting
    const sortField = ['updatedAt', 'createdAt', 'title'].includes(sort) ? sort : 'updatedAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = {};
    if (view === 'all' || view === 'favorites') {
      sortObj.isPinned = -1; // Pinned notes on top in standard views
    }
    sortObj[sortField] = sortOrder;

    const notes = await Note.find(query)
      .sort(sortObj)
      .populate('collectionId', 'name color icon')
      .populate('linkedTasks', '_id title status priority dueDate startDate workspaceId isAllDay')
      .populate('userId', '_id name email');

    return res.status(200).json({ success: true, count: notes.length, data: notes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single note by ID
// @route   GET /api/notes/:id
// @access  Private
export const getNoteById = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('collectionId', 'name color icon')
      .populate('linkedTasks', '_id title status priority dueDate startDate workspaceId isAllDay')
      .populate('userId', '_id name email');

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canViewNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied to this note' });
    }

    return res.status(200).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new note
// @route   POST /api/notes
// @access  Private
export const createNote = async (req, res, next) => {
  try {
    const {
      title,
      content,
      plainTextPreview,
      workspaceId,
      collectionId,
      tags = [],
      isPinned = false,
      isFavorite = false,
    } = req.body;

    const isPersonal = !workspaceId || workspaceId === 'personal';
    let targetWorkspaceId = null;
    let workspaceDoc = null;

    if (!isPersonal) {
      workspaceDoc = await Workspace.findById(workspaceId);
      if (!workspaceDoc) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
      }
      if (!canCreateNote(workspaceDoc, req.user._id)) {
        return res.status(403).json({ success: false, message: 'Cannot create notes in this workspace (read-only or archived)' });
      }
      targetWorkspaceId = workspaceDoc._id;
    }

    // Verify collection belongs to appropriate scope if provided
    let targetCollectionId = null;
    if (collectionId && collectionId !== 'unfiled') {
      const col = await NoteCollection.findById(collectionId);
      if (col) {
        const matchesScope = isPersonal
          ? !col.workspaceId && col.userId.toString() === req.user._id.toString()
          : col.workspaceId && col.workspaceId.toString() === targetWorkspaceId.toString();
        if (matchesScope) {
          targetCollectionId = col._id;
        }
      }
    }

    const calculatedPreview = (plainTextPreview && plainTextPreview.trim())
      ? plainTextPreview.trim().slice(0, 500)
      : extractPlainText(content);

    const note = await Note.create({
      userId: req.user._id,
      workspaceId: targetWorkspaceId,
      title: title && title.trim() ? title.trim() : 'Untitled Note',
      content: content || { type: 'doc', content: [] },
      plainTextPreview: calculatedPreview,
      collectionId: targetCollectionId,
      tags: Array.isArray(tags) ? tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      isPinned: Boolean(isPinned),
      isFavorite: Boolean(isFavorite),
    });

    const populated = await Note.findById(note._id)
      .populate('collectionId', 'name color icon')
      .populate('userId', '_id name email');

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Update / autosave a note
// @route   PUT /api/notes/:id
// @access  Private
export const updateNote = async (req, res, next) => {
  try {
    const {
      title,
      content,
      plainTextPreview,
      collectionId,
      tags,
      isPinned,
      isFavorite,
      version,
    } = req.body;

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canEditNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Cannot edit this note' });
    }

    if (note.isTrashed) {
      return res.status(400).json({ success: false, message: 'Cannot edit a note in Trash. Restore it first.' });
    }

    // Apply updates
    if (title !== undefined) {
      note.title = title.trim() ? title.trim() : 'Untitled Note';
    }

    if (content !== undefined) {
      note.content = content;
      note.plainTextPreview = (plainTextPreview && plainTextPreview.trim())
        ? plainTextPreview.trim().slice(0, 500)
        : extractPlainText(content);
    } else if (plainTextPreview !== undefined) {
      note.plainTextPreview = plainTextPreview.trim().slice(0, 500);
    }

    if (tags !== undefined && Array.isArray(tags)) {
      note.tags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
    }

    if (collectionId !== undefined) {
      if (collectionId === null || collectionId === '' || collectionId === 'unfiled') {
        note.collectionId = null;
      } else {
        const col = await NoteCollection.findById(collectionId);
        if (col) {
          const matchesScope = !note.workspaceId
            ? !col.workspaceId && col.userId.toString() === req.user._id.toString()
            : col.workspaceId && col.workspaceId.toString() === note.workspaceId.toString();
          if (matchesScope) {
            note.collectionId = col._id;
          }
        }
      }
    }

    if (isPinned !== undefined) {
      note.isPinned = Boolean(isPinned);
    }

    if (isFavorite !== undefined) {
      note.isFavorite = Boolean(isFavorite);
    }

    note.version = (note.version || 1) + 1;
    await note.save();

    const populated = await Note.findById(note._id)
      .populate('collectionId', 'name color icon')
      .populate('linkedTasks', '_id title status priority dueDate startDate workspaceId isAllDay')
      .populate('userId', '_id name email');

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive note
// @route   PATCH /api/notes/:id/archive
// @access  Private
export const archiveNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canArchiveNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    note.isArchived = true;
    note.archivedAt = new Date();
    note.isPinned = false; // Pinned is deactivated on archive
    await note.save();

    return res.status(200).json({ success: true, message: 'Note archived', data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore note from archive or trash
// @route   PATCH /api/notes/:id/restore
// @access  Private
export const restoreNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canRestoreNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    note.isArchived = false;
    note.archivedAt = null;
    note.isTrashed = false;
    note.trashedAt = null;
    await note.save();

    return res.status(200).json({ success: true, message: 'Note restored', data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Move note to Trash
// @route   PATCH /api/notes/:id/trash
// @access  Private
export const trashNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canTrashNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    note.isTrashed = true;
    note.trashedAt = new Date();
    note.isPinned = false;
    await note.save();

    return res.status(200).json({ success: true, message: 'Note moved to Trash', data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete note
// @route   DELETE /api/notes/:id
// @access  Private
export const deleteNotePermanently = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canDeleteNotePermanently(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Clean up task references
    await Task.updateMany(
      { linkedNoteId: note._id },
      { $set: { linkedNoteId: null } }
    );

    await Note.findByIdAndDelete(note._id);

    return res.status(200).json({ success: true, message: 'Note permanently deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Empty all notes in Trash for the active scope
// @route   DELETE /api/notes/trash/empty
// @access  Private
export const emptyTrash = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const isPersonal = !workspaceId || workspaceId === 'personal';

    const filter = { isTrashed: true };
    if (isPersonal) {
      filter.userId = req.user._id;
      filter.workspaceId = null;
    } else {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
      }
      if (!canManageWorkspace(workspace, req.user._id)) {
        return res.status(403).json({ success: false, message: 'Only workspace owners/admins can empty trash' });
      }
      filter.workspaceId = workspace._id;
    }

    const trashedNotes = await Note.find(filter, '_id');
    const noteIds = trashedNotes.map((n) => n._id);

    // Unlink tasks
    await Task.updateMany(
      { linkedNoteId: { $in: noteIds } },
      { $set: { linkedNoteId: null } }
    );

    const result = await Note.deleteMany(filter);

    return res.status(200).json({
      success: true,
      message: `Emptied ${result.deletedCount} notes from trash`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle pin status of a note
// @route   PATCH /api/notes/:id/pin
// @access  Private
export const togglePin = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canEditNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    note.isPinned = !note.isPinned;
    await note.save();

    return res.status(200).json({ success: true, isPinned: note.isPinned, data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle favorite status of a note
// @route   PATCH /api/notes/:id/favorite
// @access  Private
export const toggleFavorite = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }

    if (!canEditNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    note.isFavorite = !note.isFavorite;
    await note.save();

    return res.status(200).json({ success: true, isFavorite: note.isFavorite, data: note });
  } catch (error) {
    next(error);
  }
};

// @desc    Link an existing task to this note
// @route   POST /api/notes/:id/link-task
// @access  Private
export const linkTaskToNote = async (req, res, next) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }
    if (!canEditNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Cannot edit this note' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Verify task scope compatibility: personal note can link personal tasks; workspace note can link workspace tasks
    if (note.workspaceId) {
      if (!task.workspaceId || task.workspaceId.toString() !== note.workspaceId.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot link tasks from a different workspace' });
      }
    } else {
      if (task.workspaceId || task.userId.toString() !== req.user._id.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot link workspace or other users’ tasks to a personal note' });
      }
    }

    // Link bidirectionally
    if (!note.linkedTasks.includes(task._id)) {
      note.linkedTasks.push(task._id);
      await note.save();
    }
    task.linkedNoteId = note._id;
    await task.save();

    const populated = await Note.findById(note._id)
      .populate('collectionId', 'name color icon')
      .populate('linkedTasks', '_id title status priority dueDate startDate workspaceId isAllDay')
      .populate('userId', '_id name email');

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlink a task from this note
// @route   POST /api/notes/:id/unlink-task
// @access  Private
export const unlinkTaskFromNote = async (req, res, next) => {
  try {
    const taskId = req.body.taskId || req.params.taskId;
    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }
    if (!canEditNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Cannot edit this note' });
    }

    note.linkedTasks = (note.linkedTasks || []).filter((tId) => tId.toString() !== taskId.toString());
    await note.save();

    await Task.updateOne(
      { _id: taskId, linkedNoteId: note._id },
      { $set: { linkedNoteId: null } }
    );

    const populated = await Note.findById(note._id)
      .populate('collectionId', 'name color icon')
      .populate('linkedTasks', '_id title status priority dueDate startDate workspaceId isAllDay')
      .populate('userId', '_id name email');

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new ELVO task from selected text inside note
// @route   POST /api/notes/:id/create-task-from-selection
// @access  Private
export const createTaskFromSelection = async (req, res, next) => {
  try {
    const {
      selectedText,
      title,
      dueDate,
      startDate,
      priority = 'Medium',
      status = 'To Do',
      assignees = [],
    } = req.body;

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    let workspaceDoc = null;
    if (note.workspaceId) {
      workspaceDoc = await Workspace.findById(note.workspaceId);
    }
    if (!canEditNote(note, workspaceDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Cannot create task from this note' });
    }

    // Proposed task title: use title if provided, otherwise clean selectedText
    const proposedTitle = (title && title.trim())
      ? title.trim()
      : (selectedText && selectedText.trim() ? selectedText.trim() : 'Task from note');
    const finalTitle = proposedTitle.slice(0, 120);

    // Resolve assignees if in collaborative workspace
    let verifiedAssignees = [];
    let primaryAssignedTo = null;

    if (note.workspaceId && workspaceDoc) {
      if (Array.isArray(assignees) && assignees.length > 0) {
        verifiedAssignees = assignees.filter((aId) => isWorkspaceMember(workspaceDoc, aId));
      }
      if (verifiedAssignees.length === 0) {
        // Default to creator in workspace
        verifiedAssignees = [req.user._id];
      }
      primaryAssignedTo = verifiedAssignees[0];
    }

    const task = await Task.create({
      userId: req.user._id,
      workspaceId: note.workspaceId || null,
      title: finalTitle,
      description: selectedText ? `Created from note "${note.title}":\n\n${selectedText.slice(0, 1500)}` : '',
      startDate: startDate ? new Date(startDate) : (dueDate ? new Date(dueDate) : new Date()),
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: ['Low', 'Medium', 'High', 'Urgent'].includes(priority) ? priority : 'Medium',
      status: ['To Do', 'In Progress', 'Done'].includes(status) ? status : 'To Do',
      assignees: verifiedAssignees,
      assignedTo: primaryAssignedTo,
      linkedNoteId: note._id,
      color: 'indigo',
    });

    // Link task to note
    if (!note.linkedTasks.includes(task._id)) {
      note.linkedTasks.push(task._id);
      await note.save();
    }

    const populatedNote = await Note.findById(note._id)
      .populate('collectionId', 'name color icon')
      .populate('linkedTasks', '_id title status priority dueDate startDate workspaceId isAllDay')
      .populate('userId', '_id name email');

    return res.status(201).json({
      success: true,
      data: {
        task,
        note: populatedNote,
      },
    });
  } catch (error) {
    next(error);
  }
};
