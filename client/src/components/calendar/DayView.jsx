import React, { useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Plus, Calendar, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { TimedTaskCard } from './TimedTaskCard.jsx';
import { TaskBadge } from './TaskBadge.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import {
  computeTimedTasksLayout,
  formatDisplayTime,
  toISODate,
  format,
  calculateShiftedTimes,
  calculateDateUpdates,
} from '../../utils/dateUtils.js';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const DayView = ({
  currentDate,
  onOpenCreateModal,
  onSelectTask,
}) => {
  const { tasksByDate, patchTask, rescheduleOccurrence, setCalendarError } = useTasks();
  const scrollContainerRef = useRef(null);

  const activeDate = currentDate || new Date();
  const activeIso = toISODate(activeDate);
  const dayTasks = tasksByDate[activeIso] || [];

  const { allDayTasks, timedTasks } = computeTimedTasksLayout(dayTasks);

  // Auto-scroll to 08:00 on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 480;
    }
  }, [activeIso]);

  // Current time marker
  const now = new Date();
  const todayIso = toISODate(now);
  const isToday = activeIso === todayIso;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePercent = (currentMinutes / 1440) * 100;

  const parsePayload = (e) => {
    const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Plain string fallback
    }
    return { taskId: raw };
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToHour = async (e, hour) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const parsed = parsePayload(e);
      if (!parsed || !parsed.taskId) return;

      const { startTime: newStart, endTime: newEnd } = calculateShiftedTimes(
        parsed.startTime,
        parsed.endTime,
        hour,
        0,
        60
      );

      // Check if dropped onto the exact same position
      if (
        !parsed.isAllDay &&
        toISODate(parsed.startDate) === activeIso &&
        parsed.startTime === newStart &&
        parsed.endTime === newEnd
      ) {
        return;
      }

      let res;
      if (parsed.isOccurrence && parsed.originalOccurrenceDate) {
        res = await rescheduleOccurrence(parsed.masterTaskId || parsed.taskId, parsed.originalOccurrenceDate, {
          rescheduledDate: activeIso,
          startTime: newStart,
          endTime: newEnd,
          isAllDay: false,
        });
      } else {
        const dateUpdates = calculateDateUpdates(parsed, activeIso);
        res = await patchTask(parsed.taskId, {
          ...dateUpdates,
          startTime: newStart,
          endTime: newEnd,
          isAllDay: false,
        });
      }

      if (res && !res.success && !res.cancelled) {
        setCalendarError(res.error || 'Failed to move task. Reverted to original schedule.');
      }
    } catch (err) {
      console.error('Failed to reschedule task in day view:', err);
      setCalendarError('Failed to move task due to an unexpected error.');
    }
  };

  const handleDropToAllDay = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const parsed = parsePayload(e);
      if (!parsed || !parsed.taskId) return;

      if (parsed.isAllDay && toISODate(parsed.startDate) === activeIso) {
        return;
      }

      let res;
      if (parsed.isOccurrence && parsed.originalOccurrenceDate) {
        res = await rescheduleOccurrence(parsed.masterTaskId || parsed.taskId, parsed.originalOccurrenceDate, {
          rescheduledDate: activeIso,
          startTime: parsed.startTime || null,
          endTime: parsed.endTime || null,
          isAllDay: true,
        });
      } else {
        const dateUpdates = calculateDateUpdates(parsed, activeIso);
        res = await patchTask(parsed.taskId, {
          ...dateUpdates,
          startTime: parsed.startTime || null,
          endTime: parsed.endTime || null,
          isAllDay: true,
        });
      }

      if (res && !res.success && !res.cancelled) {
        setCalendarError(res.error || 'Failed to move task to all-day. Reverted to original schedule.');
      }
    } catch (err) {
      console.error('Failed to move task to all-day in day view:', err);
      setCalendarError('Failed to move task due to an unexpected error.');
    }
  };

  const handleCanvasDrop = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const hour = Math.min(23, Math.max(0, Math.floor(offsetY / 60)));
    handleDropToHour(e, hour);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle overflow-hidden flex flex-col">
      {/* =================================================================== */}
      {/* DAY VIEW HEADER                                                     */}
      {/* =================================================================== */}
      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-zinc-950/70 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold shadow-xs transition-colors',
              isToday
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-200/80 dark:border-zinc-700/80'
            )}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider leading-none">
              {format(activeDate, 'EEE')}
            </span>
            <span className="text-lg leading-tight mt-0.5">{format(activeDate, 'd')}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">
                {format(activeDate, 'EEEE, MMMM d, yyyy')}
              </h3>
              {isToday && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                  Today
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'} scheduled (
              {allDayTasks.length} all-day, {timedTasks.length} timed)
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => onOpenCreateModal(activeDate)}
          className="shadow-sm shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Add Task</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* =================================================================== */}
      {/* ALL-DAY TASKS SECTION                                               */}
      {/* =================================================================== */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={handleDropToAllDay}
        className="p-3 bg-slate-50/60 dark:bg-zinc-950/40 border-b border-slate-200/80 dark:border-zinc-800/80 grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr] items-center transition-colors min-h-[46px]"
      >
        <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-right pr-3">
          All Day
        </span>
        <div className="flex flex-wrap gap-2 items-center min-h-[28px]">
          {allDayTasks.map((task) => (
            <div key={task.occurrenceId || task._id} className="min-w-[160px] max-w-xs">
              <TaskBadge task={task} onClick={onSelectTask} />
            </div>
          ))}
          {allDayTasks.length === 0 && (
            <span className="text-xs text-slate-400 dark:text-zinc-500 italic select-none">
              Drag task here to make all-day
            </span>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 24-HOUR SCROLLABLE CANVAS                                           */}
      {/* =================================================================== */}
      <div
        ref={scrollContainerRef}
        onDragOver={handleDragOver}
        className="overflow-y-auto max-h-[680px] relative select-none"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr] relative min-h-[1440px]">
          {/* Hourly time labels */}
          <div className="border-r border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-950/30">
            {HOURS.map((hour) => {
              const displayH =
                hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
              return (
                <div
                  key={hour}
                  className="h-[60px] relative border-b border-transparent"
                >
                  <span
                    className={clsx(
                      'absolute right-3 text-xs font-medium text-slate-400 dark:text-zinc-500 select-none pointer-events-none',
                      hour === 0 ? 'top-1.5' : '-top-2.5'
                    )}
                  >
                    {displayH}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Timeline canvas */}
          <div
            className="relative"
            onDragOver={handleDragOver}
            onDrop={handleCanvasDrop}
          >
            {/* Hour slot divisions */}
            {HOURS.map((hour) => {
              const hourStr = `${String(hour).padStart(2, '0')}:00`;
              return (
                <div
                  key={hour}
                  onClick={() => onOpenCreateModal(activeDate, hourStr)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => handleDropToHour(e, hour)}
                  className="h-[60px] border-b border-slate-100 dark:border-zinc-800/50 hover:bg-slate-50/70 dark:hover:bg-zinc-800/25 cursor-pointer transition-colors relative group"
                  title={`Click to add task at ${formatDisplayTime(hourStr)}`}
                >
                  {/* Subtle 30-min dashed guide line */}
                  <div className="absolute top-[30px] left-0 right-0 border-b border-dashed border-slate-100/70 dark:border-zinc-800/30 pointer-events-none" />
                </div>
              );
            })}

            {/* Red / Indigo current time marker if today */}
            {isToday && (
              <div
                style={{ top: `${currentTimePercent}%` }}
                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1 shadow-sm shadow-rose-500/50" />
                <span className="h-0.5 bg-rose-500 flex-1" />
              </div>
            )}

            {/* Overlap-safe timed task cards */}
            {timedTasks.map((timed) => (
              <TimedTaskCard
                key={timed.task.occurrenceId || timed.task._id}
                task={timed.task}
                topPercent={timed.topPercent}
                heightPercent={timed.heightPercent}
                leftPercent={timed.leftPercent}
                widthPercent={timed.widthPercent}
                onClick={onSelectTask}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
