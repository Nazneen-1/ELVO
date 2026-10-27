import mongoose from 'mongoose';

const reminderJobSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskStartDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    taskStartTime: {
      type: String, // HH:mm or null
      default: null,
    },
    isAllDay: {
      type: Boolean,
      default: false,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    occurrenceDate: {
      type: String, // Scheduled date of occurrence YYYY-MM-DD
      default: null,
    },
    originalOccurrenceDate: {
      type: String, // Original series date before rescheduling YYYY-MM-DD
      default: null,
    },
    occurrenceKey: {
      type: String, // 'single' for non-recurring tasks, or originalOccurrenceDate for series occurrences
      required: true,
      default: 'single',
      index: true,
    },
    taskTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    minutesBefore: {
      type: Number,
      required: true,
      default: 15,
    },
    fireTime: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    channelStatus: {
      inApp: {
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed'],
          default: 'pending',
        },
        sentAt: { type: Date, default: null },
        notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', default: null },
        error: { type: String, default: null },
      },
      email: {
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed', 'skipped'],
          default: 'pending',
        },
        sentAt: { type: Date, default: null },
        error: { type: String, default: null },
      },
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    failedReason: {
      type: String,
      default: null,
    },
    nextAttemptAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for queue polling: pending/due jobs and lease expiration
reminderJobSchema.index({ status: 1, fireTime: 1, nextAttemptAt: 1 });
reminderJobSchema.index({ status: 1, lockedAt: 1 });

// Deduplication index: at most one reminder job per task, recipient user, and occurrence key
reminderJobSchema.index(
  { taskId: 1, userId: 1, occurrenceKey: 1 },
  { unique: true }
);

const ReminderJob = mongoose.model('ReminderJob', reminderJobSchema);

export default ReminderJob;
