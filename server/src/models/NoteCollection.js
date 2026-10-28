import mongoose from 'mongoose';

const noteCollectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
      maxlength: [60, 'Collection name cannot exceed 60 characters'],
    },
    color: {
      type: String,
      default: '#6366F1',
      trim: true,
    },
    icon: {
      type: String,
      default: 'folder',
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Collection must belong to a user'],
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
      set: (v) => (v === '' || v === 'personal' || !v ? null : v),
    },
  },
  {
    timestamps: true,
  }
);

noteCollectionSchema.index({ userId: 1, workspaceId: 1, name: 1 });

const NoteCollection = mongoose.model('NoteCollection', noteCollectionSchema);

export default NoteCollection;
