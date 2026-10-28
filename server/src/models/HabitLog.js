import mongoose from 'mongoose';

const habitLogSchema = new mongoose.Schema(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Calendar date key stored as YYYY-MM-DD to ensure stable local timezone persistence
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique log per habit and calendar date to guarantee idempotency and prevent duplicates
habitLogSchema.index({ habitId: 1, date: 1 }, { unique: true });

// Compound indexes for date-range matrix lookups and user queries
habitLogSchema.index({ userId: 1, date: 1 });
habitLogSchema.index({ userId: 1, habitId: 1, date: 1 });

const HabitLog = mongoose.model('HabitLog', habitLogSchema);

export default HabitLog;
