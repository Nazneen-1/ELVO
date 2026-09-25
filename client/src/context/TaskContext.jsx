import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { taskService } from '../services/taskService.js';
import { toISODate } from '../utils/dateUtils.js';

const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState(''); // new state for search
  const [selectedTask, setSelectedTask] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  // Map tasks by ISO date string (yyyy-MM-dd) for fast grid rendering
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      // Apply status filter
      if (filterStatus !== 'all' && task.status !== filterStatus) {
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
  }, [tasks, filterStatus, searchQuery]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        tasksByDate,
        isLoading,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        fetchTasks,
        createTask,
        updateTask,
        patchTask: async (id, fields) => {
          try {
            const response = await taskService.patchTask(id, fields);
            if (response.success) {
              setTasks((prev) =>
                prev.map((t) => (t._id === id ? response.data : t))
              );
              if (selectedTask && selectedTask._id === id) {
                setSelectedTask(response.data);
              }
              return { success: true, data: response.data };
            }
          } catch (err) {
            return { success: false, error: err.message };
          }
        },
        deleteTask,
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
