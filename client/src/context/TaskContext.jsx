import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { taskService } from '../services/taskService.js';
import { toISODate } from '../utils/dateUtils.js';
import { ConflictConfirmationModal } from '../components/common/ConflictConfirmationModal.jsx';

const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [calendarError, setCalendarErrorState] = useState(null);
  const calendarErrorTimeoutRef = useRef(null);
  const [conflictModalState, setConflictModalState] = useState({
    isOpen: false,
    conflicts: [],
    onProceed: null,
    onCancel: null,
  });

  const setCalendarError = useCallback((msg) => {
    if (calendarErrorTimeoutRef.current) {
      clearTimeout(calendarErrorTimeoutRef.current);
    }
    setCalendarErrorState(msg);
    if (msg) {
      calendarErrorTimeoutRef.current = setTimeout(() => {
        setCalendarErrorState(null);
      }, 5000);
    }
  }, []);

  // Fetch tasks
  const fetchTasks = useCallback(async (params = {}) => {
    setIsLoading(true);
    try {
      const response = await taskService.getTasks(params);
      if (response.success) {
        setTasks(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create task
  const createTask = async (taskData) => {
    try {
      const response = await taskService.createTask(taskData);
      if (response.success) {
        setTasks((prev) => [...prev, response.data]);
        return { success: true, data: response.data };
      }
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.conflictCode === 'TASK_CONFLICT') {
        const conflicts = error.response.data.conflicts || [];
        return new Promise((resolve) => {
          setConflictModalState({
            isOpen: true,
            conflicts,
            onProceed: async () => {
              try {
                const retryResponse = await taskService.createTask({ ...taskData, confirmed: true });
                if (retryResponse.success) {
                  setTasks((prev) => [...prev, retryResponse.data]);
                  setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                  resolve({ success: true, data: retryResponse.data });
                } else {
                  setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                  resolve({ success: false, error: 'Failed to create task after confirmation' });
                }
              } catch (retryErr) {
                setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                resolve({
                  success: false,
                  error: retryErr.response?.data?.message || 'Failed to create task after confirmation',
                });
              }
            },
            onCancel: () => {
              setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
              resolve({ success: false, cancelled: true, error: 'Operation cancelled by user' });
            },
          });
        });
      }
      console.error('Failed to create task:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create task',
      };
    }
  };

  // Update task
  const updateTask = async (id, taskData) => {
    try {
      const response = await taskService.updateTask(id, taskData);
      if (response.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === id ? response.data : t))
        );
        if (selectedTask && selectedTask._id === id) {
          setSelectedTask(response.data);
        }
        return { success: true, data: response.data };
      }
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.conflictCode === 'TASK_CONFLICT') {
        const conflicts = error.response.data.conflicts || [];
        return new Promise((resolve) => {
          setConflictModalState({
            isOpen: true,
            conflicts,
            onProceed: async () => {
              try {
                const retryResponse = await taskService.updateTask(id, { ...taskData, confirmed: true });
                if (retryResponse.success) {
                  setTasks((prev) =>
                    prev.map((t) => (t._id === id ? retryResponse.data : t))
                  );
                  if (selectedTask && selectedTask._id === id) {
                    setSelectedTask(retryResponse.data);
                  }
                  setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                  resolve({ success: true, data: retryResponse.data });
                } else {
                  setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                  resolve({ success: false, error: 'Failed to update task after confirmation' });
                }
              } catch (retryErr) {
                setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                resolve({
                  success: false,
                  error: retryErr.response?.data?.message || 'Failed to update task after confirmation',
                });
              }
            },
            onCancel: () => {
              setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
              resolve({ success: false, cancelled: true, error: 'Operation cancelled by user' });
            },
          });
        });
      }
      console.error('Failed to update task:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update task',
      };
    }
  };

  // Delete task
  const deleteTask = async (id) => {
    try {
      const response = await taskService.deleteTask(id);
      if (response.success) {
        setTasks((prev) => prev.filter((t) => t._id !== id));
        if (selectedTask && selectedTask._id === id) {
          setSelectedTask(null);
          setIsDetailOpen(false);
        }
        return { success: true };
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete task',
      };
    }
  };

  // Add comment to task
  const addComment = async (taskId, text) => {
    try {
      const response = await taskService.addComment(taskId, text);
      if (response.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? response.data : t))
        );
        if (selectedTask && selectedTask._id === taskId) {
          setSelectedTask(response.data);
        }
        return { success: true, data: response.data };
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to add comment',
      };
    }
  };

  // Toggle subtask completion
  const toggleSubtask = async (taskId, subtaskId) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;

    const updatedSubtasks = (task.subtasks || []).map((st) =>
      st._id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    try {
      const response = await taskService.patchTask(taskId, { subtasks: updatedSubtasks });
      if (response.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? response.data : t))
        );
        if (selectedTask && selectedTask._id === taskId) {
          setSelectedTask(response.data);
        }
      }
    } catch (error) {
      console.error('Failed to toggle subtask:', error);
    }
  };

  // Update a single occurrence of a recurring task (complete, reopen, or skip)
  const updateOccurrence = async (masterTaskId, occurrenceDate, { action, status, overrides } = {}) => {
    try {
      const response = await taskService.updateOccurrence(masterTaskId, occurrenceDate, {
        action,
        status,
        overrides,
      });

      if (response.success) {
        const occId = `${masterTaskId}__${occurrenceDate}`;
        const targetAction = response.occurrence?.action || action;
        const targetStatus =
          response.occurrence?.status ||
          status ||
          (targetAction === 'completed' ? 'Done' : 'To Do');

        if (targetAction === 'skipped') {
          // Remove only this occurrence from the calendar state
          setTasks((prev) =>
            prev.filter((t) => t.occurrenceId !== occId && !(t.masterTaskId === masterTaskId && t.occurrenceDate === occurrenceDate))
          );
          if (
            selectedTask &&
            (selectedTask.occurrenceId === occId ||
              (selectedTask.masterTaskId === masterTaskId && selectedTask.occurrenceDate === occurrenceDate))
          ) {
            setSelectedTask(null);
            setIsDetailOpen(false);
          }
        } else {
          // Update status of this occurrence in the task list
          setTasks((prev) =>
            prev.map((t) => {
              if (
                t.occurrenceId === occId ||
                (t.masterTaskId === masterTaskId && t.occurrenceDate === occurrenceDate)
              ) {
                return { ...t, status: targetStatus };
              }
              // Also sync master task document if present
              if (t._id === masterTaskId && !t.isOccurrence) {
                return response.data;
              }
              return t;
            })
          );
          if (
            selectedTask &&
            (selectedTask.occurrenceId === occId ||
              (selectedTask.masterTaskId === masterTaskId && selectedTask.occurrenceDate === occurrenceDate))
          ) {
            setSelectedTask((prev) => ({
              ...prev,
              status: targetStatus,
              recurrenceExceptions: response.data.recurrenceExceptions,
            }));
          }
        }
        return { success: true, data: response.data, occurrence: response.occurrence };
      }
      return { success: false, error: 'Failed to update occurrence' };
    } catch (error) {
      console.error('Failed to update occurrence:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update occurrence',
      };
    }
  };

  // Skip a specific occurrence
  const skipOccurrence = async (masterTaskId, occurrenceDate) => {
    return updateOccurrence(masterTaskId, occurrenceDate, { action: 'skip' });
  };

  // Reschedule a single occurrence of a recurring task
  const rescheduleOccurrence = async (
    masterTaskId,
    originalOccurrenceDate,
    { rescheduledDate, startTime, endTime, isAllDay, confirmed } = {}
  ) => {
    try {
      const response = await taskService.rescheduleOccurrence(masterTaskId, originalOccurrenceDate, {
        rescheduledDate,
        startTime,
        endTime,
        isAllDay,
        confirmed,
      });

      if (response.success) {
        const occId = `${masterTaskId}__${originalOccurrenceDate}`;
        const [y, m, d] = rescheduledDate.split('-').map(Number);
        const newDateUTC = new Date(Date.UTC(y, m - 1, d));

        setTasks((prev) => {
          let updated = false;
          const next = prev.map((t) => {
            if (
              t.occurrenceId === occId ||
              (t.masterTaskId === masterTaskId && t.originalOccurrenceDate === originalOccurrenceDate)
            ) {
              updated = true;
              return {
                ...t,
                startDate: newDateUTC,
                occurrenceDate: rescheduledDate,
                originalOccurrenceDate,
                isRescheduled: true,
                ...(startTime !== undefined ? { startTime } : {}),
                ...(endTime !== undefined ? { endTime } : {}),
                ...(isAllDay !== undefined ? { isAllDay } : {}),
              };
            }
            if (t._id === masterTaskId && !t.isOccurrence) {
              return response.data;
            }
            return t;
          });

          // If this occurrence was moved into the visible window from outside
          if (!updated) {
            next.push({
              ...response.data,
              _id: response.data._id,
              occurrenceId: occId,
              originalOccurrenceDate,
              occurrenceDate: rescheduledDate,
              isOccurrence: true,
              isRescheduled: true,
              masterTaskId,
              startDate: newDateUTC,
              status: response.occurrence?.status || response.data.status || 'To Do',
              ...(startTime !== undefined ? { startTime } : {}),
              ...(endTime !== undefined ? { endTime } : {}),
              ...(isAllDay !== undefined ? { isAllDay } : {}),
            });
          }

          return next;
        });

        if (
          selectedTask &&
          (selectedTask.occurrenceId === occId ||
            (selectedTask.masterTaskId === masterTaskId &&
              selectedTask.originalOccurrenceDate === originalOccurrenceDate))
        ) {
          setSelectedTask((prev) => ({
            ...prev,
            startDate: newDateUTC,
            occurrenceDate: rescheduledDate,
            originalOccurrenceDate,
            isRescheduled: true,
            ...(startTime !== undefined ? { startTime } : {}),
            ...(endTime !== undefined ? { endTime } : {}),
            ...(isAllDay !== undefined ? { isAllDay } : {}),
            recurrenceExceptions: response.data.recurrenceExceptions,
          }));
        }

        return { success: true, data: response.data, occurrence: response.occurrence };
      }
      return { success: false, error: 'Failed to reschedule occurrence' };
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.conflictCode === 'TASK_CONFLICT') {
        const conflicts = error.response.data.conflicts || [];
        return new Promise((resolve) => {
          setConflictModalState({
            isOpen: true,
            conflicts,
            onProceed: async () => {
              const retryRes = await rescheduleOccurrence(masterTaskId, originalOccurrenceDate, {
                rescheduledDate,
                startTime,
                endTime,
                isAllDay,
                confirmed: true,
              });
              setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
              resolve(retryRes);
            },
            onCancel: () => {
              setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
              resolve({ success: false, cancelled: true, error: 'Operation cancelled by user' });
            },
          });
        });
      }
      console.error('Failed to reschedule occurrence:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to reschedule occurrence',
      };
    }
  };

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterStatus('all');
    setFilterPriority('all');
    setSearchQuery('');
  }, []);

  // Map tasks by ISO date string (yyyy-MM-dd) for fast grid rendering
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      // Apply status filter
      if (filterStatus !== 'all' && task.status !== filterStatus) {
        return;
      }
      // Apply priority filter
      if (filterPriority !== 'all' && task.priority !== filterPriority) {
        return;
      }
      // Apply search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          task.title.toLowerCase().includes(q) ||
          (task.description && task.description.toLowerCase().includes(q)) ||
          (task.tags && task.tags.some((tag) => tag.toLowerCase().includes(q)));
        if (!matches) return;
      }

      const isoDate = toISODate(task.startDate);
      if (!map[isoDate]) {
        map[isoDate] = [];
      }
      map[isoDate].push(task);
    });
    return map;
  }, [tasks, filterStatus, filterPriority, searchQuery]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        tasksByDate,
        isLoading,
        filterStatus,
        setFilterStatus,
        filterPriority,
        setFilterPriority,
        searchQuery,
        setSearchQuery,
        clearFilters,
        fetchTasks,
        createTask,
        updateTask,
        patchTask: async (id, fields) => {
          try {
            const response = await taskService.patchTask(id, fields);
            if (response.success) {
              setTasks((prev) =>
                prev.map((t) => {
                  if (t.isOccurrence) return t;
                  return t._id === id ? response.data : t;
                })
              );
              if (selectedTask && selectedTask._id === id) {
                setSelectedTask(response.data);
              }
              return { success: true, data: response.data };
            }
            return { success: false, error: 'Failed to update task' };
          } catch (err) {
            if (err.response?.status === 409 && err.response?.data?.conflictCode === 'TASK_CONFLICT') {
              const conflicts = err.response.data.conflicts || [];
              return new Promise((resolve) => {
                setConflictModalState({
                  isOpen: true,
                  conflicts,
                  onProceed: async () => {
                    try {
                      const retryResponse = await taskService.patchTask(id, { ...fields, confirmed: true });
                      if (retryResponse.success) {
                        setTasks((prev) =>
                          prev.map((t) => {
                            if (t.isOccurrence) return t;
                            return t._id === id ? retryResponse.data : t;
                          })
                        );
                        if (selectedTask && selectedTask._id === id) {
                          setSelectedTask(retryResponse.data);
                        }
                        setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                        resolve({ success: true, data: retryResponse.data });
                      } else {
                        setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                        resolve({ success: false, error: 'Failed to update task after confirmation' });
                      }
                    } catch (retryErr) {
                      setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                      resolve({
                        success: false,
                        error: retryErr.response?.data?.message || 'Failed to update task after confirmation',
                      });
                    }
                  },
                  onCancel: () => {
                    setConflictModalState({ isOpen: false, conflicts: [], onProceed: null, onCancel: null });
                    resolve({ success: false, cancelled: true, error: 'Operation cancelled by user' });
                  },
                });
              });
            }
            const errMsg = err.response?.data?.message || err.message || 'Failed to update task';
            return { success: false, error: errMsg };
          }
        },
        deleteTask,
        updateOccurrence,
        skipOccurrence,
        rescheduleOccurrence,
        calendarError,
        setCalendarError,
        addComment,
        toggleSubtask,
        selectedTask,
        setSelectedTask,
        isFormOpen,
        setIsFormOpen,
        isDetailOpen,
        setIsDetailOpen,
      }}
    >
      {children}
      <ConflictConfirmationModal
        isOpen={conflictModalState.isOpen}
        conflicts={conflictModalState.conflicts}
        onProceed={conflictModalState.onProceed}
        onCancel={conflictModalState.onCancel}
      />
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};
