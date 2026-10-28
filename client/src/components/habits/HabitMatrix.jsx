import React, { useState, useMemo } from 'react';
import { useHabits } from '../../context/HabitContext.jsx';
import { Button } from '../common/Button.jsx';
import { StreakFireIcon } from './StreakFireIcon.jsx';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Flame,
  Calendar,
  Plus,
  Filter,
} from 'lucide-react';
import { clsx } from 'clsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const HabitMatrix = ({ onOpenCreateModal, onEditHabit }) => {
  const {
    matrixData,
    currentYear,
    currentMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    selectedDate,
    setSelectedDate,
    toggleHabit,
  } = useHabits();

  // Filter state for matrix view: 'all' | 'done' | 'todo' | 'rest'
  const [statusFilter, setStatusFilter] = useState('all');

  const { dates = [], habits = [], dailyBreakdown = {}, summary = {} } = matrixData || {};

  // Compute status counts for the selected date
  const { doneCount, todoCount, restCount } = useMemo(() => {
    let done = 0;
    let todo = 0;
    let rest = 0;

    habits.forEach((h) => {
      const st = h.statuses?.[selectedDate];
      if (!st || !st.isScheduled) {
        rest++;
      } else if (st.isCompleted) {
        done++;
      } else {
        todo++;
      }
    });

    return { doneCount: done, todoCount: todo, restCount: rest };
  }, [habits, selectedDate]);

  // Filtered habits list based on active filter for the selected date
  const filteredHabits = useMemo(() => {
    if (statusFilter === 'all') return habits;

    return habits.filter((h) => {
      const st = h.statuses?.[selectedDate];
      const isScheduled = Boolean(st?.isScheduled);
      const isCompleted = Boolean(st?.isCompleted);

      if (statusFilter === 'done') {
        return isScheduled && isCompleted;
      }
      if (statusFilter === 'todo') {
        return isScheduled && !isCompleted;
      }
      if (statusFilter === 'rest') {
        return !isScheduled;
      }
      return true;
    });
  }, [habits, statusFilter, selectedDate]);

  if (!matrixData) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs flex items-center justify-center py-16 text-slate-400 text-xs">
        Loading monthly tracking matrix...
      </div>
    );
  }

  const monthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden flex flex-col">
      {/* Matrix Controls Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-zinc-900/50">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{monthLabel}</span>
          </h3>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevMonth}
              title="Previous month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              title="Next month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={goToToday}
              className="text-xs px-2.5 py-1"
            >
              Today
            </Button>
          </div>
        </div>

        {/* Interactive Filter Pills & Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Filter for {selectedDate}:</span>
          </span>

          {/* All */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={clsx(
              'px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1 border',
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'
            )}
          >
            <span>All</span>
            <span className="opacity-70 text-[10px]">({habits.length})</span>
          </button>

          {/* Done Filter */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'done' ? 'all' : 'done')}
            title="Show habits completed on selected date"
            className={clsx(
              'px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 border',
              statusFilter === 'done'
                ? 'bg-emerald-600 text-white border-transparent shadow-xs'
                : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'
            )}
          >
            <div className="w-3 h-3 rounded bg-emerald-500 text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
            <span>Done</span>
            <span className="opacity-70 text-[10px]">({doneCount})</span>
          </button>

          {/* To Do Filter */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'todo' ? 'all' : 'todo')}
            title="Show habits scheduled but not completed on selected date"
            className={clsx(
              'px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 border',
              statusFilter === 'todo'
                ? 'bg-amber-600 text-white border-transparent shadow-xs'
                : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'
            )}
          >
            <div className="w-3 h-3 rounded border border-amber-500 bg-amber-50 dark:bg-amber-950/40" />
            <span>To Do</span>
            <span className="opacity-70 text-[10px]">({todoCount})</span>
          </button>

          {/* Rest Filter */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'rest' ? 'all' : 'rest')}
            title="Show habits not scheduled on selected date (rest day)"
            className={clsx(
              'px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 border',
              statusFilter === 'rest'
                ? 'bg-slate-700 text-white dark:bg-zinc-600 border-transparent shadow-xs'
                : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'
            )}
          >
            <div className="w-3 h-3 rounded bg-slate-100 dark:bg-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-400 text-[10px] font-bold">
              -
            </div>
            <span>Rest</span>
            <span className="opacity-70 text-[10px]">({restCount})</span>
          </button>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-zinc-700 mx-1 hidden sm:block" />

          {/* Monthly Rate Summary */}
          <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 ml-auto sm:ml-0">
            Monthly: {summary.monthlyCompletionRate || 0}% ({summary.monthlyCompletedOccurrences || 0}/{summary.monthlyScheduledOccurrences || 0})
          </div>
        </div>
      </div>

      {/* Responsive Matrix Grid with Horizontal Scroll */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full border-collapse text-left min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70 text-slate-500 dark:text-zinc-400 text-xs">
              {/* Sticky Habit Header Column */}
              <th className="sticky left-0 z-20 bg-slate-50 dark:bg-zinc-900 px-4 py-3 font-semibold w-64 min-w-[240px] border-r border-slate-100 dark:border-zinc-800">
                Habit ({filteredHabits.length})
              </th>

              {/* Date Columns */}
              {dates.map((d) => {
                const isSelected = d.date === selectedDate;
                const isToday = d.isToday;

                return (
                  <th
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={clsx(
                      'text-center py-2 px-1 cursor-pointer transition-colors select-none min-w-[28px] max-w-[34px]',
                      isSelected && 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold',
                      isToday && !isSelected && 'bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-bold',
                      !isSelected && !isToday && d.isWeekend && 'bg-slate-100/40 dark:bg-zinc-800/20'
                    )}
                    title={`Select ${d.date}`}
                  >
                    <div className="text-[11px] font-semibold leading-tight">{d.dayNumber}</div>
                    <div className="text-[9px] font-normal opacity-70">
                      {WEEKDAY_SHORT[d.dayOfWeek]}
                    </div>
                  </th>
                );
              })}

              {/* Progress Summary Header */}
              <th className="px-4 py-3 text-right font-semibold w-24">
                Rate
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs">
            {filteredHabits.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 2} className="text-center py-12 text-slate-400">
                  <div className="space-y-3">
                    <p>
                      {statusFilter !== 'all'
                        ? `No habits with status "${statusFilter}" on ${selectedDate}.`
                        : 'No habits configured yet.'}
                    </p>
                    {statusFilter !== 'all' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatusFilter('all')} className="text-xs">
                        Show All Habits
                      </Button>
                    ) : typeof onOpenCreateModal === 'function' ? (
                      <Button size="sm" variant="primary" onClick={onOpenCreateModal} className="text-xs">
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Create your first habit
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              filteredHabits.map((habit) => {
                const color = habit.color || '#6366F1';

                return (
                  <tr
                    key={habit._id}
                    className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Sticky Habit Info Cell */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-4 py-2.5 border-r border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <div
                            className={clsx(
                              'min-w-0 flex-1',
                              typeof onEditHabit === 'function' && 'cursor-pointer group/name'
                            )}
                            onClick={() => {
                              if (typeof onEditHabit === 'function') {
                                onEditHabit(habit);
                              }
                            }}
                            title="Click to edit or manage habit"
                          >
                            <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover/name:text-indigo-600 dark:group-hover/name:text-indigo-400 group-hover/name:underline transition-colors">
                              {habit.name}
                            </p>
                            {habit.category && (
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate block">
                                {habit.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {habit.currentStreak > 0 && (
                          <span className="flex items-center text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md border border-amber-200/50 dark:border-amber-900/30">
                            <StreakFireIcon size={12} className="mr-0.5" />
                            {habit.currentStreak}d
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date Checkbox Cells */}
                    {dates.map((d) => {
                      const status = habit.statuses?.[d.date] || {};
                      const isScheduled = Boolean(status.isScheduled);
                      const isCompleted = Boolean(status.isCompleted);
                      const isFuture = d.isFuture;
                      const isSelected = d.date === selectedDate;

                      return (
                        <td
                          key={d.date}
                          className={clsx(
                            'text-center p-1 select-none',
                            isSelected && 'bg-indigo-50/40 dark:bg-indigo-950/20'
                          )}
                        >
                          {isScheduled ? (
                            <button
                              type="button"
                              disabled={isFuture}
                              onClick={() => {
                                setSelectedDate(d.date);
                                toggleHabit(habit._id, d.date);
                              }}
                              title={
                                isFuture
                                  ? `${habit.name} (${d.date}): Scheduled in future`
                                  : isCompleted
                                  ? `${habit.name} (${d.date}): Completed! Click to uncheck`
                                  : `${habit.name} (${d.date}): To Do — Click to mark completed`
                              }
                              className={clsx(
                                'w-6 h-6 rounded flex items-center justify-center transition-all mx-auto',
                                isCompleted
                                  ? 'text-white shadow-xs'
                                  : isFuture
                                  ? 'border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 opacity-40 cursor-not-allowed'
                                  : 'border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:border-slate-400 dark:hover:border-zinc-500 cursor-pointer'
                              )}
                              style={{
                                backgroundColor: isCompleted ? color : undefined,
                              }}
                            >
                              {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          ) : (
                            /* Rest Day indicator: dash matching legend */
                            <div
                              className="w-6 h-6 flex items-center justify-center mx-auto text-slate-300 dark:text-zinc-600 text-xs font-bold"
                              title={`${habit.name} (${d.date}): Rest day (not scheduled)`}
                            >
                              -
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Month Rate Column */}
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700 dark:text-zinc-300">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-bold">{habit.completionRate || 0}%</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          ({habit.monthCompleted || 0}/{habit.monthScheduled || 0})
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Daily Total Summary Row */}
          {filteredHabits.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                <td className="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-900 px-4 py-2.5 border-r border-slate-100 dark:border-zinc-800">
                  Daily Done %
                </td>

                {dates.map((d) => {
                  const dayStat = dailyBreakdown[d.date] || { percentage: 0 };
                  const isSelected = d.date === selectedDate;

                  return (
                    <td
                      key={d.date}
                      className={clsx(
                        'text-center py-2 px-0.5',
                        isSelected && 'bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      )}
                    >
                      {d.isFuture ? '-' : `${dayStat.percentage}%`}
                    </td>
                  );
                })}

                <td className="px-4 py-2 text-right text-slate-700 dark:text-zinc-300 font-bold">
                  {summary.monthlyCompletionRate || 0}%
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
