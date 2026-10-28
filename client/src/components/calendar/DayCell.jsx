import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Plus, ChevronUp } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const dragCounter = useRef(0);

  const overflowThreshold = 3;
  const hasOverflow = tasks.length > overflowThreshold;
  const visibleTasks = isExpanded ? tasks : tasks.slice(0, overflowThreshold);
  const overflowCount = tasks.length - overflowThreshold;

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
        'group relative min-h-[96px] sm:min-h-[115px] lg:min-h-[135px] max-h-[220px] p-2 border-b border-r border-[#E0E0E0] dark:border-[#3A3A3A] transition-colors flex flex-col',
        !isCurrentMonth && 'bg-[#F5F5F5]/60 dark:bg-[#1A1A1A]/40 text-[#848484] dark:text-[#565656]',
        isCurrentMonth && 'bg-white dark:bg-[#2B2B2B] text-[#2B2B2B] dark:text-[#E0E0E0] hover:bg-[#F5F5F5]/80 dark:hover:bg-[#1A1A1A]/50',
        isSelected && 'ring-2 ring-[#565656] dark:ring-[#B3B3B3] ring-inset bg-black/[0.02] dark:bg-white/[0.02]',
        isDragOver && 'ring-2 ring-[#2B2B2B] dark:ring-white ring-inset bg-black/[0.05] dark:bg-white/[0.05]'
      )}
    >
      {/* Date Header inside Cell */}
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <span
          className={clsx(
            'inline-flex items-center justify-center text-xs font-semibold rounded-full transition-colors',
            isToday
              ? 'w-6 h-6 bg-[#2B2B2B] text-white dark:bg-[#E0E0E0] dark:text-[#2B2B2B] shadow-sm font-bold'
              : 'w-6 h-6 text-[#565656] dark:text-[#B3B3B3]'
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
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            title="Add task on this day"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Task List (Scrollable when expanded or many tasks) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'flex-1 space-y-1 pr-0.5',
          isExpanded ? 'overflow-y-auto max-h-[140px]' : 'overflow-hidden'
        )}
      >
        {visibleTasks.map((task) => (
          <TaskBadge
            key={task.occurrenceId || task._id}
            task={task}
            onClick={onSelectTask}
          />
        ))}

        {hasOverflow && !isExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(true);
              }
            }}
            className="w-full text-left text-[10px] font-bold text-[#565656] dark:text-[#B3B3B3] hover:text-[#2B2B2B] dark:hover:text-white px-1 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            +{overflowCount} more
          </button>
        )}

        {isExpanded && hasOverflow && (
          <div className="pt-1 flex items-center justify-between border-t border-[#E0E0E0] dark:border-[#3A3A3A] mt-1">
            <span className="text-[9px] text-[#848484]">
              {tasks.length} tasks
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="text-[9px] font-bold text-[#565656] dark:text-[#B3B3B3] hover:text-[#2B2B2B] dark:hover:text-white flex items-center gap-0.5 px-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span>Less</span>
              <ChevronUp className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
