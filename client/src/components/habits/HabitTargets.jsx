import React, { useState, useEffect, useCallback } from 'react';
import { habitService } from '../../services/habitService.js';
import { Button } from '../common/Button.jsx';
import {
  Target,
  Plus,
  Trash2,
  Check,
  Save,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

export const HabitTargets = () => {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadTargets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await habitService.getHabitTargets();
      if (res.success && Array.isArray(res.data)) {
        setTargets(
          res.data.map((t) => ({
            ...t,
            completed: Boolean(t.completed),
            isDirty: false,
            isSaving: false,
            savedJustNow: false,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load habit targets:', err);
      setError('Failed to load personal targets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const handleAddTarget = () => {
    const existingEmpty = targets.find((t) => t.isNew && !t.habitName.trim() && !t.target.trim());
    if (existingEmpty) return;

    const newTarget = {
      _id: `temp_${Date.now()}`,
      habitName: '',
      target: '',
      completed: false,
      isNew: true,
      isDirty: true,
      isSaving: false,
    };
    setTargets((prev) => [newTarget, ...prev]);
  };

  const handleFieldChange = (id, field, value) => {
    setTargets((prev) =>
      prev.map((t) => {
        if (t._id === id) {
          return {
            ...t,
            [field]: value,
            isDirty: true,
            savedJustNow: false,
            rowError: null,
          };
        }
        return t;
      })
    );
  };

  const handleToggleComplete = async (item) => {
    const nextCompleted = !item.completed;
    // Optimistic UI update
    setTargets((prev) =>
      prev.map((t) => (t._id === item._id ? { ...t, completed: nextCompleted } : t))
    );

    if (!item.isNew && !String(item._id).startsWith('temp_')) {
      try {
        await habitService.updateHabitTarget(item._id, { completed: nextCompleted });
      } catch (err) {
        console.error('Failed to toggle habit target completion:', err);
        // Revert on error
        setTargets((prev) =>
          prev.map((t) =>
            t._id === item._id ? { ...t, completed: item.completed, rowError: 'Failed to update status' } : t
          )
        );
      }
    }
  };

  const handleSaveRow = async (item) => {
    const habitName = item.habitName.trim();
    const target = item.target.trim();

    if (!habitName || !target) {
      setTargets((prev) =>
        prev.map((t) => (t._id === item._id ? { ...t, rowError: 'Both fields are required' } : t))
      );
      return;
    }

    setTargets((prev) =>
      prev.map((t) => (t._id === item._id ? { ...t, isSaving: true, rowError: null } : t))
    );

    try {
      if (item.isNew) {
        const res = await habitService.createHabitTarget({
          habitName,
          target,
          completed: Boolean(item.completed),
        });
        if (res.success && res.data) {
          setTargets((prev) =>
            prev.map((t) =>
              t._id === item._id
                ? {
                    ...res.data,
                    completed: Boolean(res.data.completed),
                    isNew: false,
                    isDirty: false,
                    isSaving: false,
                    savedJustNow: true,
                    rowError: null,
                  }
                : t
            )
          );
        }
      } else {
        const res = await habitService.updateHabitTarget(item._id, {
          habitName,
          target,
          completed: Boolean(item.completed),
        });
        if (res.success && res.data) {
          setTargets((prev) =>
            prev.map((t) =>
              t._id === item._id
                ? {
                    ...res.data,
                    completed: Boolean(res.data.completed),
                    isDirty: false,
                    isSaving: false,
                    savedJustNow: true,
                    rowError: null,
                  }
                : t
            )
          );
        }
      }

      setTimeout(() => {
        setTargets((prev) =>
          prev.map((t) => (t.habitName === habitName ? { ...t, savedJustNow: false } : t))
        );
      }, 2500);
    } catch (err) {
      console.error('Failed to save habit target:', err);
      const msg = err.response?.data?.message || 'Failed to save target';
      setTargets((prev) =>
        prev.map((t) => (t._id === item._id ? { ...t, isSaving: false, rowError: msg } : t))
      );
    }
  };

  const handleDelete = async (id) => {
    if (String(id).startsWith('temp_')) {
      setTargets((prev) => prev.filter((t) => t._id !== id));
      setDeleteConfirmId(null);
      return;
    }

    try {
      setTargets((prev) =>
        prev.map((t) => (t._id === id ? { ...t, isSaving: true } : t))
      );
      await habitService.deleteHabitTarget(id);
      setTargets((prev) => prev.filter((t) => t._id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete habit target:', err);
      setTargets((prev) =>
        prev.map((t) =>
          t._id === id
            ? { ...t, isSaving: false, rowError: 'Failed to delete target' }
            : t
        )
      );
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-[#2B2B2B] border border-[#E0E0E0] dark:border-[#3A3A3A] shadow-xs flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#2B2B2B] dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-[#565656] dark:text-[#B3B3B3]" />
            <span>Habit Targets</span>
          </h3>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAddTarget}
            className="text-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Target
          </Button>
        </div>
        <p className="text-xs text-[#848484] dark:text-[#B3B3B3] mt-1">
          Set personal goals and mark targets complete as you achieve them.
        </p>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs text-rose-700 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadTargets}
            className="underline font-semibold hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Target Rows Table */}
      <div className="pt-1 flex-1 min-h-[220px]">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#848484]">
            <Loader2 className="w-5 h-5 animate-spin text-[#565656] dark:text-[#B3B3B3]" />
            <span>Loading personal targets...</span>
          </div>
        ) : targets.length === 0 ? (
          <div className="py-12 px-4 rounded-xl border border-dashed border-[#E0E0E0] dark:border-[#3A3A3A] flex flex-col items-center justify-center text-center space-y-2">
            <Target className="w-7 h-7 text-[#848484]/40" />
            <p className="text-xs font-medium text-[#565656] dark:text-[#B3B3B3]">
              No habit targets added yet.
            </p>
            <p className="text-[11px] text-[#848484] max-w-xs">
              Personal targets define your aim (e.g., "Reading: 30 minutes daily").
            </p>
            <Button size="sm" variant="outline" onClick={handleAddTarget} className="text-xs mt-1">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add your first target
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E0E0E0] dark:border-[#3A3A3A] text-[11px] font-semibold uppercase tracking-wider text-[#848484]">
                  <th className="pb-2 pr-2 w-8 text-center font-semibold">Done</th>
                  <th className="pb-2 px-2 w-5/12 font-semibold">Habit Name</th>
                  <th className="pb-2 px-2 w-5/12 font-semibold">Target</th>
                  <th className="pb-2 pl-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]/60 dark:divide-[#3A3A3A]/60">
                {targets.map((item) => {
                  const canSave = Boolean(item.habitName.trim() && item.target.trim() && item.isDirty);
                  const isConfirmingDelete = deleteConfirmId === item._id;

                  return (
                    <tr
                      key={item._id}
                      className={clsx(
                        'group transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                        item.completed && 'opacity-70'
                      )}
                    >
                      {/* Checkbox Column */}
                      <td className="py-2.5 pr-2 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item)}
                          className={clsx(
                            'w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer',
                            item.completed
                              ? 'border-[#2B2B2B] bg-[#2B2B2B] dark:border-white dark:bg-white text-white dark:text-[#2B2B2B]'
                              : 'border-[#848484] dark:border-[#565656] hover:border-[#2B2B2B] dark:hover:border-white bg-white/70 dark:bg-black/30'
                          )}
                          title={item.completed ? 'Mark target incomplete' : 'Mark target completed'}
                        >
                          {item.completed && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                      </td>

                      {/* Habit Name Field */}
                      <td className="py-2.5 px-2 align-top">
                        <input
                          type="text"
                          value={item.habitName}
                          placeholder="e.g. Reading"
                          onChange={(e) => handleFieldChange(item._id, 'habitName', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canSave) handleSaveRow(item);
                          }}
                          className={clsx(
                            'w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                            'bg-[#F5F5F5] dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-[#3A3A3A]',
                            'text-[#2B2B2B] dark:text-[#E0E0E0] placeholder:text-[#848484]',
                            'focus:outline-none focus:ring-1 focus:ring-[#565656] dark:focus:ring-[#B3B3B3] focus:bg-white dark:focus:bg-[#2B2B2B]',
                            item.completed && 'line-through text-[#848484]'
                          )}
                        />
                        {item.rowError && (
                          <span className="text-[10px] text-rose-500 mt-0.5 block truncate">
                            {item.rowError}
                          </span>
                        )}
                      </td>

                      {/* Target Description Field */}
                      <td className="py-2.5 px-2 align-top">
                        <input
                          type="text"
                          value={item.target}
                          placeholder="e.g. 30 mins daily"
                          onChange={(e) => handleFieldChange(item._id, 'target', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canSave) handleSaveRow(item);
                          }}
                          className={clsx(
                            'w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                            'bg-[#F5F5F5] dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-[#3A3A3A]',
                            'text-[#2B2B2B] dark:text-[#E0E0E0] placeholder:text-[#848484]',
                            'focus:outline-none focus:ring-1 focus:ring-[#565656] dark:focus:ring-[#B3B3B3] focus:bg-white dark:focus:bg-[#2B2B2B]',
                            item.completed && 'line-through text-[#848484]'
                          )}
                        />
                      </td>

                      {/* Actions Column */}
                      <td className="py-2.5 pl-2 align-top text-right">
                        {isConfirmingDelete ? (
                          <div className="flex items-center justify-end gap-1.5 py-1">
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                              Delete?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(item._id)}
                              className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-1.5 py-0.5 rounded text-[11px] text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {item.savedJustNow && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 mr-1">
                                <Check className="w-3 h-3" />
                                <span>Saved</span>
                              </span>
                            )}

                            {canSave && (
                              <button
                                type="button"
                                disabled={item.isSaving}
                                onClick={() => handleSaveRow(item)}
                                title="Save changes"
                                className="p-1.5 rounded-lg text-[#2B2B2B] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                              >
                                {item.isSaving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={item.isSaving}
                              onClick={() => setDeleteConfirmId(item._id)}
                              title="Delete target"
                              className="p-1.5 rounded-lg text-[#848484] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
