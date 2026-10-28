import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Note must have an author/owner'],
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
      set: (v) => (v === '' || v === 'personal' || !v ? null : v),
    },
    title: {
      type: String,
      default: 'Untitled Note',
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    // Structured rich-text document shape (TipTap JSON or sanitized HTML string)
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ type: 'doc', content: [] }),
    },
    // Plain text representation for high-performance card preview and keyword search
    plainTextPreview: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Preview cannot exceed 1000 characters'],
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    isTrashed: {
      type: Boolean,
      default: false,
      index: true,
    },
    trashedAt: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NoteCollection',
      default: null,
      index: true,
      set: (v) => (v === '' || v === 'unfiled' || !v ? null : v),
    },
    linkedTasks: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Task',
        },
      ],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal performance across personal and collaborative queries
noteSchema.index({ userId: 1, workspaceId: 1, isTrashed: 1, isArchived: 1, isPinned: -1, updatedAt: -1 });
noteSchema.index({ workspaceId: 1, isTrashed: 1, isArchived: 1, isPinned: -1, updatedAt: -1 });
noteSchema.index({ collectionId: 1, isTrashed: 1, isArchived: 1 });
noteSchema.index({ title: 'text', plainTextPreview: 'text', tags: 'text' });

const Note = mongoose.model('Note', noteSchema);

export default Note;
