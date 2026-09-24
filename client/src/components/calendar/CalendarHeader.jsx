import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { clsx } from 'clsx';

export const CalendarHeader = ({
  monthLabel,
  onPrevMonth,
  onNextMonth,
  onToday,
  onNewTask,
}) => {
  const { filterStatus, setFilterStatus } = useTasks();

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      {/* Left: Navigation Controls & Month Title */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 min-w-[180px]">
          {monthLabel}
        </h2>

        <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-0.5 shadow-subtle">
          <button
            onClick={onPrevMonth}
            className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onToday}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={onNextMonth}
            className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Filters & Action Button */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Status Filters */}
        <div className="flex items-center bg-slate-100 dark:bg-zinc-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 text-xs font-medium">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterStatus(option.value)}
              className={clsx(
                'px-3 py-1 rounded-lg transition-all',
                filterStatus === option.value
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-subtle font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Create Task Button */}
        <Button size="md" variant="primary" onClick={onNewTask} className="shadow-md shadow-indigo-500/20">
          <Plus className="w-4 h-4 mr-1" />
          <span>New Task</span>
        </Button>
      </div>
    </div>
  );
};
