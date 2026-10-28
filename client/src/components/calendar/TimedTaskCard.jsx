import React, { useState } from 'react';
import { clsx } from 'clsx';
import { formatDisplayTime } from '../../utils/dateUtils.js';
import { CheckCircle2, Clock, Repeat, Check, Trash2, Loader2 } from 'lucide-react';
import { useTasks } from '../../context/TaskContext.jsx';

const COLOR_MAP = {
  indigo: 'bg-indigo-50/95 dark:bg-indigo-950/80 border-indigo-500 text-indigo-950 dark:text-indigo-100 hover:border-indigo-600',
  emerald: 'bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-500 text-emerald-950 dark:text-emerald-100 hover:border-emerald-600',
  amber: 'bg-amber-50/95 dark:bg-amber-950/80 border-amber-500 text-amber-950 dark:text-amber-100 hover:border-amber-600',
  rose: 'bg-rose-50/95 dark:bg-rose-950/80 border-rose-500 text-rose-950 dark:text-rose-100 hover:border-rose-600',
  sky: 'bg-sky-50/95 dark:bg-sky-950/80 border-sky-500 text-sky-950 dark:text-sky-100 hover:border-sky-600',
  purple: 'bg-purple-50/95 dark:bg-purple-950/80 border-purple-500 text-purple-950 dark:text-purple-100 hover:border-purple-600',
  violet: 'bg-violet-50/95 dark:bg-violet-950/80 border-violet-500 text-violet-950 dark:text-violet-100 hover:border-violet-600',
  teal: 'bg-teal-50/95 dark:bg-teal-950/80 border-teal-500 text-teal-950 dark:text-teal-100 hover:border-teal-600',
  orange: 'bg-orange-50/95 dark:bg-orange-950/80 border-orange-500 text-orange-950 dark:text-orange-100 hover:border-orange-600',
  pink: 'bg-pink-50/95 dark:bg-pink-950/80 border-pink-500 text-pink-950 dark:text-pink-100 hover:border-pink-600',
  cyan: 'bg-cyan-50/95 dark:bg-cyan-950/80 border-cyan-500 text-cyan-950 dark:text-cyan-100 hover:border-cyan-600',
  lime: 'bg-lime-50/95 dark:bg-lime-950/80 border-lime-500 text-lime-950 dark:text-lime-100 hover:border-lime-600',
  fuchsia: 'bg-fuchsia-50/95 dark:bg-fuchsia-950/80 border-fuchsia-500 text-fuchsia-950 dark:text-fuchsia-100 hover:border-fuchsia-600',
  slate: 'bg-slate-50/95 dark:bg-zinc-800/80 border-slate-400 text-slate-900 dark:text-zinc-100 hover:border-slate-500',
};

const DOT_COLOR_MAP = {
  'Done': 'bg-emerald-500',
  'In Progress': 'bg-amber-500 animate-pulse',
  'To Do': 'bg-indigo-500',
};

export const TimedTaskCard = ({
  task,
  topPercent,
  heightPercent,
  leftPercent,
  widthPercent,
  onClick,
}) => {
  const { patchTask, updateOccurrence, deleteTask, skipOccurrence, setCalendarError } = useTasks();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isDone = task.status === 'Done';
  const colorClass = COLOR_MAP[task.color] || COLOR_MAP.indigo;
  const dotColor = DOT_COLOR_MAP[task.status] || DOT_COLOR_MAP['To Do'];

  const timeLabel = task.endTime
    ? `${formatDisplayTime(task.startTime)} – ${formatDisplayTime(task.endTime)}`
    : formatDisplayTime(task.startTime);

  const handleDragStart = (e) => {
    e.stopPropagation();
    const payload = JSON.stringify({
      taskId: task._id,
      occurrenceId: task.occurrenceId || null,
      startDate: task.startDate,
      startTime: task.startTime || null,
      endTime: task.endTime || null,
      isAllDay: Boolean(task.isAllDay),
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
        const targetAction = isDone ? 'reopen' : 'complete';
        await updateOccurrence(masterTaskId, occDate, { action: targetAction });
      } else {
        const nextStatus = isDone ? 'To Do' : 'Done';
        await patchTask(task._id, { status: nextStatus });
      }
    } catch (err) {
      console.error('Failed to toggle completion from timed task card:', err);
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
        console.error('Failed to remove occurrence:', err);
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
      style={{
        top: `${topPercent}%`,
        height: `${Math.max(heightPercent, 1.8)}%`,
        left: `${leftPercent}%`,
        width: `calc(${widthPercent}% - 4px)`,
      }}
      className={clsx(
        'absolute z-10 rounded-lg p-1.5 sm:p-2 border-l-[3.5px] border shadow-xs overflow-hidden cursor-pointer select-none',
        'transition-all duration-150 ease-out hover:z-20 hover:shadow-md hover:scale-[1.01]',
        colorClass,
        isDone && 'opacity-65'
      )}
      title={`${task.title} ${workspaceName ? `[${workspaceName}] ` : ''}(${timeLabel}) - Drag to reschedule`}
    >
      <div className="flex items-start justify-between gap-1 leading-tight">
        <div className="min-w-0 flex-1 flex items-start gap-1">
          {/* Completion Checkbox */}
          <button
            type="button"
            onClick={handleToggleComplete}
            disabled={isUpdating}
            className={clsx(
              'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-transform hover:scale-110 mt-0.5',
              isDone
                ? 'border-[#2B2B2B] bg-[#2B2B2B] dark:border-white dark:bg-white text-white dark:text-[#2B2B2B]'
                : 'border-[#848484] dark:border-[#565656] hover:border-[#2B2B2B] dark:hover:border-white bg-white/70 dark:bg-black/30',
              isUpdating && 'opacity-50 animate-pulse'
            )}
            title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
            aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </button>

          <div className="min-w-0 flex-1">
            {/* Header: Dot + Title */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
              <h4
                className={clsx(
                  'text-[11px] sm:text-xs font-semibold truncate flex items-center gap-1',
                  isDone && 'line-through opacity-75'
                )}
              >
                <span className="truncate">{task.title}</span>
                {task.recurrence?.frequency && task.recurrence.frequency !== 'none' && (
                  <Repeat className="w-2.5 h-2.5 shrink-0 opacity-60" title={`Repeats ${task.recurrence.frequency}`} />
                )}
                {workspaceName && (
                  <span className="text-[9px] px-1 rounded bg-black/10 dark:bg-white/15 font-medium shrink-0 max-w-[55px] truncate">
                    {workspaceName}
                  </span>
                )}
              </h4>
            </div>

            {/* Time range */}
            <p className="text-[10px] opacity-80 flex items-center gap-1 mt-0.5 font-medium truncate">
              <Clock className="w-2.5 h-2.5 shrink-0" />
              <span>{timeLabel}</span>
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
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

      {/* Description preview if height allows */}
      {heightPercent > 4.5 && task.description && (
        <p className="hidden sm:block text-[10px] opacity-70 mt-1 line-clamp-1 italic">
          {task.description}
        </p>
      )}
    </div>
  );
};
