import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTasks } from '../context/TaskContext.jsx';
import { format, isToday, isBefore, isAfter, startOfDay, addDays, parseISO } from 'date-fns';
import { formatDisplayTime } from '../utils/dateUtils.js';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  TrendingUp,
  ListChecks,
  CalendarDays,
} from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { TaskFormModal } from '../components/tasks/TaskFormModal.jsx';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer.jsx';
import { clsx } from 'clsx';

export const DashboardPage = () => {
  const { user } = useAuth();
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
  } = useTasks();

  const [taskToEdit, setTaskToEdit] = useState(null);

  useEffect(() => {
    fetchTasks({});
  }, [fetchTasks]);

  const today = startOfDay(new Date());
  const upcomingEnd = addDays(today, 7);

  const { todayTasks, overdueTasks, upcomingTasks, completedCount, totalCount, inProgressCount } =
    useMemo(() => {
      const todayList = [];
      const overdueList = [];
      const upcomingList = [];
      let completed = 0;
      let inProgress = 0;

      tasks.forEach((task) => {
        const taskDate = startOfDay(
          typeof task.startDate === 'string' ? parseISO(task.startDate) : task.startDate
        );
        if (task.status === 'Done') {
          completed++;
        }
        if (task.status === 'In Progress') {
          inProgress++;
        }
        if (isToday(taskDate)) {
          todayList.push(task);
        } else if (isBefore(taskDate, today) && task.status !== 'Done') {
          overdueList.push(task);
        } else if (isAfter(taskDate, today) && isBefore(taskDate, upcomingEnd)) {
          upcomingList.push(task);
        }
      });

      const sortByTime = (a, b) => (a.startTime || '').localeCompare(b.startTime || '');
      todayList.sort(sortByTime);
      upcomingList.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      overdueList.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      return {
        todayTasks: todayList,
        overdueTasks: overdueList,
        upcomingTasks: upcomingList.slice(0, 5),
        completedCount: completed,
        totalCount: tasks.length,
        inProgressCount: inProgress,
      };
    }, [tasks, today, upcomingEnd]);

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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard icon={ListChecks} label="Total Tasks" value={totalCount} />
          <StatCard icon={CheckCircle2} label="Completed" value={completedCount} />
          <StatCard icon={Clock} label="In Progress" value={inProgressCount} />
          <StatCard icon={AlertTriangle} label="Overdue" value={overdueTasks.length} isAlert={overdueTasks.length > 0} />
        </div>

        {/* Today + Upcoming Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
                    <TaskRow key={task._id} task={task} onClick={handleTaskClick} />
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
                    <TaskRow key={task._id} task={task} onClick={handleTaskClick} showDate />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer Card */}
        <div className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-subtle p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

      <TaskFormModal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setTaskToEdit(null); }} initialDate={new Date()} editTask={taskToEdit} />
      <TaskDetailDrawer isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setSelectedTask(null); }} task={selectedTask} onEdit={(t) => { setTaskToEdit(t); setIsDetailOpen(false); setIsFormOpen(true); }} />
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, isAlert = false }) => (
  <div className={clsx(
    "bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-[#3A3A3A]/60 p-5 shadow-subtle flex flex-col justify-between h-28 relative overflow-hidden group transition-colors",
    isAlert && "hover:border-rose-500/30"
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
      <p className={clsx("text-2xl font-light tracking-tight", isAlert ? "text-rose-600 dark:text-rose-400" : "text-[#2B2B2B] dark:text-white")}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider font-medium text-[#565656] dark:text-[#848484] mt-1">{label}</p>
    </div>
  </div>
);

const TaskRow = ({ task, onClick, showDate = false }) => {
  const isCompleted = task.status === 'Done';
  const dateStr = showDate ? format(typeof task.startDate === 'string' ? parseISO(task.startDate) : task.startDate, 'MMM d') : null;

  return (
    <button
      onClick={() => onClick(task)}
      className={clsx(
        'w-full flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:bg-white/50 dark:hover:bg-[#1A1A1A]/40 transition-all text-left group',
        isCompleted && 'opacity-50'
      )}
    >
      <div className={clsx(
        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
        isCompleted ? "border-[#2B2B2B] bg-[#2B2B2B] dark:border-white dark:bg-white" : "border-[#848484] dark:border-[#565656]"
      )}>
        {isCompleted && <CheckCircle2 className="w-3 h-3 text-white dark:text-[#2B2B2B]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium truncate', isCompleted ? 'line-through text-[#848484] dark:text-[#565656]' : 'text-[#2B2B2B] dark:text-white')}>
          {task.title}
        </p>
        {(task.startTime || dateStr) && (
          <div className="flex items-center gap-2 mt-0.5">
            {task.startTime && <span className="text-[10px] text-[#565656] dark:text-[#848484]">{formatDisplayTime(task.startTime)}</span>}
            {dateStr && <span className="text-[10px] text-[#565656] dark:text-[#848484]">{dateStr}</span>}
          </div>
        )}
      </div>
    </button>
  );
};

const LoadingRows = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />)}
  </div>
);
