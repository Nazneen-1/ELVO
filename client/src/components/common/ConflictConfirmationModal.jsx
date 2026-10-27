import React, { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { AlertTriangle, Clock, Calendar, AlertCircle } from 'lucide-react';
import { formatDisplayTime } from '../../utils/dateUtils.js';

export const ConflictConfirmationModal = ({
  isOpen,
  conflicts = [],
  onProceed,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleProceed = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onProceed();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Scheduling Conflict Detected"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Banner Alert */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              {conflicts.length === 1
                ? '1 task conflict was detected'
                : `${conflicts.length} task conflicts were detected`}
            </p>
            <p className="text-amber-700/90 dark:text-amber-300/80 text-xs">
              Review the conflicting items below. You can proceed to save anyway or cancel to keep the task unchanged.
            </p>
          </div>
        </div>

        {/* Conflicts List */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {conflicts.map((item, idx) => {
            const hasDuplicateTitle = item.reasons?.includes('DUPLICATE_TITLE');
            const hasTimeOverlap = item.reasons?.includes('TIME_OVERLAP');

            return (
              <div
                key={item.occurrenceId || item.taskId || idx}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-800 dark:text-zinc-200 line-clamp-2">
                    {item.title}
                  </div>
                  {item.isOccurrence && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
                      Recurring
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-zinc-400">
                  <div className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    <span>{item.date || item.startDate}</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    <span>
                      {item.isAllDay || (!item.startTime && !item.endTime)
                        ? 'All Day'
                        : `${formatDisplayTime(item.startTime)} – ${formatDisplayTime(item.endTime)}`}
                    </span>
                  </div>
                </div>

                {/* Reason Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/50 dark:border-zinc-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Conflict:
                  </span>
                  {hasDuplicateTitle && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                      Duplicate Title
                    </span>
                  )}
                  {hasTimeOverlap && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                      Time Overlap
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleProceed}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Proceed anyway
          </Button>
        </div>
      </div>
    </Modal>
  );
};
