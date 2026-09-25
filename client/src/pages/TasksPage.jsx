import React, { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../context/TaskContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { TaskFormModal } from '../components/tasks/TaskFormModal.jsx';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer.jsx';
import { formatDisplayTime } from '../utils/dateUtils.js';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import {
  Plus,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  CalendarDays,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'To Do', label: 'To Do' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Done', label: 'Completed' },
  { value: 'Overdue', label: 'Overdue' },
];

export const TasksPage = () => {
  const {
    tasks,
    fetchTasks,
    isLoading,
    updateTask,
    selectedTask,
    setSelectedTask,
    isFormOpen,
    setIsFormOpen,
    isDetailOpen,
    setIsDetailOpen,
  } = useTasks();

  const { activeWorkspaceId } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [taskToEdit, setTaskToEdit] = useState(null);

  useEffect(() => {
    const params = {};
    if (activeWorkspaceId === 'personal') {
      params.workspaceId = 'personal';
    } else if (activeWorkspaceId) {
      params.workspaceId = activeWorkspaceId;
    }
    fetchTasks(params);
  }, [fetchTasks, activeWorkspaceId]);

  const today = startOfDay(new Date());

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'Overdue') {
        result = result.filter(t => {
          const tDate = startOfDay(typeof t.startDate === 'string' ? parseISO(t.startDate) : t.startDate);
          return isBefore(tDate, today) && t.status !== 'Done';
        });
      } else {
        result = result.filter((t) => t.status === statusFilter);
      }
    }

    result.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    return result;
  }, [tasks, searchQuery, statusFilter, today]);

  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleQuickStatusToggle = async (e, task) => {
    e.stopPropagation();
    const nextStatus = task.status === 'Done' ? 'To Do' : 'Done';
    await updateTask(task._id, { status: nextStatus });
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#565656] dark:text-[#848484] mb-2 uppercase">
              TASKS
            </p>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-[#2B2B2B] dark:text-white leading-none mb-3">
              Stay on track.
            </h1>
            <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">
              Break down your goals, one task at a time.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setTaskToEdit(null);
              setIsFormOpen(true);
            }}
            className="self-start md:self-auto rounded-full px-5 py-2.5 shadow-lg shadow-black/5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Task
          </Button>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={clsx(
                  "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border",
                  statusFilter === opt.value
                    ? "bg-[#2B2B2B] text-white border-[#2B2B2B] dark:bg-white dark:text-[#2B2B2B] dark:border-white shadow-sm"
                    : "bg-transparent text-[#565656] border-transparent hover:bg-black/5 dark:hover:bg-white/5 dark:text-[#B3B3B3]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#848484]" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-full bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 text-sm text-[#2B2B2B] dark:text-white placeholder-[#848484] focus:outline-none focus:border-[#565656]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#848484] hover:text-[#2B2B2B] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button className="p-2 rounded-full border border-white/60 dark:border-[#3A3A3A]/60 bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl text-[#565656] dark:text-[#B3B3B3] hover:text-[#2B2B2B] dark:hover:text-white transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task List / Empty State */}
        <div className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo dark:shadow-elvo-lg overflow-hidden min-h-[500px]">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center p-8">
              <img src="/elvo-empty-tasks.jpg" alt="Empty Tasks" className="w-64 h-auto mix-blend-multiply dark:mix-blend-screen opacity-90 rounded-2xl mb-8" />
              <h3 className="text-2xl font-light text-[#2B2B2B] dark:text-white mb-2">No tasks yet</h3>
              <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mb-8 text-center max-w-sm">
                Create your first task and take a step closer to your goals.
              </p>
              <Button variant="primary" size="lg" className="rounded-full px-8" onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Create Task
              </Button>
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-2">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === 'Done';
                const taskDate = typeof task.startDate === 'string' ? parseISO(task.startDate) : task.startDate;
                const isOverdue = isBefore(startOfDay(taskDate), today) && !isCompleted;

                return (
                  <div
                    key={task._id}
                    onClick={() => handleSelectTask(task)}
                    className={clsx(
                      'flex items-center gap-4 p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-transparent hover:border-[#E0E0E0] dark:hover:border-[#3A3A3A] hover:bg-white/80 dark:hover:bg-[#1A1A1A]/60 transition-all cursor-pointer group',
                      isCompleted && 'opacity-50'
                    )}
                  >
                    <button
                      onClick={(e) => handleQuickStatusToggle(e, task)}
                      className={clsx(
                        'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                        isCompleted
                          ? 'bg-[#2B2B2B] border-[#2B2B2B] text-white dark:bg-white dark:border-white dark:text-[#2B2B2B]'
                          : 'border-[#B3B3B3] dark:border-[#565656] hover:border-[#2B2B2B] dark:hover:border-white text-transparent hover:text-[#565656]'
                      )}
                    >
                      {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={clsx('text-base font-medium truncate', isCompleted ? 'line-through text-[#848484]' : 'text-[#2B2B2B] dark:text-white')}>
                          {task.title}
                        </p>
                        {isOverdue && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 shrink-0 bg-rose-100 px-2 py-0.5 rounded-full">Overdue</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] text-[#565656] dark:text-[#848484] flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {format(taskDate, 'MMM d, yyyy')}
                        </span>
                        {task.startTime && (
                          <span className="text-[11px] text-[#565656] dark:text-[#848484] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDisplayTime(task.startTime)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <Badge size="xs" variant="slate" className="bg-[#F5F5F5] dark:bg-[#2B2B2B] border-none text-[#565656] dark:text-[#B3B3B3]">{task.status}</Badge>
                      <Badge size="xs" variant={task.priority === 'High' ? 'rose' : task.priority === 'Medium' ? 'amber' : 'slate'}>{task.priority}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TaskFormModal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setTaskToEdit(null); }} initialDate={new Date()} editTask={taskToEdit} />
      <TaskDetailDrawer isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setSelectedTask(null); }} task={selectedTask} onEdit={(t) => { setTaskToEdit(t); setIsFormOpen(true); }} />
    </div>
  );
};
