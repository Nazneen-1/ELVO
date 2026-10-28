import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: [100, 'Habit name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    color: {
      type: String,
      default: '#6366F1',
    },
    icon: {
      type: String,
      default: 'check',
    },
    schedule: {
      type: {
        type: String,
        enum: ['daily', 'weekdays', 'custom'],
        default: 'daily',
      },
      // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
      daysOfWeek: {
        type: [Number],
        default: [0, 1, 2, 3, 4, 5, 6],
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length > 0 && v.every((d) => d >= 0 && d <= 6);
          },
          message: 'Habit must be scheduled on at least one valid day of the week (0-6)',
        },
      },
    },
    sortOrder: {
      type: Number,
      default: 0,
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
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user habits querying and sorting
habitSchema.index({ userId: 1, isArchived: 1, sortOrder: 1 });
habitSchema.index({ userId: 1, createdAt: -1 });

const Habit = mongoose.model('Habit', habitSchema);

export default Habit;
