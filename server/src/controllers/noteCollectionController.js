import NoteCollection from '../models/NoteCollection.js';
import Note from '../models/Note.js';
import Workspace from '../models/Workspace.js';
import { isWorkspaceMember, canManageWorkspace } from '../utils/workspaceAuth.js';

// @desc    Get note collections for active scope (personal or workspace)
// @route   GET /api/note-collections
// @access  Private
export const getNoteCollections = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const isPersonal = !workspaceId || workspaceId === 'personal';

    const filter = {};
    if (isPersonal) {
      filter.userId = req.user._id;
      filter.workspaceId = null;
    } else {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
      }
      if (!isWorkspaceMember(workspace, req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied to this workspace' });
      }
      filter.workspaceId = workspace._id;
    }

    const collections = await NoteCollection.find(filter).sort({ name: 1 });

    // Aggregate note counts per collection in this scope (excluding trashed notes)
    const noteCounts = await Note.aggregate([
      {
        $match: {
          ...(isPersonal ? { userId: req.user._id, workspaceId: null } : { workspaceId: filter.workspaceId }),
          isTrashed: false,
          collectionId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$collectionId',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    noteCounts.forEach((nc) => {
      countMap[nc._id.toString()] = nc.count;
    });

    const data = collections.map((col) => ({
      ...col.toObject(),
      noteCount: countMap[col._id.toString()] || 0,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new note collection
// @route   POST /api/note-collections
// @access  Private
export const createNoteCollection = async (req, res, next) => {
  try {
    const { name, color, icon, workspaceId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Collection name is required' });
    }

    const isPersonal = !workspaceId || workspaceId === 'personal';
    let targetWorkspaceId = null;

    if (!isPersonal) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
      }
      if (workspace.isArchived) {
        return res.status(400).json({ success: false, message: 'Cannot create collections in an archived workspace' });
      }
      if (!isWorkspaceMember(workspace, req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied to this workspace' });
      }
      targetWorkspaceId = workspace._id;
    }

    const collection = await NoteCollection.create({
      name: name.trim(),
      color: color || '#6366F1',
      icon: icon || 'folder',
      userId: req.user._id,
      workspaceId: targetWorkspaceId,
    });

    return res.status(201).json({
      success: true,
      data: {
        ...collection.toObject(),
        noteCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a note collection
// @route   PUT /api/note-collections/:id
// @access  Private
export const updateNoteCollection = async (req, res, next) => {
  try {
    const { name, color, icon } = req.body;
    const collection = await NoteCollection.findById(req.params.id);

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    if (collection.workspaceId) {
      const workspace = await Workspace.findById(collection.workspaceId);
      if (!workspace || !isWorkspaceMember(workspace, req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (workspace.isArchived) {
        return res.status(400).json({ success: false, message: 'Workspace is archived' });
      }
    } else {
      if (collection.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    if (name !== undefined) collection.name = name.trim();
    if (color !== undefined) collection.color = color;
    if (icon !== undefined) collection.icon = icon;

    await collection.save();

    return res.status(200).json({ success: true, data: collection });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a note collection safely (unfiles notes without deleting them)
// @route   DELETE /api/note-collections/:id
// @access  Private
export const deleteNoteCollection = async (req, res, next) => {
  try {
    const collection = await NoteCollection.findById(req.params.id);

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    if (collection.workspaceId) {
      const workspace = await Workspace.findById(collection.workspaceId);
      if (!workspace || !canManageWorkspace(workspace, req.user._id)) {
        return res.status(403).json({ success: false, message: 'Only workspace owners/admins can delete collections' });
      }
    } else {
      if (collection.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Safely unfile all notes in this collection rather than deleting them
    await Note.updateMany(
      { collectionId: collection._id },
      { $set: { collectionId: null } }
    );

    await NoteCollection.findByIdAndDelete(collection._id);

    return res.status(200).json({
      success: true,
      message: 'Collection deleted and associated notes safely moved to unfiled',
    });
  } catch (error) {
    next(error);
  }
};
