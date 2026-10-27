import React, { useEffect, useState } from 'react';
import { CalendarHeader } from '../components/calendar/CalendarHeader.jsx';
import { MonthGrid } from '../components/calendar/MonthGrid.jsx';
import { WeekView } from '../components/calendar/WeekView.jsx';
import { DayView } from '../components/calendar/DayView.jsx';
import { MobileAgendaView } from '../components/calendar/MobileAgendaView.jsx';
import { TaskFormModal } from '../components/tasks/TaskFormModal.jsx';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer.jsx';
import { useCalendar } from '../hooks/useCalendar.js';
import { useTasks } from '../context/TaskContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { toISODate } from '../utils/dateUtils.js';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Sparkles, Briefcase, AlertCircle, X } from 'lucide-react';

export const CalendarPage = () => {
  const { user } = useAuth();
  const weekStartsOn = Number(user?.preferences?.firstDayOfWeek ?? 0);

  const {
    currentDate,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    daysMatrix,
    weekDays,
    viewLabel,
    monthLabel,
    next,
    prev,
    goToToday,
  } = useCalendar(new Date(), weekStartsOn);

  const {
    fetchTasks,
    tasksByDate,
    selectedTask,
    setSelectedTask,
    isFormOpen,
    setIsFormOpen,
    isDetailOpen,
    setIsDetailOpen,
    calendarError,
    setCalendarError,
  } = useTasks();

  const { activeWorkspaceId, activeWorkspace } = useWorkspace();

  const [modalDate, setModalDate] = useState(new Date());
  const [modalStartTime, setModalStartTime] = useState('');
  const [taskToEdit, setTaskToEdit] = useState(null);

  const isPersonal = activeWorkspaceId === 'personal';

  // Fetch tasks whenever the active date, workspace, or weekStartsOn changes
  useEffect(() => {
    // Determine the broadest date window needed so all visible slots are loaded
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn });

    const fetchStart = weekStart < gridStart ? weekStart : gridStart;
    const fetchEnd = weekEnd > gridEnd ? weekEnd : gridEnd;

    const params = {
      start: toISODate(fetchStart),
      end: toISODate(fetchEnd),
    };

    // Filter tasks by workspace context
    if (isPersonal) {
      params.workspaceId = 'personal';
    } else if (activeWorkspaceId) {
      params.workspaceId = activeWorkspaceId;
    }

    fetchTasks(params);
  }, [currentDate, activeWorkspaceId, fetchTasks, weekStartsOn, viewMode]);

  // Handlers
  const handleOpenCreateModal = (date, initialStartTime = '') => {
    setTaskToEdit(null);
    setModalDate(date || selectedDate);
    setModalStartTime(initialStartTime || '');
    setIsFormOpen(true);
  };

  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setModalDate(task.startDate);
    setModalStartTime(task.startTime || '');
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

      {/* Calendar Controls (Header, View Mode Switcher, Search & Status Filters) */}
      <CalendarHeader
        viewLabel={viewLabel}
        monthLabel={monthLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={prev}
        onNext={next}
        onToday={goToToday}
        onNewTask={() => handleOpenCreateModal(new Date())}
      />

      {/* Active Calendar View */}
      {viewMode === 'month' && (
        <>
          <MonthGrid
            daysMatrix={daysMatrix}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenCreateModal={handleOpenCreateModal}
            onSelectTask={handleSelectTask}
            weekStartsOn={weekStartsOn}
          />

          {/* Mobile Agenda View (< 768px for Month view) */}
          <MobileAgendaView
            selectedDate={selectedDate}
            tasks={selectedDateTasks}
            onOpenCreateModal={handleOpenCreateModal}
            onSelectTask={handleSelectTask}
          />
        </>
      )}

      {viewMode === 'week' && (
        <WeekView
          weekDays={weekDays}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenCreateModal={handleOpenCreateModal}
          onSelectTask={handleSelectTask}
        />
      )}

      {viewMode === 'day' && (
        <DayView
          currentDate={currentDate}
          onOpenCreateModal={handleOpenCreateModal}
          onSelectTask={handleSelectTask}
        />
      )}

      {/* Task Create / Edit Modal */}
      <TaskFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setTaskToEdit(null);
          setModalStartTime('');
        }}
        initialDate={modalDate}
        initialStartTime={modalStartTime}
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
      {/* Calendar Error Toast */}
      {calendarError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md p-3 rounded-xl bg-rose-50 dark:bg-rose-950/95 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-medium">{calendarError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCalendarError(null)}
            className="p-1 rounded text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
