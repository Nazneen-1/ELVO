import Notification from '../models/Notification.js';
import Workspace from '../models/Workspace.js';
import Task from '../models/Task.js';

/**
 * Verify whether a specific user is authorized to view a workspace.
 */
const verifyUserWorkspaceAccess = async (workspaceId, userId) => {
  if (!workspaceId) return true;
  if (!userId) return false;
  return await Workspace.exists({
    _id: workspaceId,
    $or: [{ owner: userId }, { 'members.user': userId }],
  });
};

/**
 * Send in-app notification when a task is assigned or reassigned to a user.
 * 
 * Safeguards:
 * 1. Suppress self-notification (actor === assignee).
 * 2. Validate assignee has workspace membership if task belongs to a workspace.
 * 3. Idempotency: prevent duplicate unread notifications for the same task and recipient.
 */
export const notifyTaskAssignment = async ({ task, actor, prevAssigneeId = null }) => {
  try {
    if (!task || !task.assignedTo) return null;

    const assigneeIdStr = task.assignedTo.toString();
    const actorIdStr = actor?._id ? actor._id.toString() : null;

    // 1. Suppress self-notification
    if (actorIdStr && assigneeIdStr === actorIdStr) {
      return null;
    }

    // 2. Suppress if assignee did not change
    if (prevAssigneeId && prevAssigneeId.toString() === assigneeIdStr) {
      return null;
    }

    // 3. Security: Check workspace entitlement
    if (task.workspaceId) {
      const hasAccess = await verifyUserWorkspaceAccess(task.workspaceId, task.assignedTo);
      if (!hasAccess) {
        console.warn(`[CollaborativeNotifications] Assignee ${assigneeIdStr} lacks access to workspace ${task.workspaceId}`);
        return null;
      }
    }

    // 4. Idempotency: Avoid duplicate unread assignment notification for this task
    const existing = await Notification.findOne({
      userId: task.assignedTo,
      relatedTaskId: task._id,
      type: 'task_assigned',
      read: false,
    });
    if (existing) {
      return existing;
    }

    const actorName = actor?.name || 'A team member';
    const notification = await Notification.create({
      userId: task.assignedTo,
      title: 'Task Assigned',
      message: `${actorName} assigned you to "${task.title}"`,
      type: 'task_assigned',
      relatedTaskId: task._id,
      relatedWorkspaceId: task.workspaceId || null,
    });

    return notification;
  } catch (err) {
    console.error('[CollaborativeNotifications] Error in notifyTaskAssignment:', err.message);
    return null;
  }
};

/**
 * Send in-app notification when a comment is added to a task.
 * 
 * Safeguards:
 * 1. Notify task creator and current assignee (plus any distinct previous commenters).
 * 2. Suppress self-notification (actor is excluded).
 * 3. Validate each recipient still has workspace access if applicable.
 * 4. Deduplicate recipients so each authorized user receives at most one notification.
 */
export const notifyTaskComment = async ({ task, actor, commentText }) => {
  try {
    if (!task || !actor) return [];

    const actorIdStr = actor._id ? actor._id.toString() : '';
    const recipientIds = new Set();

    // 1. Candidate recipients: task owner, task assignee
    if (task.userId) recipientIds.add(task.userId.toString());
    if (task.assignedTo) recipientIds.add(task.assignedTo.toString());

    // Also include any previous distinct commenters
    if (Array.isArray(task.comments)) {
      task.comments.forEach((c) => {
        if (c.userId) recipientIds.add(c.userId.toString());
      });
    }

    // 2. Suppress self-notification
    recipientIds.delete(actorIdStr);

    if (recipientIds.size === 0) return [];

    const actorName = actor.name || 'User';
    const trimmedComment = typeof commentText === 'string' ? commentText.trim() : '';
    const snippet = trimmedComment.length > 60
      ? `${trimmedComment.slice(0, 57)}...`
      : trimmedComment;

    const createdNotifications = [];

    for (const recipientId of recipientIds) {
      // 3. Security: Check workspace entitlement
      if (task.workspaceId) {
        const hasAccess = await verifyUserWorkspaceAccess(task.workspaceId, recipientId);
        if (!hasAccess) continue;
      }

      // 4. Create notification
      const notification = await Notification.create({
        userId: recipientId,
        title: 'New Comment',
        message: `${actorName} commented on "${task.title}": "${snippet}"`,
        type: 'comment',
        relatedTaskId: task._id,
        relatedWorkspaceId: task.workspaceId || null,
      });

      createdNotifications.push(notification);
    }

    return createdNotifications;
  } catch (err) {
    console.error('[CollaborativeNotifications] Error in notifyTaskComment:', err.message);
    return [];
  }
};

/**
 * Process overdue task notifications for incomplete tasks past their due or start date.
 * 
 * Safeguards:
 * 1. Targets only incomplete tasks (status !== 'Done').
 * 2. Deduplication: At most one overdue notification per recipient per task within 24 hours.
 * 3. Recipient entitlement: Ensures recipients belong to workspace if task is in a workspace.
 */
export const processOverdueNotifications = async ({ now = new Date(), limit = 50 } = {}) => {
  const stats = { checked: 0, notified: 0 };
  try {
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find incomplete tasks where dueDate is in the past, or startDate is prior to today
    const overdueTasks = await Task.find({
      status: { $ne: 'Done' },
      $or: [
        { dueDate: { $ne: null, $lt: now } },
        { dueDate: null, startDate: { $lt: todayMidnight } },
      ],
    })
      .limit(limit)
      .select('_id title userId assignedTo workspaceId status dueDate startDate');

    stats.checked = overdueTasks.length;

    for (const task of overdueTasks) {
      const recipientIds = new Set();
      if (task.userId) recipientIds.add(task.userId.toString());
      if (task.assignedTo) recipientIds.add(task.assignedTo.toString());

      for (const recipientId of recipientIds) {
        // Workspace entitlement
        if (task.workspaceId) {
          const hasAccess = await verifyUserWorkspaceAccess(task.workspaceId, recipientId);
          if (!hasAccess) continue;
        }

        // Deduplicate: Check if notified within last 24h
        const recentNotif = await Notification.findOne({
          userId: recipientId,
          relatedTaskId: task._id,
          type: 'task_due',
          createdAt: { $gte: oneDayAgo },
        });

        if (!recentNotif) {
          await Notification.create({
            userId: recipientId,
            title: 'Task Overdue',
            message: `"${task.title}" is overdue. Please review or complete it.`,
            type: 'task_due',
            relatedTaskId: task._id,
            relatedWorkspaceId: task.workspaceId || null,
          });
          stats.notified += 1;
        }
      }
    }
  } catch (err) {
    console.error('[CollaborativeNotifications] Error in processOverdueNotifications:', err.message);
  }
  return stats;
};
