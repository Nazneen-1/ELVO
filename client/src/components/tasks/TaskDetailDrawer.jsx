import React, { useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
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
} from 'lucide-react';
import { clsx } from 'clsx';

export const TaskDetailDrawer = ({
  task,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { updateTask, deleteTask, toggleSubtask, addComment } = useTasks();
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'comments' | 'activity'

  if (!task) return null;

  const STATUS_ORDER = ['To Do', 'In Progress', 'Done'];
  const handleToggleStatus = async () => {
    setIsStatusUpdating(true);
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
    await updateTask(task._id, { status: nextStatus });
    setIsStatusUpdating(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      setIsDeleting(true);
      await deleteTask(task._id);
      setIsDeleting(false);
      onClose();
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsPostingComment(true);
    await addComment(task._id, commentText.trim());
    setCommentText('');
    setIsPostingComment(false);
  };

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
            {task.recurrence?.frequency && task.recurrence.frequency !== 'none' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                <Repeat className="w-3 h-3" /> {task.recurrence.frequency}
              </span>
            )}
            {task.reminder?.enabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                <Bell className="w-3 h-3" /> 15m reminder
              </span>
            )}
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

              {task.startTime ? (
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

              {task.workspaceId && (
                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Workspace Task</span>
                </div>
              )}
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

            {/* Interactive Subtasks Checklist */}
            {totalSubtasksCount > 0 && (
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/60">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Subtasks / Checklist</span>
                  <span className="text-slate-500 font-normal">
                    {completedSubtasksCount} of {totalSubtasksCount} completed (
                    {Math.round((completedSubtasksCount / totalSubtasksCount) * 100)}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${(completedSubtasksCount / totalSubtasksCount) * 100}%`,
                    }}
                  />
                </div>
                <div className="space-y-1.5 pt-1">
                  {task.subtasks.map((st) => (
                    <button
                      key={st._id}
                      type="button"
                      onClick={() => toggleSubtask(task._id, st._id)}
                      className="flex items-center gap-2.5 w-full text-left p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors group"
                    >
                      {st.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
                      )}
                      <span
                        className={clsx(
                          'text-xs transition-colors',
                          st.completed
                            ? 'line-through text-slate-400 dark:text-zinc-500'
                            : 'text-slate-700 dark:text-zinc-200'
                        )}
                      >
                        {st.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Status Quick-Cycle Button */}
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
          </div>
        )}

        {/* Tab 2: Comments */}
        {activeTab === 'comments' && (
          <div className="space-y-3">
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {(!task.comments || task.comments.length === 0) ? (
                <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                  No comments yet. Start the conversation below.
                </div>
              ) : (
                task.comments.map((c, i) => (
                  <div
                    key={c._id || i}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-zinc-300">
                      <span>{c.userName || 'User'}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {c.createdAt ? format(parseISO(c.createdAt), 'MMM d, h:mm a') : 'Just now'}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))
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
            {(!task.activity || task.activity.length === 0) ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                No activity recorded yet.
              </div>
            ) : (
              task.activity.map((act, i) => (
                <div key={act._id || i} className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
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

          <div className="flex items-center gap-2">
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
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

