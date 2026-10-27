import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { TaskBadge } from './TaskBadge.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { toISODate, calculateDateUpdates } from '../../utils/dateUtils.js';

export const DayCell = ({
  day,
  tasks = [],
  isSelected,
  onSelectDate,
  onOpenCreateModal,
  onSelectTask,
}) => {
  const { isCurrentMonth, isToday, dayNumber } = day;
  const { patchTask, rescheduleOccurrence, setCalendarError } = useTasks();
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const visibleTasks = tasks.slice(0, 3);
  const overflowCount = tasks.length - 3;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);

    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!raw) return;

      let taskId = raw;
      let fromDate = null;
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
        if (parsed?.taskId) {
          taskId = parsed.taskId;
          fromDate = parsed.startDate;
        }
      } catch {
        // Plain string taskId fallback
      }

      // Avoid accidental duplicate update if dropped on same day
      if (fromDate && toISODate(fromDate) === day.isoString) {
        return;
      }

      // Only prevent drop if THIS EXACT occurrence or non-recurring task is already in this cell
      if (parsed?.isOccurrence) {
        const occId = parsed.occurrenceId || `${parsed.masterTaskId || taskId}__${parsed.originalOccurrenceDate}`;
        const alreadyHere = tasks.some(
          (t) =>
            t.occurrenceId === occId ||
            (t.masterTaskId === (parsed.masterTaskId || taskId) &&
              t.originalOccurrenceDate === parsed.originalOccurrenceDate)
        );
        if (alreadyHere) return;
      } else {
        const alreadyHere = tasks.some((t) => t._id === taskId && !t.isOccurrence);
        if (alreadyHere) return;
      }

      let res;
      if (parsed?.isOccurrence && parsed?.originalOccurrenceDate) {
        res = await rescheduleOccurrence(parsed.masterTaskId || taskId, parsed.originalOccurrenceDate, {
          rescheduledDate: day.isoString,
        });
      } else {
        res = await patchTask(taskId, calculateDateUpdates(parsed, day.isoString));
      }

      if (res && !res.success && !res.cancelled) {
        setCalendarError(res.error || 'Failed to move task. Reverted to original schedule.');
      }
    } catch (err) {
      console.error('Failed to reschedule task:', err);
      setCalendarError('Failed to move task due to an unexpected error.');
    }
  };

  return (
    <div
      onClick={() => onSelectDate(day.date)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clsx(
        'group relative min-h-[90px] sm:min-h-[110px] lg:min-h-[130px] p-2 border-b border-r border-slate-200/70 dark:border-zinc-800/70 transition-colors flex flex-col',
        !isCurrentMonth && 'bg-slate-50/50 dark:bg-zinc-950/40 text-slate-400 dark:text-zinc-600',
        isCurrentMonth && 'bg-white dark:bg-zinc-900/90 text-slate-800 dark:text-zinc-200 hover:bg-slate-50/80 dark:hover:bg-zinc-800/50',
        isSelected && 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/30 dark:bg-indigo-950/20',
        isDragOver && 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/70 dark:bg-indigo-950/60'
      )}
    >
      {/* Date Header inside Cell */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={clsx(
            'inline-flex items-center justify-center text-xs font-semibold rounded-full transition-colors',
            isToday
              ? 'w-6 h-6 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
              : 'w-6 h-6 text-slate-700 dark:text-zinc-300'
          )}
        >
          {dayNumber}
        </span>

        {/* Quick Add Button (visible on hover or focus) */}
        {isCurrentMonth && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDate(day.date);
              onOpenCreateModal(day.date);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
            title="Add task on this day"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {visibleTasks.map((task) => (
          <TaskBadge key={task.occurrenceId || task._id} task={task} onClick={onSelectTask} />
        ))}

        {overflowCount > 0 && (
          <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 px-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer">
            +{overflowCount} more
          </div>
        )}
      </div>
    </div>
  );
};
