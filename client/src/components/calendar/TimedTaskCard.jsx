import React from 'react';
import { clsx } from 'clsx';
import { formatDisplayTime } from '../../utils/dateUtils.js';
import { CheckCircle2, Clock, Repeat } from 'lucide-react';

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
  const isDone = task.status === 'Done';
  const colorClass = COLOR_MAP[task.color] || COLOR_MAP.indigo;
  const dotColor = DOT_COLOR_MAP[task.status] || DOT_COLOR_MAP['To Do'];

  const timeLabel = task.endTime
    ? `${formatDisplayTime(task.startTime)} – ${formatDisplayTime(task.endTime)}`
    : formatDisplayTime(task.startTime);

  const handleDragStart = (e) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ taskId: task._id, startDate: task.startDate })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
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
      title={`${task.title} (${timeLabel}) - Drag to reschedule`}
    >
      <div className="flex items-start justify-between gap-1 leading-tight">
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
            </h4>
          </div>

          {/* Time range */}
          <p className="text-[10px] opacity-80 flex items-center gap-1 mt-0.5 font-medium truncate">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span>{timeLabel}</span>
          </p>
        </div>

        {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
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
