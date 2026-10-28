/**
 * Centralized Workspace and Collaborative Task Authorization Rules
 *
 * Enforces role boundaries:
 * - Owner: full control, transfer ownership, settings, archive, restore, delete.
 * - Admin: manage invitations & members, workspace settings, organize tasks. Cannot transfer, archive, or delete.
 * - Member: view shared tasks, create tasks, comment, complete assigned tasks, edit tasks created or assigned.
 *   Cannot edit tasks they neither created nor are assigned to. Cannot delete others' tasks.
 * - Viewer: read-only access to shared tasks and calendar.
 */

/**
 * Resolve a user's role within a workspace.
 * @param {Object} workspace - Workspace document or lean object
 * @param {string|ObjectId} userId - User ID to inspect
 * @returns {string|null} 'owner' | 'admin' | 'member' | 'viewer' | null
 */
export const getUserRole = (workspace, userId) => {
  if (!workspace || !userId) return null;
  const uIdStr = userId._id ? userId._id.toString() : userId.toString();

  const ownerIdStr = workspace.owner?._id
    ? workspace.owner._id.toString()
    : workspace.owner?.toString();
  if (ownerIdStr && ownerIdStr === uIdStr) {
    return 'owner';
  }

  const member = (workspace.members || []).find((m) => {
    const memberId = m.user?._id ? m.user._id.toString() : m.user?.toString();
    return memberId === uIdStr;
  });

  return member ? member.role || 'member' : null;
};

export const isWorkspaceMember = (workspace, userId) => {
  return getUserRole(workspace, userId) !== null;
};

export const canManageWorkspace = (workspace, userId) => {
  const role = getUserRole(workspace, userId);
  return role === 'owner' || role === 'admin';
};

export const canInviteMembers = (workspace, userId) => {
  if (workspace?.isArchived) return false;
  const role = getUserRole(workspace, userId);
  return role === 'owner' || role === 'admin';
};

export const canChangeRole = (workspace, actorId, targetUserId, newRole) => {
  if (workspace?.isArchived) return false;
  const actorRole = getUserRole(workspace, actorId);
  const targetRole = getUserRole(workspace, targetUserId);

  if (!actorRole || !targetRole) return false;
  if (!['admin', 'member', 'viewer'].includes(newRole)) return false;

  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();
  const targetIdStr = targetUserId._id ? targetUserId._id.toString() : targetUserId.toString();

  // Target cannot be the owner (ownership transfer has its own endpoint)
  if (targetRole === 'owner') return false;

  // Owner can change any member/admin role
  if (actorRole === 'owner') return true;

  // Admin can change roles between member and viewer only (cannot promote to admin or demote another admin)
  if (actorRole === 'admin') {
    if (targetRole === 'admin') return false; // Admins cannot alter other admins
    if (newRole === 'admin') return false; // Admins cannot promote anyone to admin
    return ['member', 'viewer'].includes(newRole);
  }

  return false;
};

export const canRemoveMember = (workspace, actorId, targetUserId) => {
  if (workspace?.isArchived) return false;
  const actorRole = getUserRole(workspace, actorId);
  const targetRole = getUserRole(workspace, targetUserId);

  if (!actorRole || !targetRole) return false;

  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();
  const targetIdStr = targetUserId._id ? targetUserId._id.toString() : targetUserId.toString();

  // Owner cannot be removed by anyone; owner must transfer ownership first or delete workspace
  if (targetRole === 'owner') return false;

  // Voluntary departure (member leaving on their own)
  if (actorIdStr === targetIdStr) {
    return targetRole !== 'owner';
  }

  // Owner can remove anyone except self
  if (actorRole === 'owner') return true;

  // Admin can remove members or viewers (cannot remove owner or another admin)
  if (actorRole === 'admin') {
    return targetRole === 'member' || targetRole === 'viewer';
  }

  return false;
};

export const canTransferOwnership = (workspace, actorId, newOwnerId) => {
  if (workspace?.isArchived) return false;
  const actorRole = getUserRole(workspace, actorId);
  if (actorRole !== 'owner') return false;

  const newOwnerRole = getUserRole(workspace, newOwnerId);
  if (!newOwnerRole) return false; // Target must already be an active member

  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();
  const newOwnerIdStr = newOwnerId._id ? newOwnerId._id.toString() : newOwnerId.toString();

  return actorIdStr !== newOwnerIdStr;
};

export const canArchiveWorkspace = (workspace, actorId) => {
  return getUserRole(workspace, actorId) === 'owner';
};

export const canDeleteWorkspace = (workspace, actorId) => {
  return getUserRole(workspace, actorId) === 'owner';
};

export const canCreateTask = (workspace, actorId) => {
  if (!workspace) return true; // Personal tasks
  if (workspace.isArchived) return false;
  const role = getUserRole(workspace, actorId);
  return role === 'owner' || role === 'admin' || role === 'member';
};

export const canEditTask = (task, workspace, actorId) => {
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();

  // Personal task
  if (!task.workspaceId) {
    const taskOwnerIdStr = task.userId?._id ? task.userId._id.toString() : task.userId?.toString();
    return taskOwnerIdStr === actorIdStr;
  }

  if (workspace?.isArchived) return false;

  const role = getUserRole(workspace, actorId);
  if (!role || role === 'viewer') return false;

  // Owner and Admin can edit any workspace task
  if (role === 'owner' || role === 'admin') return true;

  // Member can edit if creator or assigned
  if (role === 'member') {
    const creatorIdStr = task.userId?._id ? task.userId._id.toString() : task.userId?.toString();
    if (creatorIdStr === actorIdStr) return true;

    // Check multiple assignees
    if (Array.isArray(task.assignees)) {
      const isAssigned = task.assignees.some((a) => {
        const aStr = a?._id ? a._id.toString() : a?.toString();
        return aStr === actorIdStr;
      });
      if (isAssigned) return true;
    }

    // Legacy single assignedTo fallback
    const legacyAssigneeStr = task.assignedTo?._id ? task.assignedTo._id.toString() : task.assignedTo?.toString();
    if (legacyAssigneeStr === actorIdStr) return true;
  }

  return false;
};

export const canDeleteTask = (task, workspace, actorId) => {
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();

  // Personal task
  if (!task.workspaceId) {
    const taskOwnerIdStr = task.userId?._id ? task.userId._id.toString() : task.userId?.toString();
    return taskOwnerIdStr === actorIdStr;
  }

  if (workspace?.isArchived) return false;

  const role = getUserRole(workspace, actorId);
  if (!role || role === 'viewer') return false;

  // Owner and Admin can delete any workspace task
  if (role === 'owner' || role === 'admin') return true;

  // Member can delete ONLY tasks they created
  if (role === 'member') {
    const creatorIdStr = task.userId?._id ? task.userId._id.toString() : task.userId?.toString();
    return creatorIdStr === actorIdStr;
  }

  return false;
};

export const canCompleteTask = (task, workspace, actorId) => {
  return canEditTask(task, workspace, actorId);
};

export const canAssignTask = (task, workspace, actorId, newAssigneeIds = []) => {
  if (workspace?.isArchived) return false;
  const role = getUserRole(workspace, actorId);
  if (!role || role === 'viewer') return false;

  // Owners and Admins can assign/reassign any task
  if (role === 'owner' || role === 'admin') return true;

  // Members can assign when creating, or edit assignees if they created the task
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();
  const creatorIdStr = task.userId?._id ? task.userId._id.toString() : task.userId?.toString();
  return creatorIdStr === actorIdStr;
};

export const canCommentOnTask = (task, workspace, actorId) => {
  if (workspace?.isArchived) return false;
  const role = getUserRole(workspace, actorId);
  return role !== null; // Any active member, viewer, admin, or owner can comment
};

export const canEditComment = (comment, task, workspace, actorId) => {
  if (workspace?.isArchived) return false;
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();
  const authorIdStr = comment.userId?._id ? comment.userId._id.toString() : comment.userId?.toString();
  return authorIdStr === actorIdStr;
};

export const canDeleteComment = (comment, task, workspace, actorId) => {
  if (workspace?.isArchived) return false;
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();
  const authorIdStr = comment.userId?._id ? comment.userId._id.toString() : comment.userId?.toString();

  // Author can delete their own comment
  if (authorIdStr === actorIdStr) return true;

  // Workspace owner/admin can moderate/delete any comment
  const role = getUserRole(workspace, actorId);
  return role === 'owner' || role === 'admin';
};

// ---------------------------------------------------------------------------
// Notes Authorization Rules
// ---------------------------------------------------------------------------

export const canViewNote = (note, workspace, actorId) => {
  if (!note) return false;
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();

  // Personal note
  if (!note.workspaceId) {
    const ownerIdStr = note.userId?._id ? note.userId._id.toString() : note.userId?.toString();
    return ownerIdStr === actorIdStr;
  }

  // Workspace note
  if (!workspace) return false;
  return isWorkspaceMember(workspace, actorId);
};

export const canCreateNote = (workspace, actorId) => {
  if (!workspace) return true; // Personal notes
  if (workspace.isArchived) return false;
  const role = getUserRole(workspace, actorId);
  return role === 'owner' || role === 'admin' || role === 'member';
};

export const canEditNote = (note, workspace, actorId) => {
  if (!note) return false;
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();

  // Personal note
  if (!note.workspaceId) {
    const ownerIdStr = note.userId?._id ? note.userId._id.toString() : note.userId?.toString();
    return ownerIdStr === actorIdStr;
  }

  // Workspace note
  if (workspace?.isArchived) return false;
  const role = getUserRole(workspace, actorId);
  if (!role || role === 'viewer') return false;

  // Owner, admin, or member can edit workspace notes
  return role === 'owner' || role === 'admin' || role === 'member';
};

export const canArchiveNote = (note, workspace, actorId) => {
  return canEditNote(note, workspace, actorId);
};

export const canRestoreNote = (note, workspace, actorId) => {
  return canEditNote(note, workspace, actorId);
};

export const canTrashNote = (note, workspace, actorId) => {
  if (!note) return false;
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();

  // Personal note
  if (!note.workspaceId) {
    const ownerIdStr = note.userId?._id ? note.userId._id.toString() : note.userId?.toString();
    return ownerIdStr === actorIdStr;
  }

  // Workspace note
  if (workspace?.isArchived) return false;
  const role = getUserRole(workspace, actorId);
  if (!role || role === 'viewer') return false;

  if (role === 'owner' || role === 'admin') return true;

  // Members can trash notes they created
  const authorIdStr = note.userId?._id ? note.userId._id.toString() : note.userId?.toString();
  return authorIdStr === actorIdStr;
};

export const canDeleteNotePermanently = (note, workspace, actorId) => {
  return canTrashNote(note, workspace, actorId);
};

export const canManageNoteCollection = (collection, workspace, actorId) => {
  if (!collection) return false;
  const actorIdStr = actorId._id ? actorId._id.toString() : actorId.toString();

  // Personal collection
  if (!collection.workspaceId) {
    const ownerIdStr = collection.userId?._id ? collection.userId._id.toString() : collection.userId?.toString();
    return ownerIdStr === actorIdStr;
  }

  // Workspace collection
  if (workspace?.isArchived) return false;
  const role = getUserRole(workspace, actorId);
  return role === 'owner' || role === 'admin';
};
