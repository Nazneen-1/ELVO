import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import {
  Check,
  Flame,
  Book,
  Dumbbell,
  Heart,
  Droplet,
  Coffee,
  Sun,
  AlertCircle,
  Calendar,
  Archive,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';

const COLOR_OPTIONS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Rose
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

const ICON_OPTIONS = [
  { id: 'check', label: 'Check', Icon: Check },
  { id: 'flame', label: 'Flame', Icon: Flame },
  { id: 'book', label: 'Book', Icon: Book },
  { id: 'dumbbell', label: 'Fitness', Icon: Dumbbell },
  { id: 'heart', label: 'Heart', Icon: Heart },
  { id: 'droplet', label: 'Hydration', Icon: Droplet },
  { id: 'coffee', label: 'Coffee', Icon: Coffee },
  { id: 'sun', label: 'Morning', Icon: Sun },
];

const CATEGORY_OPTIONS = [
  'General',
  'Health & Fitness',
  'Productivity',
  'Mindfulness',
  'Learning',
  'Creative',
];

const DAYS_OF_WEEK = [
  { day: 0, label: 'Sun', short: 'S' },
  { day: 1, label: 'Mon', short: 'M' },
  { day: 2, label: 'Tue', short: 'T' },
  { day: 3, label: 'Wed', short: 'W' },
  { day: 4, label: 'Thu', short: 'T' },
  { day: 5, label: 'Fri', short: 'F' },
  { day: 6, label: 'Sat', short: 'S' },
];

export const HabitFormModal = ({
  isOpen,
  onClose = () => {},
  habit = null,
  onSave = () => {},
  onArchive = null,
  onDelete = null,
}) => {
  const isEditing = Boolean(habit?._id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState('check');
  const [scheduleType, setScheduleType] = useState('daily'); // 'daily', 'weekdays', 'custom'
  const [customDays, setCustomDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (habit) {
        setName(habit.name || '');
        setDescription(habit.description || '');
        setCategory(habit.category || 'General');
        setColor(habit.color || COLOR_OPTIONS[0]);
        setIcon(habit.icon || 'check');
        const schedType = habit.schedule?.type || 'daily';
        setScheduleType(schedType);
        setCustomDays(habit.schedule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
      } else {
        setName('');
        setDescription('');
        setCategory('General');
        setColor(COLOR_OPTIONS[0]);
        setIcon('check');
        setScheduleType('daily');
        setCustomDays([0, 1, 2, 3, 4, 5, 6]);
      }
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, habit]);

  const handleCustomDayToggle = (dayNum) => {
    setCustomDays((prev) => {
      if (prev.includes(dayNum)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== dayNum);
      }
      return [...prev, dayNum].sort((a, b) => a - b);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Habit name is required');
      return;
    }

    let finalDays = [0, 1, 2, 3, 4, 5, 6];
    if (scheduleType === 'weekdays') {
      finalDays = [1, 2, 3, 4, 5];
    } else if (scheduleType === 'custom') {
      if (customDays.length === 0) {
        setError('Select at least one day for the habit schedule');
        return;
      }
      finalDays = customDays;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        color,
        icon,
        schedule: {
          type: scheduleType,
          daysOfWeek: finalDays,
        },
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save habit');
    } finally {
      setLoading(false);
    }
  };

  if (showDeleteConfirm && isEditing) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setShowDeleteConfirm(false)}
        title="Permanently Delete Habit?"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">Permanent Deletion Warning</p>
              <p className="leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-rose-900 dark:text-rose-200 font-semibold">"{habit?.name}"</strong>?
              </p>
              <p className="text-[11px] opacity-90">
                This action cannot be undone. Permanent deletion removes the habit and all of its associated historical completion records.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={loading}
              onClick={async () => {
                try {
                  setLoading(true);
                  if (onDelete) await onDelete(habit._id);
                  setShowDeleteConfirm(false);
                  onClose();
                } catch (err) {
                  setError(err?.response?.data?.message || 'Failed to delete habit');
                  setShowDeleteConfirm(false);
                } finally {
                  setLoading(false);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white border-transparent"
            >
              Delete Habit Permanently
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Habit' : 'Create New Habit'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Habit Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
            Habit Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Read 20 pages, Morning meditation, Drink water"
            required
            maxLength={100}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why is this habit important to you?"
            rows={2}
            maxLength={500}
            className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
          />
        </div>

        {/* Category & Icon Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="select-elvo w-full px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
              Icon
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ICON_OPTIONS.map((opt) => {
                const IconComp = opt.Icon;
                const isSelected = icon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIcon(opt.id)}
                    title={opt.label}
                    className={clsx(
                      'p-1.5 rounded-lg transition-all',
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
            Color
          </label>
          <div className="flex items-center gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={clsx(
                  'w-6 h-6 rounded-full transition-all',
                  color === c
                    ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110'
                    : 'opacity-70 hover:opacity-100'
                )}
              />
            ))}
          </div>
        </div>

        {/* Schedule Selection */}
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Schedule
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setScheduleType('daily')}
              className={clsx(
                'py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center',
                scheduleType === 'daily'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              )}
            >
              Daily (7 days)
            </button>

            <button
              type="button"
              onClick={() => setScheduleType('weekdays')}
              className={clsx(
                'py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center',
                scheduleType === 'weekdays'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              )}
            >
              Weekdays (M-F)
            </button>

            <button
              type="button"
              onClick={() => setScheduleType('custom')}
              className={clsx(
                'py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center',
                scheduleType === 'custom'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              )}
            >
              Custom Days
            </button>
          </div>

          {/* Custom Day Checkboxes */}
          {scheduleType === 'custom' && (
            <div className="flex items-center justify-between gap-1 pt-2 animate-in fade-in duration-150">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = customDays.includes(d.day);
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => handleCustomDayToggle(d.day)}
                    className={clsx(
                      'w-9 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center',
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              {typeof onArchive === 'function' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await onArchive(habit?._id);
                      if (typeof onClose === 'function') onClose();
                    } catch (err) {
                      setError(err?.response?.data?.message || 'Failed to archive habit');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="text-xs"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" />
                  Archive
                </Button>
              )}

              {typeof onDelete === 'function' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading} disabled={loading || !name.trim()}>
              {isEditing ? 'Save Changes' : 'Create Habit'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
