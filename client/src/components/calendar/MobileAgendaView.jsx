import React from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, CheckCircle, Clock, CalendarDays } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { formatDisplayTime, toISODate } from '../../utils/dateUtils.js';
import { clsx } from 'clsx';

export const MobileAgendaView = ({
  selectedDate,
  tasks = [],
  onOpenCreateModal,
  onSelectTask,
}) => {
  const formattedSelectedDate = format(selectedDate, 'EEEE, MMMM d');

  return (
    <div className="md:hidden mt-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-4 shadow-subtle">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Selected Day
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {formattedSelectedDate}
          </h3>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => onOpenCreateModal(selectedDate)}
          className="rounded-xl px-3"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Task List for Selected Date */}
      <div className="mt-4 space-y-2.5">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-2">
              <CalendarDays className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
              No tasks scheduled for this day
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Tap 'Add' to create your first task
            </p>
          </div>
        ) : (
          tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            return (
              <div
                key={task._id}
                onClick={() => onSelectTask(task)}
                className={clsx(
                  'p-3 rounded-xl border border-slate-200/70 dark:border-zinc-800/70 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-3 active:scale-[0.99] transition-all',
                  isCompleted && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={clsx(
                      'w-2 h-2 rounded-full shrink-0',
                      task.status === 'completed'
                        ? 'bg-emerald-500'
                        : task.status === 'in_progress'
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    )}
                  />
                  <div className="min-w-0">
                    <p
                      className={clsx(
                        'text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate',
                        isCompleted && 'line-through text-slate-500 dark:text-zinc-500'
                      )}
                    >
                      {task.title}
                    </p>
                    {task.startTime && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatDisplayTime(task.startTime)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <Badge size="xs" variant={task.color || 'indigo'}>
                  {task.priority}
                </Badge>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
