import React from 'react';
import { clsx } from 'clsx';
import { formatDisplayTime } from '../../utils/dateUtils.js';

export const TaskBadge = ({ task, onClick }) => {
  const isCompleted = task.status === 'completed';

  const colorStyles = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50 hover:border-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/50 hover:border-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50 hover:border-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/50 hover:border-rose-400',
    sky: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/50 hover:border-sky-400',
    purple: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/50 hover:border-purple-400',
  };

  const currentStyle = colorStyles[task.color] || colorStyles.indigo;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick(task);
      }}
      className={clsx(
        'group flex items-center justify-between px-2 py-1 mb-1 rounded-lg border text-xs font-medium cursor-pointer transition-all duration-150 shadow-subtle',
        currentStyle,
        isCompleted && 'opacity-60 line-through'
      )}
      title={`${task.title} ${task.startTime ? `(${formatDisplayTime(task.startTime)})` : ''}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Status Dot */}
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            task.status === 'completed'
              ? 'bg-emerald-500'
              : task.status === 'in_progress'
              ? 'bg-amber-500 animate-pulse'
              : 'bg-indigo-500'
          )}
        />
        <span className="truncate">{task.title}</span>
      </div>

      {task.startTime && !task.isAllDay && (
        <span className="text-[10px] opacity-75 shrink-0 ml-1">
          {formatDisplayTime(task.startTime)}
        </span>
      )}
    </div>
  );
};
