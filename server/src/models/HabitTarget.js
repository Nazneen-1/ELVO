import mongoose from 'mongoose';

const habitTargetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    habitName: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: [100, 'Habit name cannot exceed 100 characters'],
    },
    target: {
      type: String,
      required: [true, 'Target description is required'],
      trim: true,
      maxlength: [200, 'Target cannot exceed 200 characters'],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

habitTargetSchema.index({ userId: 1, sortOrder: 1, createdAt: 1 });

const HabitTarget = mongoose.model('HabitTarget', habitTargetSchema);

export default HabitTarget;
