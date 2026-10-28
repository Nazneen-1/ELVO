import React, { useState } from 'react';
import { clsx } from 'clsx';
import { formatDisplayTime } from '../../utils/dateUtils.js';
import { Repeat, UserCheck, Check, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTasks } from '../../context/TaskContext.jsx';

export const TaskBadge = ({ task, onClick }) => {
  const { user } = useAuth();
  const { patchTask, updateOccurrence, deleteTask, skipOccurrence, setCalendarError } = useTasks();

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCompleted = task.status === 'Done';
  const isRecurring = Boolean(task.recurrence?.frequency && task.recurrence.frequency !== 'none');

  const currentUserIdStr = user?._id?.toString();
  const isAssignedToMe = Boolean(
    currentUserIdStr &&
      task.workspaceId &&
      ((task.assignees || []).some(
        (a) => (typeof a === 'object' && a?._id ? a._id.toString() : a?.toString()) === currentUserIdStr
      ) ||
        (typeof task.assignedTo === 'object' && task.assignedTo?._id
          ? task.assignedTo._id.toString()
          : task.assignedTo?.toString()) === currentUserIdStr)
  );

  const colorStyles = {
    indigo: 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50 hover:border-indigo-400',
    emerald: 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/50 hover:border-emerald-400',
    amber: 'bg-amber-50/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50 hover:border-amber-400',
    rose: 'bg-rose-50/90 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/50 hover:border-rose-400',
    sky: 'bg-sky-50/90 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/50 hover:border-sky-400',
    purple: 'bg-purple-50/90 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/50 hover:border-purple-400',
    violet: 'bg-violet-50/90 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200/70 dark:border-violet-800/50 hover:border-violet-400',
    teal: 'bg-teal-50/90 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/70 dark:border-teal-800/50 hover:border-teal-400',
    orange: 'bg-orange-50/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200/70 dark:border-orange-800/50 hover:border-orange-400',
    pink: 'bg-pink-50/90 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200/70 dark:border-pink-800/50 hover:border-pink-400',
    cyan: 'bg-cyan-50/90 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200/70 dark:border-cyan-800/50 hover:border-cyan-400',
    lime: 'bg-lime-50/90 dark:bg-lime-950/60 text-lime-700 dark:text-lime-300 border-lime-200/70 dark:border-lime-800/50 hover:border-lime-400',
    fuchsia: 'bg-fuchsia-50/90 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200/70 dark:border-fuchsia-800/50 hover:border-fuchsia-400',
    slate: 'bg-slate-100 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 border-slate-200/70 dark:border-zinc-700/50 hover:border-slate-400',
  };

  const currentStyle = colorStyles[task.color] || colorStyles.indigo;

  const handleDragStart = (e) => {
    e.stopPropagation();
    const payload = JSON.stringify({
      taskId: task._id,
      occurrenceId: task.occurrenceId || null,
      startDate: task.startDate,
      startTime: task.startTime || null,
      endTime: task.endTime || null,
      isAllDay: Boolean(task.isAllDay || !task.startTime),
      isOccurrence: Boolean(task.isOccurrence),
      masterTaskId: task.masterTaskId || task._id,
      originalOccurrenceDate:
        task.originalOccurrenceDate ||
        task.occurrenceDate ||
        (task.occurrenceId ? task.occurrenceId.split('__')[1] : null),
      occurrenceDate: task.occurrenceDate || null,
      dueDate: task.dueDate || null,
      endDate: task.endDate || null,
      title: task.title,
    });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', task.occurrenceId || task._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (task.isOccurrence) {
        const masterTaskId = task.masterTaskId || task._id;
        const occDate =
          task.originalOccurrenceDate ||
          task.occurrenceDate ||
          (task.occurrenceId ? task.occurrenceId.split('__')[1] : null);
        const targetAction = isCompleted ? 'reopen' : 'complete';
        await updateOccurrence(masterTaskId, occDate, { action: targetAction });
      } else {
        const nextStatus = isCompleted ? 'To Do' : 'Done';
        await patchTask(task._id, { status: nextStatus });
      }
    } catch (err) {
      console.error('Failed to toggle task completion:', err);
      setCalendarError('Failed to update task completion');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (isDeleting) return;

    if (task.isOccurrence) {
      const confirmDelete = window.confirm(
        `This is a recurring occurrence on ${task.occurrenceDate || 'this date'}.\n\n` +
          `• Click OK to remove ONLY this occurrence.\n` +
          `• Click Cancel to keep it.`
      );
      if (!confirmDelete) return;

      setIsDeleting(true);
      try {
        const masterTaskId = task.masterTaskId || task._id;
        const occDate =
          task.originalOccurrenceDate ||
          task.occurrenceDate ||
          (task.occurrenceId ? task.occurrenceId.split('__')[1] : null);
        const res = await skipOccurrence(masterTaskId, occDate);
        if (res && !res.success) {
          setCalendarError(res.error || 'Failed to remove occurrence');
        }
      } catch (err) {
        console.error('Failed to skip occurrence:', err);
        setCalendarError('Failed to remove occurrence');
      } finally {
        setIsDeleting(false);
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
        return;
      }

      setIsDeleting(true);
      try {
        const res = await deleteTask(task._id);
        if (res && !res.success) {
          setCalendarError(res.error || 'Failed to delete task');
        }
      } catch (err) {
        console.error('Failed to delete task:', err);
        setCalendarError('Failed to delete task');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const workspaceName = typeof task.workspaceId === 'object' && task.workspaceId?.name ? task.workspaceId.name : null;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onClick={(e) => {
        e.stopPropagation();
        onClick(task);
      }}
      className={clsx(
        'group flex items-center justify-between px-1.5 py-1 mb-1 rounded-lg border text-xs font-medium cursor-grab active:cursor-grabbing transition-all duration-150 shadow-subtle select-none gap-1',
        currentStyle,
        isAssignedToMe && 'ring-1.5 ring-emerald-500/80 dark:ring-emerald-400/80 font-semibold shadow-xs',
        isCompleted && 'opacity-65'
      )}
      title={`${task.title} ${isAssignedToMe ? '[Assigned to you] ' : ''}${workspaceName ? `[${workspaceName}] ` : ''}${task.startTime ? `(${formatDisplayTime(task.startTime)})` : ''} - Drag to reschedule`}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {/* Completion Checkbox */}
        <button
          type="button"
          onClick={handleToggleComplete}
          disabled={isUpdating}
          className={clsx(
            'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-transform hover:scale-110',
            isCompleted
              ? 'border-[#2B2B2B] bg-[#2B2B2B] dark:border-white dark:bg-white text-white dark:text-[#2B2B2B]'
              : 'border-[#848484] dark:border-[#565656] hover:border-[#2B2B2B] dark:hover:border-white bg-white/70 dark:bg-black/30',
            isUpdating && 'opacity-50 animate-pulse'
          )}
          title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
          aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
        </button>

        {/* Status Dot */}
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            task.status === 'Done'
              ? 'bg-emerald-500'
              : task.status === 'In Progress'
              ? 'bg-amber-500 animate-pulse'
              : 'bg-indigo-500'
          )}
        />

        <span className={clsx('truncate', isCompleted && 'line-through opacity-70')}>
          {task.title}
        </span>

        {isRecurring && (
          <Repeat className="w-2.5 h-2.5 shrink-0 opacity-60 ml-0.5" title={`Repeats ${task.recurrence.frequency}`} />
        )}
        {isAssignedToMe && (
          <span title="Assigned to you" className="shrink-0 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-3 h-3" />
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-1">
        {workspaceName && (
          <span
            className="text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/15 font-semibold max-w-[55px] truncate"
            title={`Workspace: ${workspaceName}`}
          >
            {workspaceName}
          </span>
        )}
        {task.startTime && !task.isAllDay && (
          <span className="text-[10px] opacity-75">
            {formatDisplayTime(task.startTime)}
          </span>
        )}

        {/* Delete Button */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-[#848484] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all shrink-0"
          title="Delete task"
        >
          {isDeleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
};
