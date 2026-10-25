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
  CheckCircle2,
  Clock,
  CalendarDays,
  X,
  LayoutList,
  Kanban,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'To Do', label: 'To Do' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Done', label: 'Completed' },
  { value: 'Overdue', label: 'Overdue' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priority' },
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
];

const KANBAN_COLUMNS = [
  { id: 'To Do', label: 'To Do', dotColor: 'bg-indigo-500', badgeVariant: 'indigo' },
  { id: 'In Progress', label: 'In Progress', dotColor: 'bg-amber-500', badgeVariant: 'amber' },
  { id: 'Done', label: 'Completed', dotColor: 'bg-emerald-500', badgeVariant: 'emerald' },
];

export const TasksPage = () => {
  const {
    tasks,
    fetchTasks,
    isLoading,
    updateTask,
    patchTask,
    selectedTask,
    setSelectedTask,
    isFormOpen,
    setIsFormOpen,
    isDetailOpen,
    setIsDetailOpen,
    filterStatus,
    setFilterStatus,
    filterPriority,
    setFilterPriority,
    searchQuery,
    setSearchQuery,
    clearFilters,
  } = useTasks();

  const { activeWorkspaceId } = useWorkspace();

  const [viewMode, setViewModeState] = useState(() => {
    try {
      const saved = localStorage.getItem('elvo_tasks_view_mode');
      return saved === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  });

  const setViewMode = (mode) => {
    const validMode = mode === 'kanban' ? 'kanban' : 'list';
    setViewModeState(validMode);
    try {
      localStorage.setItem('elvo_tasks_view_mode', validMode);
    } catch (err) {
      console.error('Failed to save tasks view mode preference:', err);
    }
  };
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [createStatus, setCreateStatus] = useState('To Do');
  const [modalInitialDate, setModalInitialDate] = useState(new Date());

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const params = {};
    if (activeWorkspaceId === 'personal') {
      params.workspaceId = 'personal';
    } else if (activeWorkspaceId) {
      params.workspaceId = activeWorkspaceId;
    }
    fetchTasks(params);
  }, [fetchTasks, activeWorkspaceId]);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Filtered tasks for the List view (applies search, status, and priority together)
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // 1. Search Query Filter (Title, Description, Tags)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }

    // 2. Status Filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'Overdue') {
        result = result.filter((t) => {
          const tDate = startOfDay(typeof t.startDate === 'string' ? parseISO(t.startDate) : t.startDate);
          return isBefore(tDate, today) && t.status !== 'Done';
        });
      } else {
        result = result.filter((t) => t.status === filterStatus);
      }
    }

    // 3. Priority Filter (Low, Medium, High)
    if (filterPriority !== 'all') {
      result = result.filter((t) => t.priority === filterPriority);
    }

    // Sort by startDate descending
    result.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    return result;
  }, [tasks, searchQuery, filterStatus, filterPriority, today]);

  // Tasks for Kanban columns (filtered by search and priority, but preserves all 3 status columns)
  const kanbanFilteredTasks = useMemo(() => {
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

    if (filterPriority !== 'all') {
      result = result.filter((t) => t.priority === filterPriority);
    }

    result.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return result;
  }, [tasks, searchQuery, filterPriority]);

  const hasActiveFilters =
    filterStatus !== 'all' || filterPriority !== 'all' || searchQuery.trim() !== '';

  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleQuickStatusToggle = async (e, task) => {
    e.stopPropagation();
    const nextStatus = task.status === 'Done' ? 'To Do' : 'Done';
    await updateTask(task._id, { status: nextStatus });
  };

  const handleOpenCreateModal = (presetStatus = 'To Do') => {
    setTaskToEdit(null);
    setCreateStatus(presetStatus);
    setModalInitialDate(new Date());
    setIsFormOpen(true);
  };

  const handleEditTaskFromDetail = (task) => {
    setTaskToEdit(task);
    setCreateStatus(task.status || 'To Do');
    setIsFormOpen(true);
  };

  // Status transition handler (used by both drag-and-drop and quick-move buttons)
  const handleMoveStatus = async (taskId, targetStatus) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === targetStatus) return;

    setActionError('');
    try {
      const res = await patchTask(taskId, { status: targetStatus });
      if (!res || !res.success) {
        setActionError(res?.error || 'Failed to update task status.');
        setTimeout(() => setActionError(''), 4000);
      }
    } catch (err) {
      setActionError(err.message || 'Error updating task status.');
      setTimeout(() => setActionError(''), 4000);
    }
  };

  // Kanban Drag and Drop Handlers
  const handleCardDragStart = (e, task) => {
    setDraggedTaskId(task._id);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleColumnDragLeave = (e, columnId) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverColumn === columnId) {
      setDragOverColumn(null);
    }
  };

  const handleColumnDrop = async (e, targetStatus) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    setDraggedTaskId(null);

    if (!taskId) return;
    await handleMoveStatus(taskId, targetStatus);
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#565656] dark:text-[#848484] mb-2 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              TASKS & KANBAN
            </p>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-[#2B2B2B] dark:text-white leading-none mb-3">
              Stay on track.
            </h1>
            <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">
              Break down your goals, organize your pipeline, one task at a time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: List vs Kanban */}
            <div className="flex items-center p-1 rounded-full bg-white/50 dark:bg-black/30 border border-white/60 dark:border-[#3A3A3A] shadow-sm backdrop-blur-md">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                  viewMode === 'list'
                    ? 'bg-[#2B2B2B] text-white dark:bg-white dark:text-[#2B2B2B] shadow-sm'
                    : 'text-[#565656] dark:text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white'
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                  viewMode === 'kanban'
                    ? 'bg-[#2B2B2B] text-white dark:bg-white dark:text-[#2B2B2B] shadow-sm'
                    : 'text-[#565656] dark:text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white'
                )}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenCreateModal('To Do')}
              className="rounded-full px-5 py-2.5 shadow-lg shadow-black/5 shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Task
            </Button>
          </div>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="mb-6 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-xs font-medium shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-[#3A3A3A]/60 p-4 mb-6 space-y-3 shadow-subtle">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Filter Pills (Active in List mode) */}
            {viewMode === 'list' ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#848484] mr-1 shrink-0">
                  Status:
                </span>
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilterStatus(opt.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border',
                      filterStatus === opt.value
                        ? 'bg-[#2B2B2B] text-white border-[#2B2B2B] dark:bg-white dark:text-[#2B2B2B] dark:border-white shadow-sm'
                        : 'bg-transparent text-[#565656] border-transparent hover:bg-black/5 dark:hover:bg-white/5 dark:text-[#B3B3B3]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#565656] dark:text-[#B3B3B3]">
                  Drag and drop cards across columns or use quick action buttons to update progress.
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#848484]" />
              <input
                type="text"
                placeholder="Search tasks or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-full bg-white/60 dark:bg-black/30 border border-white/70 dark:border-[#3A3A3A] text-xs text-[#2B2B2B] dark:text-white placeholder-[#848484] focus:outline-none focus:border-[#565656] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Row: Priority Filters and Clear Filters Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#848484] mr-1 shrink-0">
                Priority:
              </span>
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilterPriority(opt.value)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border',
                    filterPriority === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 shadow-sm'
                      : 'bg-transparent text-[#565656] border-transparent hover:bg-black/5 dark:hover:bg-white/5 dark:text-[#B3B3B3]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Area: List View vs Kanban View */}
        {isLoading ? (
          <div className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-[#3A3A3A]/60 p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          /* Zero Total Tasks State */
          <div className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo dark:shadow-elvo-lg overflow-hidden min-h-[500px] flex flex-col items-center justify-center p-8">
            <img
              src="/elvo-empty-tasks.jpg"
              alt="Empty Tasks"
              className="w-64 h-auto mix-blend-multiply dark:mix-blend-screen opacity-90 rounded-2xl mb-8"
            />
            <h3 className="text-2xl font-light text-[#2B2B2B] dark:text-white mb-2">No tasks yet</h3>
            <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mb-8 text-center max-w-sm">
              Create your first task and take a step closer to your goals.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="rounded-full px-8"
              onClick={() => handleOpenCreateModal('To Do')}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Task
            </Button>
          </div>
        ) : viewMode === 'list' ? (
          /* ================= LIST VIEW ================= */
          filteredTasks.length === 0 ? (
            <div className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo dark:shadow-elvo-lg overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-4">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-medium text-[#2B2B2B] dark:text-white mb-2">
                No matching tasks found
              </h3>
              <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mb-6 max-w-sm">
                None of your tasks match the current status, priority, or search term filters.
              </p>
              <Button
                variant="outline"
                size="md"
                className="rounded-full px-6"
                onClick={clearFilters}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo dark:shadow-elvo-lg overflow-hidden min-h-[500px]">
              <div className="p-4 sm:p-6 space-y-2">
                {filteredTasks.map((task) => {
                  const isCompleted = task.status === 'Done';
                  const taskDate =
                    typeof task.startDate === 'string' ? parseISO(task.startDate) : task.startDate;
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
                        type="button"
                        onClick={(e) => handleQuickStatusToggle(e, task)}
                        className={clsx(
                          'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                          isCompleted
                            ? 'bg-[#2B2B2B] border-[#2B2B2B] text-white dark:bg-white dark:border-white dark:text-[#2B2B2B]'
                            : 'border-[#B3B3B3] dark:border-[#565656] hover:border-[#2B2B2B] dark:hover:border-white text-transparent hover:text-[#565656]'
                        )}
                        title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                      >
                        {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className={clsx(
                              'text-base font-medium truncate',
                              isCompleted
                                ? 'line-through text-[#848484]'
                                : 'text-[#2B2B2B] dark:text-white'
                            )}
                          >
                            {task.title}
                          </p>
                          {isOverdue && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 shrink-0 bg-rose-100 px-2 py-0.5 rounded-full">
                              Overdue
                            </span>
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
                          {task.subtasks && task.subtasks.length > 0 && (
                            <span className="text-[11px] text-[#565656] dark:text-[#848484] flex items-center gap-1">
                              ✓ {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <Badge
                          size="xs"
                          variant="slate"
                          className="bg-[#F5F5F5] dark:bg-[#2B2B2B] border-none text-[#565656] dark:text-[#B3B3B3]"
                        >
                          {task.status}
                        </Badge>
                        <Badge
                          size="xs"
                          variant={
                            task.priority === 'High'
                              ? 'rose'
                              : task.priority === 'Medium'
                              ? 'amber'
                              : 'slate'
                          }
                        >
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* ================= KANBAN BOARD VIEW ================= */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {KANBAN_COLUMNS.map((column) => {
              const columnTasks = kanbanFilteredTasks.filter((t) => t.status === column.id);
              const isOver = dragOverColumn === column.id;

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => handleColumnDragOver(e, column.id)}
                  onDragLeave={(e) => handleColumnDragLeave(e, column.id)}
                  onDrop={(e) => handleColumnDrop(e, column.id)}
                  className={clsx(
                    'bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-2xl rounded-[28px] border p-4 sm:p-5 transition-all min-h-[480px] flex flex-col',
                    isOver
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo'
                  )}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className={clsx('w-2.5 h-2.5 rounded-full', column.dotColor)} />
                      <h3 className="text-sm font-bold tracking-tight text-[#2B2B2B] dark:text-white">
                        {column.label}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[10px] font-bold text-[#565656] dark:text-[#B3B3B3]">
                        {columnTasks.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal(column.id)}
                      className="p-1 rounded-lg text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      title={`Add task to ${column.label}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Column Task Cards */}
                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {columnTasks.length === 0 ? (
                      <div className="h-36 rounded-2xl border-2 border-dashed border-black/5 dark:border-white/5 flex flex-col items-center justify-center p-4 text-center">
                        <p className="text-xs text-[#848484] dark:text-[#666]">
                          {isOver ? 'Drop card here' : 'No tasks in this stage'}
                        </p>
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const taskDate =
                          typeof task.startDate === 'string'
                            ? parseISO(task.startDate)
                            : task.startDate;
                        const isOverdue =
                          isBefore(startOfDay(taskDate), today) && task.status !== 'Done';

                        return (
                          <div
                            key={task._id}
                            draggable
                            onDragStart={(e) => handleCardDragStart(e, task)}
                            onDragEnd={handleCardDragEnd}
                            onClick={() => handleSelectTask(task)}
                            className="p-4 rounded-2xl bg-white/80 dark:bg-[#1A1A1A]/80 border border-white/80 dark:border-[#3A3A3A] shadow-sm hover:shadow-md hover:border-[#B3B3B3] dark:hover:border-[#565656] cursor-grab active:cursor-grabbing transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-semibold text-[#2B2B2B] dark:text-white leading-snug line-clamp-2">
                                {task.title}
                              </p>
                              <Badge
                                size="xs"
                                variant={
                                  task.priority === 'High'
                                    ? 'rose'
                                    : task.priority === 'Medium'
                                    ? 'amber'
                                    : 'slate'
                                }
                                className="shrink-0 text-[10px]"
                              >
                                {task.priority}
                              </Badge>
                            </div>

                            {task.description && (
                              <p className="text-xs text-[#565656] dark:text-[#848484] line-clamp-2 mb-3">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-[#848484] pt-2 border-t border-black/5 dark:border-white/5">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {format(taskDate, 'MMM d')}
                              </span>

                              {isOverdue && (
                                <span className="text-[10px] font-bold text-rose-500">
                                  Overdue
                                </span>
                              )}

                              {task.subtasks && task.subtasks.length > 0 && (
                                <span className="text-[10px] font-medium text-[#565656] dark:text-[#848484]">
                                  ✓ {task.subtasks.filter((s) => s.completed).length}/
                                  {task.subtasks.length}
                                </span>
                              )}
                            </div>

                            {/* Quick Status Move Actions */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-end gap-1.5"
                            >
                              {task.status === 'To Do' && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(task._id, 'In Progress')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold hover:bg-amber-100 transition-colors"
                                  title="Move to In Progress"
                                >
                                  <span>Start</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}

                              {task.status === 'In Progress' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStatus(task._id, 'To Do')}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[#565656] dark:text-[#B3B3B3] text-[10px] font-medium hover:bg-black/10 transition-colors"
                                    title="Move back to To Do"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                    <span>To Do</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStatus(task._id, 'Done')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                                    title="Mark as Completed"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Complete</span>
                                  </button>
                                </>
                              )}

                              {task.status === 'Done' && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(task._id, 'In Progress')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium hover:bg-indigo-100 transition-colors"
                                  title="Reopen task into In Progress"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reopen</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TaskFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setTaskToEdit(null);
        }}
        initialDate={modalInitialDate}
        editTask={taskToEdit}
        initialStatus={createStatus}
      />

      <TaskDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onEdit={handleEditTaskFromDetail}
      />
    </div>
  );
};
