import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import { sendWorkspaceInviteEmail } from '../utils/emailService.js';

// @desc    Get all workspaces for the current user
// @route   GET /api/workspaces
// @access  Private
export const getWorkspaces = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const workspaces = await Workspace.find({
      $or: [{ owner: userId }, { 'members.user': userId }],
    })
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: workspaces.length,
      data: workspaces,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new workspace
// @route   POST /api/workspaces
// @access  Private
export const createWorkspace = async (req, res, next) => {
  try {
    const { name, description, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required',
      });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description: description || '',
      color: color || 'indigo',
      icon: icon || 'Briefcase',
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          role: 'owner',
        },
      ],
    });

    const populatedWorkspace = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(201).json({
      success: true,
      data: populatedWorkspace,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get workspace details by ID
// @route   GET /api/workspaces/:id
// @access  Private
export const getWorkspaceById = async (req, res, next) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    })
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or access denied',
      });
    }

    return res.status(200).json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update workspace
// @route   PUT /api/workspaces/:id
// @access  Private (Owner / Admin)
export const updateWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const isOwner = workspace.owner.toString() === req.user._id.toString();
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only workspace admins can update settings' });
    }

    const { name, description, color, icon } = req.body;
    if (name) workspace.name = name.trim();
    if (description !== undefined) workspace.description = description;
    if (color) workspace.color = color;
    if (icon) workspace.icon = icon;

    await workspace.save();

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(200).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Join workspace with invite code
// @route   POST /api/workspaces/join
// @access  Private
export const joinWorkspace = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ success: false, message: 'Invite code is required' });
    }

    const workspace = await Workspace.findOne({
      inviteCode: inviteCode.trim().toUpperCase(),
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Invalid invite code' });
    }

    const alreadyMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'You are already a member of this workspace' });
    }

    workspace.members.push({
      user: req.user._id,
      role: 'member',
    });

    await workspace.save();

    // Notify workspace owner
    await Notification.create({
      userId: workspace.owner,
      title: 'New Workspace Member',
      message: `${req.user.name} joined ${workspace.name}`,
      type: 'workspace_invite',
      relatedWorkspaceId: workspace._id,
    });

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(200).json({
      success: true,
      message: `Successfully joined ${workspace.name}`,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Invite member by email
// @route   POST /api/workspaces/:id/members
// @access  Private
export const inviteMember = async (req, res, next) => {
  try {
    const { email, role = 'member' } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'User email is required' });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const isOwnerOrAdmin =
      workspace.owner.toString() === req.user._id.toString() ||
      workspace.members.some(
        (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
      );

    if (!isOwnerOrAdmin) {
      return res.status(403).json({ success: false, message: 'Only admins can invite members' });
    }

    const targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'No registered user found with that email address',
      });
    }

    const isAlreadyMember = workspace.members.some(
      (m) => m.user.toString() === targetUser._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({ success: false, message: 'User is already a member of this workspace' });
    }

    workspace.members.push({
      user: targetUser._id,
      role: ['admin', 'member', 'viewer'].includes(role) ? role : 'member',
    });

    await workspace.save();

    // Create in-app notification for invited user
    await Notification.create({
      userId: targetUser._id,
      title: 'Added to Workspace',
      message: `${req.user.name} added you to workspace "${workspace.name}"`,
      type: 'workspace_invite',
      relatedWorkspaceId: workspace._id,
    });

    // Send email invitation to the invited user
    await sendWorkspaceInviteEmail({
      toEmail: targetUser.email,
      toName: targetUser.name,
      inviterName: req.user.name,
      workspaceName: workspace.name,
      inviteCode: workspace.inviteCode,
      role,
    });

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(200).json({
      success: true,
      message: `${targetUser.name} added to workspace`,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from workspace / leave workspace
// @route   DELETE /api/workspaces/:id/members/:userId
// @access  Private
export const removeMember = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const targetUserId = req.params.userId;
    const isSelf = targetUserId === req.user._id.toString();
    const isOwner = workspace.owner.toString() === req.user._id.toString();

    if (targetUserId === workspace.owner.toString()) {
      return res.status(400).json({ success: false, message: 'Workspace owner cannot be removed' });
    }

    if (!isSelf && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to remove this member' });
    }

    workspace.members = workspace.members.filter(
      (m) => m.user.toString() !== targetUserId
    );

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: isSelf ? 'You have left the workspace' : 'Member removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete workspace
// @route   DELETE /api/workspaces/:id
// @access  Private (Owner only)
export const deleteWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only workspace owner can delete the workspace' });
    }

    // Unlink tasks belonging to this workspace or delete
    await Task.updateMany({ workspaceId: workspace._id }, { $set: { workspaceId: null } });
    await Workspace.findByIdAndDelete(workspace._id);

    return res.status(200).json({
      success: true,
      message: 'Workspace deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
