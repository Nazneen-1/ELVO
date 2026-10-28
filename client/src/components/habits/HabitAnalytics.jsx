import React from 'react';
import { useHabits } from '../../context/HabitContext.jsx';
import { HabitTargets } from './HabitTargets.jsx';
import { TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HabitAnalytics = () => {
  const { stats } = useHabits();

  if (!stats) return null;

  const { weeklyTrend = [] } = stats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left Column: 7-Day Completion Trend */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>7-Day Completion Trend</span>
            </h3>
            <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
              Past 7 days
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Percentage of scheduled habits completed each day
          </p>
        </div>

        {/* Bar Visualizer */}
        <div className="pt-2 pb-2">
          <div className="flex items-end gap-3 h-44 border-b border-slate-100 dark:border-zinc-800 pb-2">
            {weeklyTrend.map((point) => {
              const heightPercent = point.percentage;

              return (
                <div
                  key={point.date}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-12 hidden group-hover:flex flex-col items-center z-20 pointer-events-none bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2.5 py-1 rounded-lg text-[10px] whitespace-nowrap shadow-lg">
                    <span className="font-semibold">{point.date} ({WEEKDAYS[point.dayOfWeek]})</span>
                    <span>Done: {point.completed}/{point.scheduled} ({point.percentage}%)</span>
                  </div>

                  <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    {point.percentage}%
                  </span>

                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      className={clsx(
                        'w-full max-w-[34px] rounded-t-lg transition-all duration-300',
                        point.percentage >= 80
                          ? 'bg-emerald-500'
                          : point.percentage >= 40
                          ? 'bg-indigo-600'
                          : point.percentage > 0
                          ? 'bg-amber-500'
                          : 'bg-slate-200 dark:bg-zinc-800'
                      )}
                      style={{ height: `${Math.max(heightPercent, 6)}%` }}
                    />
                  </div>

                  <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate mt-1">
                    {WEEKDAYS[point.dayOfWeek]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trend Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-500 pt-1">
          <span>7-day rolling average</span>
          <span className="font-semibold text-slate-700 dark:text-zinc-300">
            {weeklyTrend.length > 0
              ? Math.round(weeklyTrend.reduce((acc, p) => acc + p.percentage, 0) / weeklyTrend.length)
              : 0}%
          </span>
        </div>
      </div>

      {/* Right Column: Habit Targets Panel */}
      <HabitTargets />
    </div>
  );
};
