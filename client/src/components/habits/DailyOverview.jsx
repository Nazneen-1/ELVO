import React from 'react';
import { useHabits } from '../../context/HabitContext.jsx';
import { Button } from '../common/Button.jsx';
import { StreakFireIcon } from './StreakFireIcon.jsx';
import {
  Check,
  Flame,
  Book,
  Dumbbell,
  Heart,
  Droplet,
  Coffee,
  Sun,
  Edit2,
  Archive,
  Calendar,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';

const ICON_MAP = {
  check: Check,
  flame: Flame,
  book: Book,
  dumbbell: Dumbbell,
  heart: Heart,
  droplet: Droplet,
  coffee: Coffee,
  sun: Sun,
};

export const DailyOverview = ({ onEditHabit, onOpenCreateModal }) => {
  const {
    dailyOverview,
    selectedDate,
    toggleHabit,
    archiveHabit,
  } = useHabits();

  if (!dailyOverview) {
    return (
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs flex items-center justify-center py-12 text-slate-400 text-xs">
        Loading day overview...
      </div>
    );
  }

  const { habits = [], totalScheduled = 0, completedCount = 0, completionPercentage = 0, isFuture, isToday } = dailyOverview;

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {isToday ? "Today's Habits" : `Habits for ${selectedDate}`}
          </h2>
          {isToday && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Today
            </span>
          )}
          {isFuture && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
              Upcoming
            </span>
          )}
        </div>

        <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
          <span className="font-bold text-slate-900 dark:text-white">{completedCount}</span> of{' '}
          <span className="font-bold text-slate-900 dark:text-white">{totalScheduled}</span> completed (
          {completionPercentage}%)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {/* Habit Checklist */}
      <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
        {habits.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto" />
            <div className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
              No habits scheduled for this day.
            </div>
            {onOpenCreateModal && (
              <Button size="sm" variant="outline" onClick={onOpenCreateModal} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Habit
              </Button>
            )}
          </div>
        ) : (
          habits.map((habit) => {
            const IconComponent = ICON_MAP[habit.icon] || Check;
            const isCompleted = habit.isCompleted;

            return (
              <div
                key={habit._id}
                className={clsx(
                  'py-3 flex items-center justify-between gap-3 group transition-colors rounded-xl px-2 hover:bg-slate-50/80 dark:hover:bg-zinc-800/50',
                  isCompleted && 'opacity-90'
                )}
              >
                {/* Left: Checkbox + Icon + Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Checkbox */}
                  <button
                    type="button"
                    disabled={isFuture}
                    onClick={() => toggleHabit(habit._id, selectedDate)}
                    title={isFuture ? 'Cannot complete future habits' : isCompleted ? 'Mark incomplete' : 'Mark completed'}
                    className={clsx(
                      'w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 border',
                      isCompleted
                        ? 'border-transparent text-white shadow-xs'
                        : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600',
                      isFuture && 'opacity-40 cursor-not-allowed'
                    )}
                    style={{
                      backgroundColor: isCompleted ? habit.color || '#6366F1' : undefined,
                    }}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* Habit Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold truncate text-slate-900 dark:text-zinc-100"
                        style={{
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: isCompleted ? undefined : undefined,
                        }}
                      >
                        {habit.name}
                      </span>

                      {/* Category Tag */}
                      {habit.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 shrink-0">
                          {habit.category}
                        </span>
                      )}
                    </div>

                    {habit.description && (
                      <p className="text-xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                        {habit.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Streak & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Streak Badge */}
                  {habit.currentStreak > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                      <StreakFireIcon size={13} />
                      {habit.currentStreak}d
                    </span>
                  )}

                  {/* Quick Actions */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEditHabit && (
                      <button
                        type="button"
                        onClick={() => onEditHabit(habit)}
                        title="Edit habit"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => archiveHabit(habit._id)}
                      title="Archive habit"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
