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
      },
      until: {
        type: Date,
        default: null,
      },
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
  // Normalize subtasks if array of strings or invalid objects
  if (Array.isArray(this.subtasks)) {
    this.subtasks = this.subtasks
      .map((st) => {
        if (typeof st === 'string') return { title: st, completed: false };
        if (st && typeof st === 'object') return { title: st.title || '', completed: !!st.completed };
        return { title: '', completed: false };
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

const Task = mongoose.model('Task', taskSchema);

export default Task;
