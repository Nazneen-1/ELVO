import crypto from 'crypto';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import { sendWorkspaceInviteEmail } from '../utils/emailService.js';
import {
  getUserRole,
  isWorkspaceMember,
  canManageWorkspace,
  canInviteMembers,
  canChangeRole,
  canRemoveMember,
  canTransferOwnership,
  canArchiveWorkspace,
  canDeleteWorkspace,
} from '../utils/workspaceAuth.js';

// Helper to record activity on a workspace
const addActivityLog = (workspace, { action, details, user, userName, metadata = {} }) => {
  if (!workspace.activity) workspace.activity = [];
  workspace.activity.push({
    action,
    details: details || '',
    user: user || null,
    userName: userName || '',
    metadata,
    timestamp: new Date(),
  });
};

// @desc    Get all workspaces for the current user
// @route   GET /api/workspaces
// @access  Private
export const getWorkspaces = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { includeArchived } = req.query;

    const query = {
      $or: [{ owner: userId }, { 'members.user': userId }],
    };

    if (includeArchived !== 'true') {
      query.isArchived = { $ne: true };
    }

    const workspaces = await Workspace.find(query)
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
      inviteCodeActive: true,
      activity: [
        {
          action: 'Workspace created',
          details: `Workspace created by ${req.user.name}`,
          user: req.user._id,
          userName: req.user.name,
          timestamp: new Date(),
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
      .populate('members.user', 'name email')
      .populate('invitations.invitedBy', 'name email');

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

// @desc    Update workspace settings
// @route   PUT /api/workspaces/:id
// @access  Private (Owner / Admin)
export const updateWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    if (!canManageWorkspace(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can update settings',
      });
    }

    const { name, description, color, icon } = req.body;
    if (name) workspace.name = name.trim();
    if (description !== undefined) workspace.description = description;
    if (color) workspace.color = color;
    if (icon) workspace.icon = icon;

    addActivityLog(workspace, {
      action: 'Workspace settings updated',
      details: `Settings updated by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

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

// @desc    Join workspace with join code
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

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived and not accepting new members',
      });
    }

    if (workspace.inviteCodeActive === false) {
      return res.status(400).json({
        success: false,
        message: 'This invite code is inactive or revoked',
      });
    }

    if (workspace.inviteCodeExpiresAt && new Date(workspace.inviteCodeExpiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This invite code has expired',
      });
    }

    if (isWorkspaceMember(workspace, req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this workspace',
      });
    }

    workspace.members.push({
      user: req.user._id,
      role: 'member',
      joinedAt: new Date(),
    });

    addActivityLog(workspace, {
      action: 'Member joined',
      details: `${req.user.name} joined via join code`,
      user: req.user._id,
      userName: req.user.name,
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

// @desc    Regenerate workspace join code
// @route   POST /api/workspaces/:id/join-code/regenerate
// @access  Private (Owner / Admin)
export const regenerateJoinCode = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    if (!canManageWorkspace(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can regenerate join codes',
      });
    }

    const { expiresInDays } = req.body;
    workspace.inviteCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    workspace.inviteCodeActive = true;
    if (expiresInDays && Number(expiresInDays) > 0) {
      workspace.inviteCodeExpiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000);
    } else {
      workspace.inviteCodeExpiresAt = null;
    }

    addActivityLog(workspace, {
      action: 'Join code regenerated',
      details: `Join code regenerated by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: 'Join code regenerated successfully',
      data: {
        inviteCode: workspace.inviteCode,
        inviteCodeActive: workspace.inviteCodeActive,
        inviteCodeExpiresAt: workspace.inviteCodeExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke or toggle workspace join code
// @route   POST /api/workspaces/:id/join-code/revoke
// @access  Private (Owner / Admin)
export const revokeJoinCode = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    if (!canManageWorkspace(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can revoke join codes',
      });
    }

    const { active } = req.body;
    workspace.inviteCodeActive = active !== undefined ? Boolean(active) : false;

    addActivityLog(workspace, {
      action: workspace.inviteCodeActive ? 'Join code reactivated' : 'Join code revoked',
      details: `Join code ${workspace.inviteCodeActive ? 'reactivated' : 'revoked'} by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: `Join code ${workspace.inviteCodeActive ? 'reactivated' : 'revoked'} successfully`,
      data: {
        inviteCodeActive: workspace.inviteCodeActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create an email invitation
// @route   POST /api/workspaces/:id/invitations
// @access  Private (Owner / Admin)
export const createInvitation = async (req, res, next) => {
  try {
    const { email, role = 'member' } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const assignedRole = ['admin', 'member', 'viewer'].includes(role) ? role : 'member';

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    if (!canInviteMembers(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can invite members',
      });
    }

    // Check if user is already a member
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser && isWorkspaceMember(workspace, existingUser._id)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this workspace',
      });
    }

    // Check if there is already a pending invitation for this email
    if (!workspace.invitations) workspace.invitations = [];
    const activePending = workspace.invitations.find(
      (inv) => inv.email === cleanEmail && inv.status === 'pending' && new Date(inv.expiresAt) > new Date()
    );
    if (activePending) {
      return res.status(400).json({
        success: false,
        message: 'A pending invitation already exists for this email address',
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = {
      email: cleanEmail,
      role: assignedRole,
      token,
      status: 'pending',
      invitedBy: req.user._id,
      invitedAt: new Date(),
      expiresAt,
    };

    workspace.invitations.push(invitation);

    addActivityLog(workspace, {
      action: 'Invitation created',
      details: `Invited ${cleanEmail} as ${assignedRole} by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
      metadata: { email: cleanEmail, role: assignedRole },
    });

    await workspace.save();

    // Send email notification if possible
    try {
      await sendWorkspaceInviteEmail({
        toEmail: cleanEmail,
        toName: existingUser?.name || cleanEmail,
        inviterName: req.user.name,
        workspaceName: workspace.name,
        inviteCode: workspace.inviteCode,
        role: assignedRole,
        inviteToken: token,
      });
    } catch (mailErr) {
      console.warn('Failed to send invitation email:', mailErr.message);
    }

    if (existingUser) {
      await Notification.create({
        userId: existingUser._id,
        title: 'Workspace Invitation',
        message: `${req.user.name} invited you to join workspace "${workspace.name}"`,
        type: 'workspace_invite',
        relatedWorkspaceId: workspace._id,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Invitation sent to ${cleanEmail}`,
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept email invitation
// @route   POST /api/workspaces/invitations/:token/accept
// @access  Private
export const acceptInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;

    const workspace = await Workspace.findOne({
      'invitations.token': token,
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation token' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'This workspace is archived and not accepting new members',
      });
    }

    const invitation = workspace.invitations.find((inv) => inv.token === token);
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This invitation is already ${invitation.status}`,
      });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      await workspace.save();
      return res.status(400).json({
        success: false,
        message: 'This invitation has expired',
      });
    }

    if (isWorkspaceMember(workspace, req.user._id)) {
      invitation.status = 'accepted';
      await workspace.save();
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this workspace',
      });
    }

    // Add user as member with the role specified in the invitation
    workspace.members.push({
      user: req.user._id,
      role: invitation.role || 'member',
      joinedAt: new Date(),
    });

    invitation.status = 'accepted';

    addActivityLog(workspace, {
      action: 'Member joined via invite',
      details: `${req.user.name} accepted invitation as ${invitation.role}`,
      user: req.user._id,
      userName: req.user.name,
      metadata: { role: invitation.role },
    });

    await workspace.save();

    // Notify workspace owner
    await Notification.create({
      userId: workspace.owner,
      title: 'Invitation Accepted',
      message: `${req.user.name} accepted your invitation to "${workspace.name}"`,
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

// @desc    Decline email invitation
// @route   POST /api/workspaces/invitations/:token/decline
// @access  Private
export const declineInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;

    const workspace = await Workspace.findOne({
      'invitations.token': token,
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Invalid invitation token' });
    }

    const invitation = workspace.invitations.find((inv) => inv.token === token);
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This invitation is already ${invitation.status}`,
      });
    }

    invitation.status = 'declined';

    addActivityLog(workspace, {
      action: 'Invitation declined',
      details: `Invitation for ${invitation.email} was declined`,
      user: req.user._id,
      userName: req.user.name,
    });

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: 'Invitation declined successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke an invitation
// @route   DELETE /api/workspaces/:id/invitations/:invitationId
// @access  Private (Owner / Admin)
export const revokeInvitation = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    if (!canInviteMembers(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can revoke invitations',
      });
    }

    const targetInvId = req.params.invitationId || req.params.token || req.body?.token;
    const invitation = (workspace.invitations || []).find(
      (inv) => (inv._id && inv._id.toString() === targetInvId) || inv.token === targetInvId
    );
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    invitation.status = 'revoked';

    addActivityLog(workspace, {
      action: 'Invitation revoked',
      details: `Invitation for ${invitation.email} revoked by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Invite member by email directly (legacy compatibility wrapper)
// @route   POST /api/workspaces/:id/members
// @access  Private (Owner / Admin)
export const inviteMember = async (req, res, next) => {
  return createInvitation(req, res, next);
};

// @desc    Update member role
// @route   PUT /api/workspaces/:id/members/:userId/role
// @access  Private (Owner / Admin within boundaries)
export const updateMemberRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.userId;

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Supported roles: 'admin', 'member', 'viewer'",
      });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    if (!canChangeRole(workspace, req.user._id, targetUserId, role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to change this member role or escalate privileges',
      });
    }

    const member = workspace.members.find(
      (m) => m.user.toString() === targetUserId.toString()
    );

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found in workspace' });
    }

    const prevRole = member.role;
    member.role = role;

    addActivityLog(workspace, {
      action: 'Role updated',
      details: `Role for member changed from ${prevRole} to ${role} by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
      metadata: { targetUserId, prevRole, newRole: role },
    });

    await workspace.save();

    await Notification.create({
      userId: targetUserId,
      title: 'Workspace Role Updated',
      message: `Your role in "${workspace.name}" was changed to ${role}`,
      type: 'workspace_invite',
      relatedWorkspaceId: workspace._id,
    });

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Member role updated successfully',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Transfer workspace ownership
// @route   POST /api/workspaces/:id/transfer-ownership
// @access  Private (Owner only)
export const transferOwnership = async (req, res, next) => {
  try {
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ success: false, message: 'New owner user ID is required' });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    if (getUserRole(workspace, req.user._id) !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only the current workspace owner can transfer ownership',
      });
    }

    if (!isWorkspaceMember(workspace, newOwnerId)) {
      return res.status(400).json({
        success: false,
        message: 'Target user must be an active member of this workspace to become owner',
      });
    }

    if (!canTransferOwnership(workspace, req.user._id, newOwnerId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer ownership to this user',
      });
    }

    const newOwnerUser = await User.findById(newOwnerId);
    if (!newOwnerUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    const prevOwnerId = workspace.owner;

    // Previous owner becomes an admin (safeguard against owner lockout)
    const prevOwnerMember = workspace.members.find(
      (m) => m.user.toString() === prevOwnerId.toString()
    );
    if (prevOwnerMember) {
      prevOwnerMember.role = 'admin';
    } else {
      workspace.members.push({ user: prevOwnerId, role: 'admin' });
    }

    // New owner becomes owner
    workspace.owner = newOwnerId;
    const newOwnerMember = workspace.members.find(
      (m) => m.user.toString() === newOwnerId.toString()
    );
    if (newOwnerMember) {
      newOwnerMember.role = 'owner';
    } else {
      workspace.members.push({ user: newOwnerId, role: 'owner' });
    }

    addActivityLog(workspace, {
      action: 'ownership_transferred',
      details: `Workspace ownership transferred from ${req.user.name} to ${newOwnerUser.name}`,
      user: req.user._id,
      userName: req.user.name,
      metadata: { prevOwnerId, newOwnerId },
    });

    await workspace.save();

    await Notification.create({
      userId: newOwnerId,
      title: 'Ownership Transferred',
      message: `You are now the owner of workspace "${workspace.name}"`,
      type: 'workspace_invite',
      relatedWorkspaceId: workspace._id,
    });

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(200).json({
      success: true,
      message: `Workspace ownership successfully transferred to ${newOwnerUser.name}`,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from workspace / voluntary departure (with optional task reassignment)
// @route   DELETE /api/workspaces/:id/members/:userId
// @access  Private (Owner / Admin / Self)
export const removeMember = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (workspace.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is archived. Restore the workspace to make changes.',
      });
    }

    const targetUserId = req.params.userId;
    const isSelf = targetUserId.toString() === req.user._id.toString();

    if (!canRemoveMember(workspace, req.user._id, targetUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this member',
      });
    }

    const reassignTo = req.body?.reassignTo || req.query?.reassignTo;
    let targetReassignee = null;
    if (reassignTo) {
      if (!isWorkspaceMember(workspace, reassignTo)) {
        return res.status(400).json({
          success: false,
          message: 'Target reassignee is not an active member of this workspace',
        });
      }
      targetReassignee = reassignTo;
    }

    // Handle collaborative tasks assigned to departing member
    // Find all collaborative tasks in this workspace where target is in assignees or assignedTo
    const affectedTasks = await Task.find({
      workspaceId: workspace._id,
      $or: [
        { assignees: targetUserId },
        { assignedTo: targetUserId },
        { 'subtasks.assignee': targetUserId },
      ],
    });

    for (const task of affectedTasks) {
      // Clean assignees
      task.assignees = (task.assignees || []).filter(
        (a) => a.toString() !== targetUserId.toString()
      );

      if (targetReassignee) {
        const alreadyIn = task.assignees.some(
          (a) => a.toString() === targetReassignee.toString()
        );
        if (!alreadyIn) {
          task.assignees.push(targetReassignee);
        }
      }

      task.assignedTo = task.assignees[0] || null;

      // Clean subtask assignees
      if (Array.isArray(task.subtasks)) {
        task.subtasks.forEach((st) => {
          if (st.assignee && st.assignee.toString() === targetUserId.toString()) {
            st.assignee = targetReassignee || null;
          }
        });
      }

      if (!task.activity) task.activity = [];
      task.activity.push({
        action: 'Member departure reassignment',
        details: targetReassignee
          ? `Tasks reassigned from departed member to ${targetReassignee}`
          : 'Departed member unassigned from task',
        timestamp: new Date(),
      });

      await task.save();
    }

    // Remove from workspace members
    workspace.members = workspace.members.filter(
      (m) => m.user.toString() !== targetUserId.toString()
    );

    addActivityLog(workspace, {
      action: isSelf ? 'Member left' : 'Member removed',
      details: isSelf
        ? `${req.user.name} left the workspace`
        : `Member ${targetUserId} removed by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
      metadata: { targetUserId, reassignTo: targetReassignee },
    });

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: isSelf ? 'You have left the workspace' : 'Member removed successfully',
      reassignedCount: affectedTasks.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive workspace
// @route   POST /api/workspaces/:id/archive
// @access  Private (Owner only)
export const archiveWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (!canArchiveWorkspace(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner can archive the workspace',
      });
    }

    if (workspace.isArchived) {
      return res.status(400).json({ success: false, message: 'Workspace is already archived' });
    }

    workspace.isArchived = true;
    workspace.archivedAt = new Date();
    workspace.archivedBy = req.user._id;

    addActivityLog(workspace, {
      action: 'workspace_archived',
      details: `Workspace archived by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    await workspace.save();

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Workspace archived successfully',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore archived workspace
// @route   POST /api/workspaces/:id/restore
// @access  Private (Owner only)
export const restoreWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (!canArchiveWorkspace(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner can restore an archived workspace',
      });
    }

    if (!workspace.isArchived) {
      return res.status(400).json({ success: false, message: 'Workspace is not archived' });
    }

    workspace.isArchived = false;
    workspace.archivedAt = null;
    workspace.archivedBy = null;

    addActivityLog(workspace, {
      action: 'workspace_restored',
      details: `Workspace restored by ${req.user.name}`,
      user: req.user._id,
      userName: req.user.name,
    });

    await workspace.save();

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Workspace restored successfully',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get workspace activity log
// @route   GET /api/workspaces/:id/activity
// @access  Private (Workspace members only)
export const getWorkspaceActivity = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (!isWorkspaceMember(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: you are not a member of this workspace',
      });
    }

    const activity = (workspace.activity || []).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    return res.status(200).json({
      success: true,
      count: activity.length,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete workspace (Owner only)
// @route   DELETE /api/workspaces/:id
// @access  Private (Owner only)
export const deleteWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (!canDeleteWorkspace(workspace, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner can delete the workspace',
      });
    }

    // Unlink tasks belonging to this workspace
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
