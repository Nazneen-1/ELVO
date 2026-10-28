import React, { useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { format, parseISO, isPast } from 'date-fns';
import { formatDisplayTime } from '../../utils/dateUtils.js';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  CheckSquare,
  Square,
  MessageSquare,
  Send,
  History,
  Tag,
  Repeat,
  Bell,
  Timer,
  Users,
  CalendarX,
  CalendarClock,
  Briefcase,
  Sparkles,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { clsx } from 'clsx';

export const formatReminderLeadTime = (minutes) => {
  const m = Number(minutes);
  if (!m || isNaN(m) || m <= 0) return 'Reminder';
  if (m < 60) return `${m}m reminder`;
  if (m < 1440) {
    const hours = Math.round(m / 60);
    return `${hours}h reminder`;
  }
  const days = Math.round(m / 1440);
  return `${days}d reminder`;
};

export const TaskDetailDrawer = ({
  task,
  isOpen,
  onClose,
  onEdit,
}) => {
  const {
    updateTask,
    patchTask,
    deleteTask,
    updateOccurrence,
    skipOccurrence,
    rescheduleOccurrence,
    toggleSubtask,
    addComment,
    updateComment,
    deleteComment,
  } = useTasks();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isOccurrenceUpdating, setIsOccurrenceUpdating] = useState(false);
  const [isPriorityUpdating, setIsPriorityUpdating] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isSubtaskSubmitting, setIsSubtaskSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'comments' | 'activity'

  if (!task) return null;

  const isOccurrence = Boolean(task.isOccurrence && (task.occurrenceDate || task.occurrenceId));
  const occurrenceDate = task.occurrenceDate || (task.occurrenceId ? task.occurrenceId.split('__')[1] : null);
  const seriesOccurrenceDate =
    task.originalOccurrenceDate ||
    task.occurrenceDate ||
    (task.occurrenceId ? task.occurrenceId.split('__')[1] : null);
  const masterTaskId = task.masterTaskId || task._id;

  const STATUS_ORDER = ['To Do', 'In Progress', 'Done'];
  const handleToggleStatus = async () => {
    setIsStatusUpdating(true);
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
    await updateTask(task._id, { status: nextStatus });
    setIsStatusUpdating(false);
  };

  const handleToggleOccurrenceStatus = async () => {
    if (!isOccurrence || !seriesOccurrenceDate) return;
    setIsOccurrenceUpdating(true);
    const targetAction = task.status === 'Done' ? 'reopen' : 'complete';
    const targetStatus = task.status === 'Done' ? 'To Do' : 'Done';
    await updateOccurrence(masterTaskId, seriesOccurrenceDate, { action: targetAction, status: targetStatus });
    setIsOccurrenceUpdating(false);
  };

  const handleSetOccurrenceStatus = async (targetStatus) => {
    if (!isOccurrence || !seriesOccurrenceDate) return;
    setIsOccurrenceUpdating(true);
    const targetAction = targetStatus === 'Done' ? 'complete' : 'reopen';
    await updateOccurrence(masterTaskId, seriesOccurrenceDate, {
      action: targetAction,
      status: targetStatus,
    });
    setIsOccurrenceUpdating(false);
  };

  const handleUpdatePriority = async (newPriority) => {
    if (!newPriority || task.priority === newPriority) return;
    setIsPriorityUpdating(true);
    await patchTask(masterTaskId, { priority: newPriority });
    setIsPriorityUpdating(false);
  };

  const handleInlineAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setIsSubtaskSubmitting(true);
    const currentSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const updated = [...currentSubtasks, { title: newSubtaskTitle.trim(), completed: false }];
    const res = await patchTask(masterTaskId, { subtasks: updated });
    setIsSubtaskSubmitting(false);
    if (res?.success) {
      setNewSubtaskTitle('');
    }
  };

  const handleDeleteSubtask = async (e, subtaskId) => {
    e.stopPropagation();
    const currentSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const updated = currentSubtasks.filter((s) => s._id !== subtaskId);
    await patchTask(masterTaskId, { subtasks: updated });
  };

  const handleSkipOccurrence = async () => {
    if (!isOccurrence || !seriesOccurrenceDate) return;
    if (
      window.confirm(
        `Skip the occurrence on ${occurrenceDate || seriesOccurrenceDate}? It will be removed from your calendar without affecting the rest of the series.`
      )
    ) {
      setIsSkipping(true);
      await skipOccurrence(masterTaskId, seriesOccurrenceDate);
      setIsSkipping(false);
      onClose();
    }
  };

  const handleToggleRescheduleForm = () => {
    if (!showRescheduleForm) {
      const currentIso =
        task.occurrenceDate ||
        (task.startDate
          ? typeof task.startDate === 'string'
            ? task.startDate.split('T')[0]
            : task.startDate.toISOString().split('T')[0]
          : seriesOccurrenceDate);
      setRescheduleDate(currentIso || '');
      setRescheduleStartTime(task.startTime || '');
      setRescheduleEndTime(task.endTime || '');
      setRescheduleError(null);
    }
    setShowRescheduleForm((prev) => !prev);
  };

  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleDate) {
      setRescheduleError('Please choose a destination date');
      return;
    }
    if (rescheduleStartTime && rescheduleEndTime && rescheduleEndTime <= rescheduleStartTime) {
      setRescheduleError('End time must be after start time');
      return;
    }

    setIsRescheduling(true);
    setRescheduleError(null);
    const res = await rescheduleOccurrence(masterTaskId, seriesOccurrenceDate, {
      rescheduledDate: rescheduleDate,
      startTime: rescheduleStartTime || null,
      endTime: rescheduleEndTime || null,
      isAllDay: !rescheduleStartTime,
    });
    setIsRescheduling(false);
    if (!res.success) {
      setRescheduleError(res.error || 'Failed to reschedule occurrence');
    } else {
      setShowRescheduleForm(false);
    }
  };

  const handleDelete = async () => {
    if (isOccurrence) {
      const confirmDelete = window.confirm(
        `This is an individual occurrence on ${occurrenceDate}.\n\n` +
          `• To remove ONLY this date, click Cancel and use "Skip Occurrence" instead.\n` +
          `• To permanently delete the ENTIRE recurring series, click OK.`
      );
      if (!confirmDelete) return;
    } else {
      if (!window.confirm('Are you sure you want to delete this task?')) return;
    }

    setIsDeleting(true);
    await deleteTask(masterTaskId);
    setIsDeleting(false);
    onClose();
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsPostingComment(true);
    await addComment(task._id, commentText.trim());
    setCommentText('');
    setIsPostingComment(false);
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment._id);
    setEditingCommentText(comment.text);
  };

  const handleSaveCommentEdit = async (commentId) => {
    if (!editingCommentText.trim()) return;
    setIsUpdatingComment(true);
    await updateComment(task._id, commentId, editingCommentText.trim());
    setIsUpdatingComment(false);
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    await deleteComment(task._id, commentId);
  };

  const taskWsId =
    typeof task.workspaceId === 'object' && task.workspaceId?._id
      ? task.workspaceId._id.toString()
      : task.workspaceId?.toString() || null;
  const currentWs = taskWsId ? workspaces.find((w) => w._id.toString() === taskWsId) : null;
  let userRole = null;
  if (currentWs && user?._id) {
    const currentUserIdStr = user._id.toString();
    const ownerIdStr =
      typeof currentWs.owner === 'object' && currentWs.owner?._id
        ? currentWs.owner._id.toString()
        : currentWs.owner?.toString();
    if (ownerIdStr === currentUserIdStr) {
      userRole = 'owner';
    } else {
      const mem = (currentWs.members || []).find((m) => {
        const mUserId =
          typeof m.user === 'object' && m.user?._id ? m.user._id.toString() : m.user?.toString();
        return mUserId === currentUserIdStr;
      });
      if (mem) userRole = mem.role;
    }
  }

  const currentUserIdStr = user?._id?.toString();
  const taskCreatorIdStr =
    typeof task.userId === 'object' && task.userId?._id
      ? task.userId._id.toString()
      : task.userId?.toString();
  const isCreator = Boolean(currentUserIdStr && taskCreatorIdStr === currentUserIdStr);

  const isAssigned =
    (task.assignees || []).some((a) => {
      const aId = typeof a === 'object' && a?._id ? a._id.toString() : a?.toString();
      return aId === currentUserIdStr;
    }) ||
    (typeof task.assignedTo === 'object' && task.assignedTo?._id
      ? task.assignedTo._id.toString() === currentUserIdStr
      : task.assignedTo?.toString() === currentUserIdStr);

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';
  const canEdit = !taskWsId ? true : isOwnerOrAdmin || isCreator || isAssigned;
  const canDelete = !taskWsId ? true : isOwnerOrAdmin || isCreator;

  const formattedDate = task.startDate
    ? format(
        typeof task.startDate === 'string'
          ? parseISO(task.startDate)
          : task.startDate,
        'EEEE, MMMM d, yyyy'
      )
    : '';

  const isOverdue =
    task.status !== 'Done' &&
    task.startDate &&
    isPast(typeof task.startDate === 'string' ? parseISO(task.startDate) : task.startDate);

  const statusVariants = {
    'To Do': { label: 'To Do', variant: 'slate' },
    'In Progress': { label: 'In Progress', variant: 'amber' },
    'Done': { label: 'Done', variant: 'emerald' },
  };

  const currentStatus = statusVariants[task.status] || statusVariants['To Do'];
  const completedSubtasksCount = (task.subtasks || []).filter((s) => s.completed).length;
  const totalSubtasksCount = (task.subtasks || []).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Overview" maxWidth="max-w-lg">
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
        {/* Header & Badges */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
            <Badge variant={task.color || 'indigo'}>
              {task.priority?.toUpperCase()} PRIORITY
            </Badge>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-3 h-3" /> Overdue
              </span>
            )}
            {isOccurrence ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
                <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>
                  {task.recurrence?.frequency} ({occurrenceDate})
                </span>
              </span>
            ) : task.recurrence?.frequency && task.recurrence.frequency !== 'none' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                <Repeat className="w-3 h-3" /> {task.recurrence.frequency}
              </span>
            ) : null}
            {task.reminder?.enabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                <Bell className="w-3 h-3" /> {formatReminderLeadTime(task.reminder?.minutesBefore)}
              </span>
            )}

            {/* Quick Priority Switcher */}
            <div className="inline-flex items-center gap-1 sm:ml-auto p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800/80 text-[10px]">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 px-1">Set:</span>
              {['Low', 'Medium', 'High'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleUpdatePriority(p)}
                  disabled={isPriorityUpdating || task.priority === p}
                  className={clsx(
                    'px-2 py-0.5 rounded font-bold transition-all',
                    task.priority === p
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 leading-tight">
            {task.title}
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('details')}
            className={clsx(
              'pb-2 px-3 transition-colors border-b-2 -mb-px',
              activeTab === 'details'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
            )}
          >
            Details & Checklist
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={clsx(
              'pb-2 px-3 transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === 'comments'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
            )}
          >
            Comments ({(task.comments || []).length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={clsx(
              'pb-2 px-3 transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === 'activity'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
            )}
          >
            Activity ({(task.activity || []).length})
          </button>
        </div>

        {/* Tab 1: Details & Checklist */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Date, Time & Focus Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/60 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>{formattedDate}</span>
              </div>

              {task.startTime && !task.isAllDay ? (
                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    {formatDisplayTime(task.startTime)}
                    {task.endTime ? ` - ${formatDisplayTime(task.endTime)}` : ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>All Day</span>
                </div>
              )}

              {task.estimatedMinutes > 0 && (
                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <Timer className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Focus est: {task.estimatedMinutes} min</span>
                </div>
              )}

              {task.workspaceId ? (
                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    Workspace: {typeof task.workspaceId === 'object' && task.workspaceId?.name ? task.workspaceId.name : 'Team Workspace'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Personal Task</span>
                </div>
              )}

              {task.assignees && task.assignees.length > 0 ? (
                <div className="flex items-start gap-2 text-slate-700 dark:text-zinc-300">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-xs">Assignees:</span>
                    {task.assignees.map((a, idx) => {
                      const name =
                        typeof a === 'object' && a?.name
                          ? a.name
                          : typeof a === 'object' && a?.email
                          ? a.email
                          : 'Member';
                      return (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : task.assignedTo ? (
                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Assigned: {typeof task.assignedTo === 'object' && task.assignedTo?.name ? task.assignedTo.name : 'Assigned Member'}
                  </span>
                </div>
              ) : taskWsId ? (
                <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-500">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Unassigned</span>
                </div>
              ) : null}
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Description
                </p>
                <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </p>
              </div>
            )}

            {/* Interactive Subtasks Checklist & Add Subtask */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/60">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <span>Subtasks / Checklist</span>
                {totalSubtasksCount > 0 && (
                  <span className="text-slate-500 font-normal">
                    {completedSubtasksCount} of {totalSubtasksCount} completed (
                    {Math.round((completedSubtasksCount / totalSubtasksCount) * 100)}%)
                  </span>
                )}
              </div>

              {totalSubtasksCount > 0 && (
                <>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${(completedSubtasksCount / totalSubtasksCount) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 max-h-48 overflow-y-auto pr-1">
                    {task.subtasks.map((st) => (
                      <div
                        key={st._id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors group"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubtask(task._id, st._id)}
                          className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                        >
                          {st.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
                          )}
                          <span
                            className={clsx(
                              'text-xs transition-colors truncate',
                              st.completed
                                ? 'line-through text-slate-400 dark:text-zinc-500'
                                : 'text-slate-700 dark:text-zinc-200'
                            )}
                          >
                            {st.title}
                          </span>
                          {st.assignee && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 shrink-0">
                              @{typeof st.assignee === 'object' && st.assignee?.name ? st.assignee.name : 'Assigned'}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSubtask(e, st._id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity"
                          title="Delete subtask"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Inline Add Subtask */}
              <form onSubmit={handleInlineAddSubtask} className="flex gap-2 pt-2 border-t border-slate-200/50 dark:border-zinc-800/50">
                <input
                  type="text"
                  placeholder="Add a new checklist item..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Button type="submit" size="xs" variant="secondary" isLoading={isSubtaskSubmitting}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>

            {/* Status Section */}
            {isOccurrence ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-purple-900 dark:text-purple-200 mb-1">
                    <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Occurrence Action ({occurrenceDate})</span>
                  </div>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                    Completing, reopening, skipping, or rescheduling applies exclusively to this occurrence date. The rest of the recurring series remains unchanged.
                  </p>
                  {task.isRescheduled && (
                    <div className="mt-2 pt-2 border-t border-purple-200/60 dark:border-purple-800/40 text-[11px] font-medium text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>
                        Rescheduled from series date: <strong>{seriesOccurrenceDate}</strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={task.status === 'To Do' ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={task.status === 'To Do'}
                      className="justify-center text-xs"
                      onClick={() => handleSetOccurrenceStatus('To Do')}
                      isLoading={isOccurrenceUpdating && task.status !== 'To Do'}
                    >
                      To Do
                    </Button>
                    <Button
                      variant={task.status === 'In Progress' ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={task.status === 'In Progress'}
                      className="justify-center text-xs"
                      onClick={() => handleSetOccurrenceStatus('In Progress')}
                      isLoading={isOccurrenceUpdating && task.status !== 'In Progress'}
                    >
                      In Progress
                    </Button>
                    <Button
                      variant={task.status === 'Done' ? 'secondary' : 'primary'}
                      size="sm"
                      className="justify-center text-xs"
                      onClick={() => handleSetOccurrenceStatus(task.status === 'Done' ? 'To Do' : 'Done')}
                      isLoading={isOccurrenceUpdating && (task.status === 'Done' || task.status === 'To Do')}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {task.status === 'Done' ? 'Reopen' : 'Done'}
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full justify-center text-slate-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 border-slate-200 dark:border-zinc-700"
                    onClick={handleSkipOccurrence}
                    isLoading={isSkipping}
                  >
                    <CalendarX className="w-4 h-4 mr-1.5 text-rose-500" />
                    Skip Occurrence
                  </Button>
                </div>

                {/* Reschedule this occurrence */}
                <div className="pt-1">
                  {!showRescheduleForm ? (
                    <Button
                      variant="outline"
                      className="w-full justify-center text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600"
                      onClick={handleToggleRescheduleForm}
                    >
                      <CalendarClock className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                      Reschedule this occurrence
                    </Button>
                  ) : (
                    <form
                      onSubmit={handleSaveReschedule}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
                          <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Reschedule this occurrence</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRescheduleForm(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                        Move only this occurrence to a new date and optional time. The master series schedule remains untouched.
                      </p>

                      {rescheduleError && (
                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{rescheduleError}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                          Destination Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={rescheduleStartTime}
                            onChange={(e) => setRescheduleStartTime(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={rescheduleEndTime}
                            onChange={(e) => setRescheduleEndTime(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRescheduleForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          isLoading={isRescheduling}
                        >
                          Save Reschedule
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <Button
                  variant="secondary"
                  className="w-full justify-between"
                  onClick={handleToggleStatus}
                  isLoading={isStatusUpdating}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Cycle Status</span>
                  </span>
                  <span className="text-xs font-semibold capitalize opacity-80">
                    {task.status} → {STATUS_ORDER[(STATUS_ORDER.indexOf(task.status) + 1) % STATUS_ORDER.length]}
                  </span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Comments */}
        {activeTab === 'comments' && (
          <div className="space-y-3">
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {!task.comments || task.comments.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                  No comments yet. Start the conversation below.
                </div>
              ) : (
                task.comments.map((c, i) => {
                  const commentAuthorId =
                    typeof c.userId === 'object' && c.userId?._id
                      ? c.userId._id.toString()
                      : c.userId?.toString();
                  const isAuthor = currentUserIdStr && commentAuthorId === currentUserIdStr;
                  const canDeleteComm = isAuthor || isOwnerOrAdmin;

                  return (
                    <div
                      key={c._id || i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-xs space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-zinc-300">
                        <span>{c.userName || 'User'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-normal">
                            {c.createdAt ? format(parseISO(c.createdAt), 'MMM d, h:mm a') : 'Just now'}
                            {c.updatedAt && c.updatedAt !== c.createdAt && ' (edited)'}
                          </span>
                          {editingCommentId !== c._id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isAuthor && (
                                <button
                                  type="button"
                                  onClick={() => handleEditComment(c)}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  title="Edit comment"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteComm && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c._id)}
                                  className="text-slate-400 hover:text-rose-500 transition-colors"
                                  title="Delete comment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {editingCommentId === c._id ? (
                        <div className="space-y-1.5 pt-1">
                          <input
                            type="text"
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingCommentId(null)}
                              className="px-2 py-0.5 rounded text-[11px] text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveCommentEdit(c._id)}
                              disabled={isUpdatingComment}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{c.text}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handlePostComment} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <input
                type="text"
                placeholder="Write a comment or note..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <Button type="submit" size="sm" variant="primary" isLoading={isPostingComment}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        )}

        {/* Tab 3: Activity Logs */}
        {activeTab === 'activity' && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {!task.activity || task.activity.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                No activity recorded yet.
              </div>
            ) : (
              task.activity.map((act, i) => (
                <div
                  key={act._id || i}
                  className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-zinc-200">{act.action}</p>
                    {act.details && <p className="text-[11px] text-slate-500 dark:text-zinc-400">{act.details}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {act.timestamp ? format(parseISO(act.timestamp), 'MMM d, h:mm a') : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bottom Actions (Edit / Delete) */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              isLoading={isDeleting}
              className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
              >
                <Edit3 className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

