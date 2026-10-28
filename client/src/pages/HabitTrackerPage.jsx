import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext.jsx';
import { CircularProgressRing } from '../components/habits/CircularProgressRing.jsx';
import { HabitMatrix } from '../components/habits/HabitMatrix.jsx';
import { HabitAnalytics } from '../components/habits/HabitAnalytics.jsx';
import { HabitFormModal } from '../components/habits/HabitFormModal.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { Button } from '../components/common/Button.jsx';
import { StreakFireIcon } from '../components/habits/StreakFireIcon.jsx';
import {
  Plus,
  Flame,
  Calendar,
  CheckCircle2,
  Archive,
  RotateCcw,
  Trash2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

export const HabitTrackerPage = () => {
  const {
    habits,
    archivedHabits,
    selectedDate,
    dailyOverview,
    matrixData,
    stats,
    loading,
    error,
    refreshHabits,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    deleteHabit,
    goToToday,
  } = useHabits();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [showArchivedModal, setShowArchivedModal] = useState(false);

  const handleSaveHabit = async (habitData) => {
    if (editingHabit) {
      await updateHabit(editingHabit._id, habitData);
      setEditingHabit(null);
    } else {
      await createHabit(habitData);
    }
  };

  const isToday = dailyOverview?.isToday;
  const ringPercentage = dailyOverview?.completionPercentage || 0;
  const ringDone = dailyOverview?.completedCount || 0;
  const ringTotal = dailyOverview?.totalScheduled || 0;

  const monthlyRate = matrixData?.summary?.monthlyCompletionRate || 0;
  const monthlyDone = matrixData?.summary?.monthlyCompletedOccurrences || 0;
  const monthlyTotal = matrixData?.summary?.monthlyScheduledOccurrences || 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F5F5] dark:bg-[#1A1A1A] overflow-y-auto">
      {/* Page Header */}
      <div className="px-6 py-5 border-b border-[#E0E0E0] dark:border-[#3A3A3A] bg-white dark:bg-[#2B2B2B] shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-elvo-noir dark:text-white">
              Habit Tracker
            </h1>
            <p className="text-xs text-elvo-iron dark:text-elvo-silver mt-0.5">
              Build daily consistency with interactive monthly tracking and streak analytics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {archivedHabits.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setShowArchivedModal(true)}
                className="text-xs"
              >
                <Archive className="w-3.5 h-3.5 mr-1" />
                Archived ({archivedHabits.length})
              </Button>
            )}

            <Button
              variant="primary"
              onClick={() => {
                setEditingHabit(null);
                setShowCreateModal(true);
              }}
              className="text-xs shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Habit
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Error Feedback */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={refreshHabits} className="text-xs">
              Retry
            </Button>
          </div>
        )}

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: 360 Progress Ring (Dynamically labeled to match selected date) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs flex items-center justify-between">
            <CircularProgressRing
              percentage={ringPercentage}
              label={isToday ? "Today's Progress" : `Progress (${selectedDate})`}
              sublabel={`${ringDone}/${ringTotal}`}
              size={96}
              strokeWidth={8}
            />
            {!isToday && (
              <button
                type="button"
                onClick={goToToday}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
              >
                Back to Today
              </button>
            )}
          </div>

          {/* Card 2: Monthly Consistency */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Monthly Consistency
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {monthlyRate}%
              </span>
            </div>

            <div className="space-y-1.5 my-2">
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {monthlyDone}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  of {monthlyTotal} scheduled
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${monthlyRate}%` }}
                />
              </div>
            </div>

            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              Across all scheduled habits this month
            </span>
          </div>

          {/* Card 3: Streaks Summary */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Streaks Overview
              </span>
              <StreakFireIcon size={16} />
            </div>

            <div className="grid grid-cols-2 gap-3 my-2">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
                  Best Streak
                </span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {stats?.streaks?.maxBestStreak || 0}
                  <span className="text-xs font-normal text-slate-400 ml-1">days</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase font-semibold">
                  Habits on Streak
                </span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {stats?.streaks?.totalActiveStreaks || 0}
                  <span className="text-xs font-normal text-slate-400 ml-1">habits</span>
                </span>
              </div>
            </div>

            <span className="text-[11px] text-slate-400 dark:text-zinc-500">
              Active consecutive day streaks
            </span>
          </div>
        </div>

        {/* Section 1: Monthly Habit Matrix */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Monthly Habit Matrix
            </h2>
          </div>
          <HabitMatrix
            onOpenCreateModal={() => {
              setEditingHabit(null);
              setShowCreateModal(true);
            }}
            onEditHabit={(habit) => {
              setEditingHabit(habit);
              setShowCreateModal(true);
            }}
          />
        </section>

        {/* Section 2: Analytics & Targets (Full width with 50/50 desktop split) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Analytics & Targets
            </h2>
          </div>
          <HabitAnalytics />
        </section>
      </div>

      {/* Habit Create / Edit Modal */}
      <HabitFormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingHabit(null);
        }}
        habit={editingHabit}
        onSave={handleSaveHabit}
        onArchive={archiveHabit}
        onDelete={deleteHabit}
      />

      {/* Archived Habits Modal */}
      <Modal
        isOpen={showArchivedModal}
        onClose={() => setShowArchivedModal(false)}
        title="Archived Habits"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Archived habits are hidden from the active daily tracker and monthly matrix, but their historical logs remain preserved.
          </p>

          <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
            {archivedHabits.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center italic">
                No archived habits.
              </p>
            ) : (
              archivedHabits.map((h) => (
                <div key={h._id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {h.name}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Archived on {h.archivedAt ? new Date(h.archivedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreHabit(h._id)}
                      className="text-xs"
                      title="Restore habit"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Restore
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Permanently delete "${h.name}" and its logs?`)) {
                          deleteHabit(h._id);
                        }
                      }}
                      title="Permanently delete"
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
            <Button variant="ghost" onClick={() => setShowArchivedModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
