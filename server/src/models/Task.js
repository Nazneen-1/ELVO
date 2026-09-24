import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task must belong to a user'],
      index: true,
    },
    // Future workspace support (optional, defaults to null for personal tasks)
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    startDate: {
      type: Date,
      required: [true, 'Task start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    startTime: {
      type: String, // e.g., "14:30"
      default: null,
    },
    endTime: {
      type: String, // e.g., "15:30"
      default: null,
    },
    isAllDay: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    color: {
      type: String,
      enum: ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'],
      default: 'indigo',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to optimize month-view and date-range queries for a specific user
taskSchema.index({ userId: 1, startDate: 1, status: 1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;
