import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { clsx } from 'clsx';

export const CalendarHeader = ({
  monthLabel,
  viewLabel,
  viewMode = 'month',
  onViewModeChange,
  onPrev,
  onNext,
  onPrevMonth,
  onNextMonth,
  onToday,
  onNewTask,
}) => {
  const { filterStatus, setFilterStatus, searchQuery, setSearchQuery } = useTasks();

  const handlePrev = onPrev || onPrevMonth;
  const handleNext = onNext || onNextMonth;
  const displayLabel = viewLabel || monthLabel;

  const viewOptions = [
    { id: 'month', label: 'Month' },
    { id: 'week', label: 'Week' },
    { id: 'day', label: 'Day' },
  ];

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'To Do', label: 'To Do' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Done', label: 'Done' },
  ];

  const prevTooltip = viewMode === 'day' ? 'Previous Day' : viewMode === 'week' ? 'Previous Week' : 'Previous Month';
  const nextTooltip = viewMode === 'day' ? 'Next Day' : viewMode === 'week' ? 'Next Week' : 'Next Month';

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Top Row: Navigation + View Mode Switcher + New Task */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: View label & prev/today/next controls */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 min-w-[170px] truncate">
            {displayLabel}
          </h2>

          <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-0.5 shadow-subtle shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              title={prevTooltip}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              title={nextTooltip}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: View Mode Switcher & New Task Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          {/* View Mode Toggle: Month | Week | Day */}
          {onViewModeChange && (
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800/80 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 text-xs font-semibold shadow-xs">
              {viewOptions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onViewModeChange(v.id)}
                  className={clsx(
                    'px-2.5 sm:px-3 py-1 rounded-lg transition-all capitalize',
                    viewMode === v.id
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-subtle font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          <Button size="md" variant="primary" onClick={onNewTask} className="shadow-md shadow-indigo-500/20 shrink-0">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Bottom Row: Search + Status Filter */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-subtle flex-1 max-w-xs min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs bg-transparent border-none outline-none text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center bg-slate-100 dark:bg-zinc-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 text-xs font-medium">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
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
      </div>
    </div>
  );
};
