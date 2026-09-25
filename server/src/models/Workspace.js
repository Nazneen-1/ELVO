import mongoose from 'mongoose';
import crypto from 'crypto';

const workspaceMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member', 'viewer'],
    default: 'member',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
      maxlength: [60, 'Workspace name cannot exceed 60 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: [workspaceMemberSchema],
    inviteCode: {
      type: String,
      unique: true,
      index: true,
    },
    color: {
      type: String,
      enum: ['indigo', 'purple', 'emerald', 'amber', 'rose', 'sky', 'teal', 'blue'],
      default: 'indigo',
    },
    icon: {
      type: String,
      default: 'Briefcase',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate invite code on workspace creation
workspaceSchema.pre('save', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = crypto.randomBytes(6).toString('hex').toUpperCase();
  }
  next();
});

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
