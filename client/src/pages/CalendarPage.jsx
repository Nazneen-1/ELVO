import React, { useEffect, useState } from 'react';
import { CalendarHeader } from '../components/calendar/CalendarHeader.jsx';
import { MonthGrid } from '../components/calendar/MonthGrid.jsx';
import { MobileAgendaView } from '../components/calendar/MobileAgendaView.jsx';
import { TaskFormModal } from '../components/tasks/TaskFormModal.jsx';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer.jsx';
import { useCalendar } from '../hooks/useCalendar.js';
import { useTasks } from '../context/TaskContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { toISODate } from '../utils/dateUtils.js';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Sparkles, Briefcase } from 'lucide-react';

export const CalendarPage = () => {
  const {
    currentDate,
    selectedDate,
    setSelectedDate,
    daysMatrix,
    monthLabel,
    nextMonth,
    prevMonth,
    goToToday,
  } = useCalendar();

  const {
    fetchTasks,
    tasksByDate,
    selectedTask,
    setSelectedTask,
    isFormOpen,
    setIsFormOpen,
    isDetailOpen,
    setIsDetailOpen,
  } = useTasks();

  const { activeWorkspaceId, activeWorkspace } = useWorkspace();

  const [modalDate, setModalDate] = useState(new Date());
  const [taskToEdit, setTaskToEdit] = useState(null);

  const isPersonal = activeWorkspaceId === 'personal';

  // Fetch tasks whenever the calendar month or active workspace changes
  useEffect(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    const params = {
      start: toISODate(gridStart),
      end: toISODate(gridEnd),
    };

    // Filter tasks by workspace context
    if (isPersonal) {
      params.workspaceId = 'personal';
    } else if (activeWorkspaceId) {
      params.workspaceId = activeWorkspaceId;
    }

    fetchTasks(params);
  }, [currentDate, activeWorkspaceId, fetchTasks]);

  // Handlers
  const handleOpenCreateModal = (date) => {
    setTaskToEdit(null);
    setModalDate(date || selectedDate);
    setIsFormOpen(true);
  };

  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setModalDate(task.startDate);
    setIsFormOpen(true);
  };

  const selectedDateISO = toISODate(selectedDate);
  const selectedDateTasks = tasksByDate[selectedDateISO] || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Workspace Context Banner */}
      <div className="flex items-center gap-2.5 mb-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 w-fit">
        {isPersonal ? (
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        )}
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
          {isPersonal ? 'Personal Calendar' : `${activeWorkspace?.name || 'Workspace'} Calendar`}
        </span>
        {!isPersonal && (
          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider">
            Collaborative
          </span>
        )}
      </div>

      {/* Calendar Controls */}
      <CalendarHeader
        monthLabel={monthLabel}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onToday={goToToday}
        onNewTask={() => handleOpenCreateModal(new Date())}
      />

      {/* Monthly Grid (hidden on smallest screens to prioritize agenda) */}
      <MonthGrid
        daysMatrix={daysMatrix}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenCreateModal={handleOpenCreateModal}
        onSelectTask={handleSelectTask}
      />

      {/* Mobile Agenda View (< 768px) */}
      <MobileAgendaView
        selectedDate={selectedDate}
        tasks={selectedDateTasks}
        onOpenCreateModal={handleOpenCreateModal}
        onSelectTask={handleSelectTask}
      />

      {/* Task Create / Edit Modal */}
      <TaskFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setTaskToEdit(null);
        }}
        initialDate={modalDate}
        editTask={taskToEdit}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onEdit={handleEditTask}
      />
    </div>
  );
};
