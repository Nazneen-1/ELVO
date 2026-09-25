import React from 'react';
import { clsx } from 'clsx';
import { formatDisplayTime } from '../../utils/dateUtils.js';

export const TaskBadge = ({ task, onClick }) => {
  const isCompleted = task.status === 'Done';

  const colorStyles = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50 hover:border-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/50 hover:border-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50 hover:border-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/50 hover:border-rose-400',
    sky: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/50 hover:border-sky-400',
    purple: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/50 hover:border-purple-400',
    violet: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200/70 dark:border-violet-800/50 hover:border-violet-400',
    teal: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/70 dark:border-teal-800/50 hover:border-teal-400',
    orange: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200/70 dark:border-orange-800/50 hover:border-orange-400',
    pink: 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200/70 dark:border-pink-800/50 hover:border-pink-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200/70 dark:border-cyan-800/50 hover:border-cyan-400',
    lime: 'bg-lime-50 dark:bg-lime-950/60 text-lime-700 dark:text-lime-300 border-lime-200/70 dark:border-lime-800/50 hover:border-lime-400',
    fuchsia: 'bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200/70 dark:border-fuchsia-800/50 hover:border-fuchsia-400',
    slate: 'bg-slate-100 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 border-slate-200/70 dark:border-zinc-700/50 hover:border-slate-400',
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
            task.status === 'Done'
              ? 'bg-emerald-500'
              : task.status === 'In Progress'
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
