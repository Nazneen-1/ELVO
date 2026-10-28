import mongoose from 'mongoose';

const subtaskSchema = new mongoose.Schema({
  title: {
    type: String,
    default: '',
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
});

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  userName: {
    type: String,
    default: 'User',
  },
  text: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: null,
  },
});

const activitySchema = new mongoose.Schema({
  action: {
    type: String,
    default: 'Update',
  },
  details: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const recurrenceExceptionSchema = new mongoose.Schema(
  {
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      trim: true,
    },
    rescheduledDate: {
      type: String, // 'YYYY-MM-DD'
      default: null,
      trim: true,
    },
    startTime: {
      type: String,
      default: null,
      trim: true,
    },
    endTime: {
      type: String,
      default: null,
      trim: true,
    },
    isAllDay: {
      type: Boolean,
      default: null,
    },
    action: {
      type: String,
      enum: ['completed', 'cancelled', 'modified', 'skipped', 'rescheduled'],
      default: 'completed',
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done'],
      default: 'Done',
    },
    overrides: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task must belong to a user'],
      index: true,
    },
    // Workspace support (optional, defaults to null for personal tasks)
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
      set: (v) => (v === '' || v === 'personal' || !v ? null : v),
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      set: (v) => (v === '' || v === 'personal' || !v ? null : v),
    },
    assignees: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
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
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    // Core date and optional time fields
    startDate: {
      type: Date,
      required: [true, 'Task startDate is required'],
      default: Date.now,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    // Optional time fields (24‑hour format)
    startTime: {
      type: String,
      default: null,
    },
    endTime: {
      type: String,
      default: null,
    },
    // All‑day flag
    isAllDay: {
      type: Boolean,
      default: false,
    },
    // Status & Priority
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done'],
      default: 'To Do',
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    // Visual color identifier
    color: {
      type: String,
      enum: ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple', 'violet', 'teal', 'orange', 'pink', 'cyan', 'lime', 'fuchsia', 'slate'],
      default: 'indigo',
    },
    // Tags / Labels
    tags: {
      type: [String],
      default: [],
    },
    // Subtasks / Checklist
    subtasks: {
      type: [subtaskSchema],
      default: [],
    },
    // Recurrence settings
    recurrence: {
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly'],
        default: 'none',
      },
      interval: {
        type: Number,
        default: 1,
        min: 1,
      },
      until: {
        type: Date,
        default: null,
      },
    },
    // Recurrence exception overrides and completion state for individual occurrences
    recurrenceExceptions: {
      type: [recurrenceExceptionSchema],
      default: [],
    },
    // Link to master task if this document is a detached/exception occurrence
    recurringMasterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    originalOccurrenceDate: {
      type: String,
      default: null,
    },
    // Reminder settings
    reminder: {
      enabled: {
        type: Boolean,
        default: false,
      },
      minutesBefore: {
        type: Number,
        default: 15,
      },
    },
    // Estimated & Actual Duration in Minutes
    estimatedMinutes: {
      type: Number,
      default: 0,
    },
    actualMinutes: {
      type: Number,
      default: 0,
    },
    // Comments & Activity History
    comments: {
      type: [commentSchema],
      default: [],
    },
    activity: {
      type: [activitySchema],
      default: [],
    },
    // Checkpoint timestamp for Stage 3.4 recurring reminder replenishment
    lastReminderReplenishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Optional source note link
    linkedNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual field to expose `startDate` as `date` for legacy compatibility
taskSchema.virtual('date').get(function () {
  return this.startDate;
});

// Ensure virtuals are included when converting to objects/JSON
taskSchema.set('toObject', { virtuals: true });
taskSchema.set('toJSON', { virtuals: true });

// Pre-validate hook to normalize fields
taskSchema.pre('validate', function(next) {
  // Normalize assignees and sync with legacy assignedTo
  if (Array.isArray(this.assignees)) {
    const seen = new Set();
    const cleanAssignees = [];
    for (const a of this.assignees) {
      if (a && a !== 'personal') {
        const str = a._id ? a._id.toString() : a.toString();
        if (!seen.has(str)) {
          seen.add(str);
          cleanAssignees.push(a);
        }
      }
    }
    this.assignees = cleanAssignees;
    if (this.assignees.length > 0) {
      this.assignedTo = this.assignees[0];
    } else if (this.assignedTo) {
      this.assignees = [this.assignedTo];
    } else {
      this.assignedTo = null;
    }
  } else if (this.assignedTo) {
    this.assignees = [this.assignedTo];
  } else {
    this.assignees = [];
    this.assignedTo = null;
  }

  // Normalize subtasks if array of strings or invalid objects
  if (Array.isArray(this.subtasks)) {
    this.subtasks = this.subtasks
      .map((st) => {
        if (typeof st === 'string') return { title: st, completed: false, assignee: null };
        if (st && typeof st === 'object') {
          return {
            title: st.title || '',
            completed: !!st.completed,
            assignee: st.assignee && st.assignee !== 'personal' ? st.assignee : null,
          };
        }
        return { title: '', completed: false, assignee: null };
      })
      .filter((st) => st.title);
  }

  // Normalize activity if strings
  if (Array.isArray(this.activity)) {
    this.activity = this.activity.map((act) => {
      if (typeof act === 'string') return { action: act, details: '', timestamp: new Date() };
      return act;
    });
  }

  // Normalize status (case-insensitive, map pending/todo/in-progress/done)
  if (this.status) {
    const statusMap = {
      'pending': 'To Do',
      'Pending': 'To Do',
      'todo': 'To Do',
      'to do': 'To Do',
      'To Do': 'To Do',
      'in_progress': 'In Progress',
      'in-progress': 'In Progress',
      'in progress': 'In Progress',
      'In Progress': 'In Progress',
      'done': 'Done',
      'Done': 'Done',
      'completed': 'Done',
    };
    this.status = statusMap[this.status] || (this.status.toLowerCase ? statusMap[this.status.toLowerCase()] : 'To Do') || 'To Do';
  } else {
    this.status = 'To Do';
  }

  // Normalize priority (case-insensitive)
  if (this.priority) {
    const priorityMap = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'Low': 'Low',
      'Medium': 'Medium',
      'High': 'High',
    };
    this.priority = priorityMap[this.priority] || (this.priority.toLowerCase ? priorityMap[this.priority.toLowerCase()] : 'Medium') || 'Medium';
  } else {
    this.priority = 'Medium';
  }

  // Ensure startDate is a valid Date
  if (!this.startDate || isNaN(new Date(this.startDate).getTime())) {
    this.startDate = this.get('date') || this.createdAt || new Date();
  }

  // Clean invalid date objects on optional date fields
  if (this.endDate && isNaN(new Date(this.endDate).getTime())) {
    this.endDate = null;
  }
  if (this.dueDate && isNaN(new Date(this.dueDate).getTime())) {
    this.dueDate = null;
  }

  next();
});

taskSchema.index({ userId: 1, startDate: 1, status: 1 });
taskSchema.index({ workspaceId: 1, startDate: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ userId: 1, 'recurrence.frequency': 1, startDate: 1 });
taskSchema.index({ 'recurrenceExceptions.rescheduledDate': 1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;
