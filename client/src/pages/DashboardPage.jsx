import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar.jsx';
import { CalendarHeader } from '../components/calendar/CalendarHeader.jsx';
import { MonthGrid } from '../components/calendar/MonthGrid.jsx';
import { MobileAgendaView } from '../components/calendar/MobileAgendaView.jsx';
import { TaskFormModal } from '../components/tasks/TaskFormModal.jsx';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer.jsx';
import { useCalendar } from '../hooks/useCalendar.js';
import { useTasks } from '../context/TaskContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { toISODate } from '../utils/dateUtils.js';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

export const DashboardPage = () => {
  const { user } = useAuth();
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

  const [modalDate, setModalDate] = useState(new Date());
  const [taskToEdit, setTaskToEdit] = useState(null);

  // Fetch tasks whenever the calendar month changes
  useEffect(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    fetchTasks({
      start: toISODate(gridStart),
      end: toISODate(gridEnd),
    });
  }, [currentDate, fetchTasks]);

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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome greeting banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Hello, {user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
              Here is your schedule for this month.
            </p>
          </div>
        </div>

        {/* Main Calendar Section */}
        <CalendarHeader
          monthLabel={monthLabel}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onToday={goToToday}
          onNewTask={() => handleOpenCreateModal(new Date())}
        />

        {/* Monthly Grid */}
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
      </main>

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

      {/* Task Detail Modal / Drawer */}
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
