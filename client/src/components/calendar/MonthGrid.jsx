import React from 'react';
import { DayCell } from './DayCell.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { toISODate } from '../../utils/dateUtils.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MonthGrid = ({
  daysMatrix,
  selectedDate,
  onSelectDate,
  onOpenCreateModal,
  onSelectTask,
}) => {
  const { tasksByDate } = useTasks();
  const selectedDateISO = toISODate(selectedDate);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle overflow-hidden">
      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-950/60">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.slice(0, 1)}</span>
          </div>
        ))}
      </div>

      {/* 7-Column Day Matrix */}
      <div className="grid grid-cols-7 border-l border-t border-transparent">
        {daysMatrix.map((day) => {
          const dayTasks = tasksByDate[day.isoString] || [];
          const isSelected = selectedDateISO === day.isoString;

          return (
            <DayCell
              key={day.isoString}
              day={day}
              tasks={dayTasks}
              isSelected={isSelected}
              onSelectDate={onSelectDate}
              onOpenCreateModal={onOpenCreateModal}
              onSelectTask={onSelectTask}
            />
          );
        })}
      </div>
    </div>
  );
};
