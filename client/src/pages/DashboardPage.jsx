import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTasks } from '../context/TaskContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { format, parseISO, startOfDay, addDays, subDays } from 'date-fns';
import { toISODate, formatDisplayTime } from '../utils/dateUtils.js';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Plus,
  TrendingUp,
  ListChecks,
  CalendarDays,
  Repeat,
  FileText,
  Briefcase,
} from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { TaskFormModal } from '../components/tasks/TaskFormModal.jsx';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer.jsx';
import { ErrorBoundary } from '../components/common/ErrorBoundary.jsx';
import { clsx } from 'clsx';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const {
    tasks,
    fetchTasks,
    isLoading,
    selectedTask,
    setSelectedTask,
    isFormOpen,
    setIsFormOpen,
    isDetailOpen,
    setIsDetailOpen,
    updateOccurrence,
    patchTask,
  } = useTasks();

  const [taskToEdit, setTaskToEdit] = useState(null);
  const [togglingTaskKey, setTogglingTaskKey] = useState(null);

  const isPersonal = activeWorkspaceId === 'personal';

  // Fetch projected tasks and occurrences across active dashboard window (14-day lookback for overdue + 7-day upcoming)
  const fetchDashboardTasks = useCallback(() => {
    const today = startOfDay(new Date());
    const overdueStart = subDays(today, 14);
    const upcomingEnd = addDays(today, 7);
    const params = {
      start: toISODate(overdueStart),
      end: toISODate(upcomingEnd),
    };

    if (isPersonal) {
      params.workspaceId = 'personal';
    } else if (activeWorkspaceId) {
      params.workspaceId = activeWorkspaceId;
    }

    fetchTasks(params);
  }, [fetchTasks, activeWorkspaceId, isPersonal]);

  useEffect(() => {
    fetchDashboardTasks();
  }, [fetchDashboardTasks]);

  // Scroll reveal animation observer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [isLoading]);

  const today = startOfDay(new Date());
  const todayStr = toISODate(today);
  const upcomingEnd = addDays(today, 7);
  const upcomingEndStr = toISODate(upcomingEnd);

  const { todayTasks, overdueTasks, upcomingTasks, completedCount, totalCount, inProgressCount } =
    useMemo(() => {
      const todayList = [];
      const overdueList = [];
      const upcomingList = [];

      const seenToday = new Set();
      const seenUpcoming = new Set();
      const seenOverdue = new Set();

      tasks.forEach((task) => {
        const taskDateStr = task.occurrenceDate || toISODate(task.startDate);
        const uniqueKey = task.occurrenceId || (task._id ? `${task._id}__${taskDateStr}` : '');

        if (taskDateStr === todayStr) {
          if (!seenToday.has(uniqueKey)) {
            seenToday.add(uniqueKey);
            todayList.push(task);
          }
        } else if (taskDateStr > todayStr && taskDateStr <= upcomingEndStr) {
          if (!seenUpcoming.has(uniqueKey)) {
            seenUpcoming.add(uniqueKey);
            upcomingList.push(task);
          }
        } else if (taskDateStr < todayStr && task.status !== 'Done') {
          if (!seenOverdue.has(uniqueKey)) {
            seenOverdue.add(uniqueKey);
            overdueList.push(task);
          }
        }
      });

      const sortByTime = (a, b) => (a.startTime || '').localeCompare(b.startTime || '');
      todayList.sort(sortByTime);

      overdueList.sort((a, b) => {
        const aDate = a.occurrenceDate || toISODate(a.startDate);
        const bDate = b.occurrenceDate || toISODate(b.startDate);
        if (aDate !== bDate) return bDate.localeCompare(aDate);
        return sortByTime(a, b);
      });

      upcomingList.sort((a, b) => {
        const aDate = a.occurrenceDate || toISODate(a.startDate);
        const bDate = b.occurrenceDate || toISODate(b.startDate);
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return sortByTime(a, b);
      });

      const activeWindowTasks = [...todayList, ...upcomingList];
      const completed = activeWindowTasks.filter((t) => t.status === 'Done').length;
      const inProgress = [...activeWindowTasks, ...overdueList].filter((t) => t.status === 'In Progress').length;
      const total = todayList.length + upcomingList.length + overdueList.length;

      return {
        todayTasks: todayList,
        overdueTasks: overdueList,
        upcomingTasks: upcomingList.slice(0, 5),
        completedCount: completed,
        totalCount: total,
        inProgressCount: inProgress,
      };
    }, [tasks, todayStr, upcomingEndStr]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleToggleComplete = async (task, e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    const key = task.occurrenceId || task._id;
    setTogglingTaskKey(key);
    try {
      if (task.isOccurrence) {
        const masterTaskId = task.masterTaskId || task._id;
        const seriesOccurrenceDate =
          task.originalOccurrenceDate ||
          task.occurrenceDate ||
          (task.occurrenceId ? task.occurrenceId.split('__')[1] : toISODate(task.startDate));
        const targetAction = task.status === 'Done' ? 'reopen' : 'complete';
        await updateOccurrence(masterTaskId, seriesOccurrenceDate, { action: targetAction });
      } else {
        const nextStatus = task.status === 'Done' ? 'To Do' : 'Done';
        await patchTask(task._id, { status: nextStatus });
      }
    } catch (err) {
      console.error('Failed to toggle task completion from dashboard:', err);
    } finally {
      setTogglingTaskKey(null);
    }
  };

  return (
    <div className="relative min-h-full">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/elvo-app-bg.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-60 dark:opacity-30 mix-blend-multiply dark:mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/80 to-[#F5F5F5] dark:from-[#1A1A1A]/90 dark:via-[#1A1A1A]/95 dark:to-[#1A1A1A]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-10 sm:py-14">
        {/* Header Section */}
        <div className="reveal-on-scroll flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="flex items-center gap-10">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#565656] dark:text-[#848484] mb-2 uppercase">
                {greeting},
              </p>
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-[#2B2B2B] dark:text-white leading-none">
                {user?.name?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-3">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>

            <div className="hidden md:block h-16 w-px bg-[#E0E0E0] dark:bg-[#3A3A3A] mx-4" />

            <div className="hidden md:block">
              <p className="text-xs font-medium tracking-[0.2em] text-[#565656] dark:text-[#848484] uppercase leading-relaxed">
                Small steps<br />
                still move<br />
                you forward.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsFormOpen(true)}
            className="self-start md:self-auto rounded-full px-5 py-2.5 shadow-lg shadow-black/5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Task
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="reveal-on-scroll grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={ListChecks} label="Total Tasks" value={totalCount} to="/app/tasks" />
          <StatCard icon={CheckCircle2} label="Completed" value={completedCount} to="/app/tasks" />
          <StatCard icon={Clock} label="In Progress" value={inProgressCount} to="/app/tasks" />
          <StatCard
            icon={AlertTriangle}
            label="Overdue"
            value={overdueTasks.length}
            isAlert={overdueTasks.length > 0}
            to="/app/tasks"
          />
        </div>

        {/* Core Modules / Feature Hub */}
        <div className="reveal-on-scroll grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            to="/app/calendar"
            className="group p-4 rounded-2xl bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle hover:border-[#B3B3B3] dark:hover:border-[#565656] transition-all flex flex-col justify-between h-28"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#E0E0E0]/60 dark:bg-[#1A1A1A]/60 flex items-center justify-center text-[#2B2B2B] dark:text-white">
                <Calendar className="w-4 h-4" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#B3B3B3] group-hover:translate-x-0.5 group-hover:text-[#2B2B2B] dark:group-hover:text-white transition-all" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2B2B2B] dark:text-white">Calendar</p>
              <p className="text-[11px] text-[#565656] dark:text-[#848484] truncate mt-0.5">View schedule & agenda</p>
            </div>
          </Link>

          <Link
            to="/app/habits"
            className="group p-4 rounded-2xl bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle hover:border-[#B3B3B3] dark:hover:border-[#565656] transition-all flex flex-col justify-between h-28"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#E0E0E0]/60 dark:bg-[#1A1A1A]/60 flex items-center justify-center text-[#2B2B2B] dark:text-white">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#B3B3B3] group-hover:translate-x-0.5 group-hover:text-[#2B2B2B] dark:group-hover:text-white transition-all" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2B2B2B] dark:text-white">Habit Tracker</p>
              <p className="text-[11px] text-[#565656] dark:text-[#848484] truncate mt-0.5">Streaks & consistency</p>
            </div>
          </Link>

          <Link
            to="/app/notes"
            className="group p-4 rounded-2xl bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle hover:border-[#B3B3B3] dark:hover:border-[#565656] transition-all flex flex-col justify-between h-28"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#E0E0E0]/60 dark:bg-[#1A1A1A]/60 flex items-center justify-center text-[#2B2B2B] dark:text-white">
                <FileText className="w-4 h-4" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#B3B3B3] group-hover:translate-x-0.5 group-hover:text-[#2B2B2B] dark:group-hover:text-white transition-all" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2B2B2B] dark:text-white">Notes</p>
              <p className="text-[11px] text-[#565656] dark:text-[#848484] truncate mt-0.5">Rich text & collections</p>
            </div>
          </Link>

          <Link
            to="/app/workspaces"
            className="group p-4 rounded-2xl bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle hover:border-[#B3B3B3] dark:hover:border-[#565656] transition-all flex flex-col justify-between h-28"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#E0E0E0]/60 dark:bg-[#1A1A1A]/60 flex items-center justify-center text-[#2B2B2B] dark:text-white">
                <Briefcase className="w-4 h-4" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#B3B3B3] group-hover:translate-x-0.5 group-hover:text-[#2B2B2B] dark:group-hover:text-white transition-all" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2B2B2B] dark:text-white">Projects</p>
              <p className="text-[11px] text-[#565656] dark:text-[#848484] truncate mt-0.5">Workspace collaboration</p>
            </div>
          </Link>
        </div>

        {/* Today + Upcoming Layout */}
        <div className="reveal-on-scroll grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Today's Tasks */}
          <section className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/20 dark:border-[#3A3A3A]/40 relative z-10">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-[#2B2B2B] dark:text-white" />
                <h2 className="text-sm font-semibold text-[#2B2B2B] dark:text-white">
                  Today
                </h2>
              </div>
              <Link
                to="/app/calendar"
                className="text-[11px] uppercase tracking-wider font-semibold text-[#565656] dark:text-[#B3B3B3] hover:text-[#2B2B2B] dark:hover:text-white transition-colors inline-flex items-center gap-1"
              >
                Open Calendar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-6 relative z-10">
              {isLoading ? (
                <LoadingRows />
              ) : todayTasks.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center">
                  <img src="/elvo-empty-calendar.jpg" alt="Empty Calendar" className="w-40 h-auto mix-blend-multiply dark:mix-blend-screen opacity-90 rounded-2xl mb-4" />
                  <h3 className="text-base font-semibold text-[#2B2B2B] dark:text-white mb-1">No tasks for today</h3>
                  <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mb-6">Enjoy the free day, or create a new task.</p>
                  <Button variant="secondary" size="sm" onClick={() => setIsFormOpen(true)} className="rounded-full">
                    <Plus className="w-4 h-4 mr-1.5" /> New Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((task) => (
                    <TaskRow
                      key={task.occurrenceId || task._id}
                      task={task}
                      onClick={handleTaskClick}
                      onToggleComplete={handleToggleComplete}
                      isUpdating={togglingTaskKey === (task.occurrenceId || task._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Upcoming Tasks */}
          <section className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/20 dark:border-[#3A3A3A]/40 relative z-10">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-[#2B2B2B] dark:text-white" />
                <h2 className="text-sm font-semibold text-[#2B2B2B] dark:text-white">
                  Upcoming (7 days)
                </h2>
              </div>
              <Link
                to="/app/tasks"
                className="text-[11px] uppercase tracking-wider font-semibold text-[#565656] dark:text-[#B3B3B3] hover:text-[#2B2B2B] dark:hover:text-white transition-colors inline-flex items-center gap-1"
              >
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-6 relative z-10">
              {isLoading ? (
                <LoadingRows />
              ) : upcomingTasks.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center">
                  <img src="/elvo-empty-stack.jpg" alt="Empty Stack" className="w-40 h-auto mix-blend-multiply dark:mix-blend-screen opacity-90 rounded-2xl mb-4" />
                  <h3 className="text-base font-semibold text-[#2B2B2B] dark:text-white mb-1">No upcoming tasks</h3>
                  <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mb-6">You're all caught up for the next week.</p>
                  <Button variant="secondary" size="sm" onClick={() => setIsFormOpen(true)} className="rounded-full">
                    <Plus className="w-4 h-4 mr-1.5" /> New Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingTasks.map((task) => (
                    <TaskRow
                      key={task.occurrenceId || task._id}
                      task={task}
                      onClick={handleTaskClick}
                      onToggleComplete={handleToggleComplete}
                      isUpdating={togglingTaskKey === (task.occurrenceId || task._id)}
                      showDate
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer Card */}
        <div className="reveal-on-scroll bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#E0E0E0]/50 dark:bg-[#1A1A1A]/50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-[#2B2B2B] dark:text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#2B2B2B] dark:text-white">A more intentional you.</h3>
              <p className="text-xs text-[#565656] dark:text-[#848484] mt-0.5">Plan. Organize. Focus. Accomplish — all in one place.</p>
            </div>
          </div>
          <Link to="/app/settings" className="px-5 py-2.5 rounded-full border border-[#B3B3B3] dark:border-[#565656] text-[#2B2B2B] dark:text-white text-xs font-semibold hover:bg-[#2B2B2B]/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2">
            Explore Features <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <TaskFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setTaskToEdit(null);
          fetchDashboardTasks();
        }}
        initialDate={new Date()}
        editTask={taskToEdit}
      />
      <ErrorBoundary
        fallback={
          <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 shadow-xl flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Failed to render task details.</span>
            <button
              onClick={() => {
                setIsDetailOpen(false);
                setSelectedTask(null);
              }}
              className="text-rose-600 underline text-xs ml-2"
            >
              Dismiss
            </button>
          </div>
        }
      >
        <TaskDetailDrawer
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedTask(null);
            fetchDashboardTasks();
          }}
          task={selectedTask}
          onEdit={(t) => {
            setTaskToEdit(t);
            setIsDetailOpen(false);
            setIsFormOpen(true);
          }}
        />
      </ErrorBoundary>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, isAlert = false, to }) => {
  const cardElement = (
    <div className={clsx(
      "bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-[#3A3A3A]/60 p-5 shadow-subtle flex flex-col justify-between h-28 relative overflow-hidden group transition-all",
      isAlert ? "hover:border-rose-500/30" : "hover:border-[#B3B3B3] dark:hover:border-[#565656]"
    )}>
      <div className="flex items-center justify-between z-10">
        <div className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          isAlert ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" : "bg-[#E0E0E0]/50 dark:bg-[#1A1A1A]/50 text-[#565656] dark:text-[#B3B3B3]"
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-[#B3B3B3] dark:text-[#565656] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="z-10">
        <p className={clsx("text-2xl font-light tracking-tight", isAlert && value > 0 ? "text-rose-600 dark:text-rose-400" : "text-[#2B2B2B] dark:text-white")}>{value}</p>
        <p className="text-[11px] uppercase tracking-wider font-medium text-[#565656] dark:text-[#848484] mt-1">{label}</p>
      </div>
    </div>
  );

  return to ? <Link to={to}>{cardElement}</Link> : cardElement;
};

const TaskRow = ({ task, onClick, onToggleComplete, showDate = false, isUpdating = false }) => {
  const isCompleted = task.status === 'Done';
  const dateStr = showDate
    ? format(
        typeof task.startDate === 'string'
          ? parseISO(task.startDate)
          : task.startDate,
        'MMM d'
      )
    : null;
  const isOccurrence = Boolean(task.isOccurrence);

  return (
    <div
      onClick={() => onClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(task);
        }
      }}
      className={clsx(
        'w-full flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:bg-white/50 dark:hover:bg-[#1A1A1A]/40 transition-all text-left group cursor-pointer',
        isCompleted && 'opacity-60'
      )}
    >
      <button
        type="button"
        onClick={(e) => onToggleComplete(task, e)}
        disabled={isUpdating}
        aria-label={isCompleted ? 'Mark task as not done' : 'Mark task as done'}
        className={clsx(
          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-transform hover:scale-110',
          isCompleted
            ? 'border-[#2B2B2B] bg-[#2B2B2B] dark:border-white dark:bg-white'
            : 'border-[#848484] dark:border-[#565656] hover:border-[#2B2B2B] dark:hover:border-white',
          isUpdating && 'opacity-50 animate-pulse'
        )}
      >
        {isCompleted && (
          <CheckCircle2 className="w-3 h-3 text-white dark:text-[#2B2B2B]" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={clsx(
              'text-sm font-medium truncate',
              isCompleted
                ? 'line-through text-[#848484] dark:text-[#565656]'
                : 'text-[#2B2B2B] dark:text-white'
            )}
          >
            {task.title}
          </p>
          {isOccurrence && (
            <span
              title={`Recurring occurrence (${task.recurrence?.frequency || 'series'})`}
              className="inline-flex shrink-0"
            >
              <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            </span>
          )}
        </div>
        {(task.startTime || dateStr) && (
          <div className="flex items-center gap-2 mt-0.5">
            {task.startTime && (
              <span className="text-[10px] text-[#565656] dark:text-[#848484]">
                {formatDisplayTime(task.startTime)}
              </span>
            )}
            {dateStr && (
              <span className="text-[10px] text-[#565656] dark:text-[#848484]">
                {dateStr}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingRows = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />)}
  </div>
);
