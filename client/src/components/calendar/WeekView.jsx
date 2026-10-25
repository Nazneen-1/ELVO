import React, { useRef, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Plus, Clock } from 'lucide-react';
import { TimedTaskCard } from './TimedTaskCard.jsx';
import { TaskBadge } from './TaskBadge.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { computeTimedTasksLayout, formatDisplayTime, toISODate } from '../../utils/dateUtils.js';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const WeekView = ({
  weekDays = [],
  selectedDate,
  onSelectDate,
  onOpenCreateModal,
  onSelectTask,
}) => {
  const { tasksByDate, patchTask } = useTasks();
  const scrollContainerRef = useRef(null);
  const [activeMobileDayIndex, setActiveMobileDayIndex] = useState(0);
  const [dragOverDayIso, setDragOverDayIso] = useState(null);

  const selectedDateISO = toISODate(selectedDate);

  // Auto-scroll to 08:00 (work hours) on initial mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      // 8 hours * 60px per hour = 480px scroll
      scrollContainerRef.current.scrollTop = 480;
    }
  }, []);

  // Sync mobile active day with selectedDate if it's in this week
  useEffect(() => {
    const idx = weekDays.findIndex((d) => d.isoString === selectedDateISO);
    if (idx !== -1) {
      setActiveMobileDayIndex(idx);
    }
  }, [selectedDateISO, weekDays]);

  // Current time marker computation
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePercent = (currentMinutes / 1440) * 100;
  const todayIso = toISODate(now);

  const handleDragOver = (e, dayIso) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDayIso !== dayIso) {
      setDragOverDayIso(dayIso);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverDayIso(null);
  };

  const handleDrop = async (e, targetDay) => {
    e.preventDefault();
    setDragOverDayIso(null);
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!raw) return;

      let taskId = raw;
      let fromDate = null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.taskId) {
          taskId = parsed.taskId;
          fromDate = parsed.startDate;
        }
      } catch {
        // Plain string fallback
      }

      if (fromDate && toISODate(fromDate) === targetDay.isoString) {
        return;
      }

      await patchTask(taskId, { startDate: targetDay.isoString });
    } catch (err) {
      console.error('Failed to reschedule task via week drop:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle overflow-hidden flex flex-col">
      {/* =================================================================== */}
      {/* MOBILE DAY SELECTOR STRIP (< 768px)                                */}
      {/* =================================================================== */}
      <div className="md:hidden flex items-center justify-between p-2.5 bg-slate-50 dark:bg-zinc-950/80 border-b border-slate-200/80 dark:border-zinc-800/80 overflow-x-auto gap-1.5">
        {weekDays.map((day, idx) => {
          const isActive = idx === activeMobileDayIndex;
          const dayTasks = tasksByDate[day.isoString] || [];
          return (
            <button
              key={day.isoString}
              type="button"
              onClick={() => {
                setActiveMobileDayIndex(idx);
                onSelectDate(day.date);
              }}
              className={clsx(
                'flex-1 min-w-[46px] py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-800/60'
              )}
            >
              <span className={clsx('text-[10px] uppercase font-bold tracking-wider', isActive ? 'text-indigo-100' : 'text-slate-400 dark:text-zinc-500')}>
                {day.dayName.slice(0, 3)}
              </span>
              <span className="text-sm font-bold mt-0.5">{day.dayNumber}</span>
              {dayTasks.length > 0 && (
                <span
                  className={clsx(
                    'w-1 h-1 rounded-full mt-1',
                    isActive ? 'bg-white' : 'bg-indigo-500'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* DESKTOP WEEKDAY HEADER ROW                                          */}
      {/* =================================================================== */}
      <div className="hidden md:grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-950/60 sticky top-0 z-20">
        {/* Time gutter corner */}
        <div className="p-3 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-right pr-3 border-r border-slate-200/80 dark:border-zinc-800/80">
          GMT
        </div>

        {/* 7 Day Headers */}
        {weekDays.map((day) => {
          const isSelected = selectedDateISO === day.isoString;
          return (
            <div
              key={day.isoString}
              onClick={() => onSelectDate(day.date)}
              className={clsx(
                'group py-2.5 px-2 text-center border-r border-slate-200/80 dark:border-zinc-800/80 last:border-r-0 cursor-pointer transition-colors',
                isSelected && 'bg-indigo-50/40 dark:bg-indigo-950/20'
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  {day.dayName}
                </span>
                <span
                  className={clsx(
                    'w-6 h-6 inline-flex items-center justify-center text-xs font-bold rounded-full transition-all',
                    day.isToday
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                      : 'text-slate-800 dark:text-zinc-200 group-hover:bg-slate-200/60 dark:group-hover:bg-zinc-800'
                  )}
                >
                  {day.dayNumber}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDate(day.date);
                    onOpenCreateModal(day.date);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-opacity"
                  title={`Add task on ${day.dayName} ${day.dayNumber}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* ALL-DAY TASKS BAR (Pinned above scrollable hours)                   */}
      {/* =================================================================== */}
      <div className="hidden md:grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-950/30 min-h-[42px] max-h-[110px] overflow-y-auto">
        <div className="p-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-right pr-3 border-r border-slate-200/80 dark:border-zinc-800/80 self-center">
          All Day
        </div>

        {weekDays.map((day) => {
          const dayTasks = tasksByDate[day.isoString] || [];
          const { allDayTasks } = computeTimedTasksLayout(dayTasks);
          return (
            <div
              key={`allday-${day.isoString}`}
              onClick={() => onSelectDate(day.date)}
              className="p-1 border-r border-slate-200/80 dark:border-zinc-800/80 last:border-r-0 space-y-1"
            >
              {allDayTasks.map((task) => (
                <TaskBadge key={task.occurrenceId || task._id} task={task} onClick={onSelectTask} />
              ))}
              {allDayTasks.length === 0 && (
                <div
                  onClick={() => onOpenCreateModal(day.date)}
                  className="h-full min-h-[30px] rounded hover:bg-slate-100/60 dark:hover:bg-zinc-800/30 cursor-pointer"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* 24-HOUR TIME GRID (Desktop 7-Col + Mobile Single-Col Active Day)     */}
      {/* =================================================================== */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto max-h-[680px] relative select-none"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* DESKTOP 7-COLUMN HOURLY CANVAS */}
        <div className="hidden md:grid grid-cols-[64px_repeat(7,1fr)] relative min-h-[1440px]">
          {/* Hour labels on left */}
          <div className="border-r border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-950/30">
            {HOURS.map((hour) => {
              const displayH = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
              return (
                <div
                  key={hour}
                  className="h-[60px] relative border-b border-transparent"
                >
                  <span
                    className={clsx(
                      'absolute right-2 text-[10px] font-medium text-slate-400 dark:text-zinc-500 select-none pointer-events-none',
                      hour === 0 ? 'top-1.5' : '-top-2.5'
                    )}
                  >
                    {displayH}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 7 Day Columns */}
          {weekDays.map((day) => {
            const dayTasks = tasksByDate[day.isoString] || [];
            const { timedTasks } = computeTimedTasksLayout(dayTasks);
            const isToday = day.isoString === todayIso;
            const isDragOver = dragOverDayIso === day.isoString;

            return (
              <div
                key={day.isoString}
                onDragOver={(e) => handleDragOver(e, day.isoString)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
                className={clsx(
                  'relative border-r border-slate-200/80 dark:border-zinc-800/80 last:border-r-0 transition-colors',
                  isDragOver && 'bg-indigo-50/60 dark:bg-indigo-950/50'
                )}
              >
                {/* Hourly slots */}
                {HOURS.map((hour) => {
                  const hourStr = `${String(hour).padStart(2, '0')}:00`;
                  return (
                    <div
                      key={hour}
                      onClick={() => {
                        onSelectDate(day.date);
                        onOpenCreateModal(day.date, hourStr);
                      }}
                      className="h-[60px] border-b border-slate-100 dark:border-zinc-800/50 hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors"
                      title={`Click to add task at ${formatDisplayTime(hourStr)} on ${day.dayName}`}
                    />
                  );
                })}

                {/* Red/Indigo current time marker line if today */}
                {isToday && (
                  <div
                    style={{ top: `${currentTimePercent}%` }}
                    className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1 shadow-sm shadow-rose-500/50" />
                    <span className="h-0.5 bg-rose-500 flex-1" />
                  </div>
                )}

                {/* Timed Tasks positioned using computed overlap-safe layout */}
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
            );
          })}
        </div>

        {/* MOBILE SINGLE ACTIVE DAY TIMELINE (< 768px) */}
        {(() => {
          const activeDay = weekDays[activeMobileDayIndex] || weekDays[0];
          if (!activeDay) return null;
          const dayTasks = tasksByDate[activeDay.isoString] || [];
          const { allDayTasks, timedTasks } = computeTimedTasksLayout(dayTasks);
          const isToday = activeDay.isoString === todayIso;

          return (
            <div className="md:hidden flex flex-col">
              {/* Mobile All-Day Bar */}
              {allDayTasks.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-200/80 dark:border-zinc-800/80 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    All-Day Tasks ({allDayTasks.length})
                  </span>
                  <div className="space-y-1">
                    {allDayTasks.map((task) => (
                      <TaskBadge key={task.occurrenceId || task._id} task={task} onClick={onSelectTask} />
                    ))}
                  </div>
                </div>
              )}

              {/* Single Day Canvas */}
              <div className="grid grid-cols-[56px_1fr] relative min-h-[1440px]">
                {/* Time markers */}
                <div className="border-r border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-950/30">
                  {HOURS.map((hour) => {
                    const displayH = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                    return (
                      <div
                        key={hour}
                        className="h-[60px] relative border-b border-transparent"
                      >
                        <span
                          className={clsx(
                            'absolute right-2 text-[10px] font-medium text-slate-400 dark:text-zinc-500 select-none pointer-events-none',
                            hour === 0 ? 'top-1.5' : '-top-2.5'
                          )}
                        >
                          {displayH}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Day hourly slots */}
                <div className="relative">
                  {HOURS.map((hour) => {
                    const hourStr = `${String(hour).padStart(2, '0')}:00`;
                    return (
                      <div
                        key={hour}
                        onClick={() => {
                          onSelectDate(activeDay.date);
                          onOpenCreateModal(activeDay.date, hourStr);
                        }}
                        className="h-[60px] border-b border-slate-100 dark:border-zinc-800/50 active:bg-slate-100 dark:active:bg-zinc-800/50 transition-colors"
                      />
                    );
                  })}

                  {/* Current time marker if today */}
                  {isToday && (
                    <div
                      style={{ top: `${currentTimePercent}%` }}
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-sm" />
                      <span className="h-0.5 bg-rose-500 flex-1" />
                    </div>
                  )}

                  {/* Timed Tasks */}
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
          );
        })()}
      </div>
    </div>
  );
};
