import React from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { TaskBadge } from './TaskBadge.jsx';

export const DayCell = ({
  day,
  tasks = [],
  isSelected,
  onSelectDate,
  onOpenCreateModal,
  onSelectTask,
}) => {
  const { isCurrentMonth, isToday, dayNumber } = day;
  const visibleTasks = tasks.slice(0, 3);
  const overflowCount = tasks.length - 3;

  return (
    <div
      onClick={() => onSelectDate(day.date)}
      className={clsx(
        'group relative min-h-[90px] sm:min-h-[110px] lg:min-h-[130px] p-2 border-b border-r border-slate-200/70 dark:border-zinc-800/70 transition-colors flex flex-col',
        !isCurrentMonth && 'bg-slate-50/50 dark:bg-zinc-950/40 text-slate-400 dark:text-zinc-600',
        isCurrentMonth && 'bg-white dark:bg-zinc-900/90 text-slate-800 dark:text-zinc-200 hover:bg-slate-50/80 dark:hover:bg-zinc-800/50',
        isSelected && 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/30 dark:bg-indigo-950/20'
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
          <TaskBadge key={task._id} task={task} onClick={onSelectTask} />
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
