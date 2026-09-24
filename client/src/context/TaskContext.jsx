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

  // Map tasks by ISO date string (yyyy-MM-dd) for fast grid rendering
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      // Filter by status if filter is active
      if (filterStatus !== 'all' && task.status !== filterStatus) {
        return;
      }

      const isoDate = toISODate(task.startDate);
      if (!map[isoDate]) {
        map[isoDate] = [];
      }
      map[isoDate].push(task);
    });
    return map;
  }, [tasks, filterStatus]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        tasksByDate,
        isLoading,
        filterStatus,
        setFilterStatus,
        fetchTasks,
        createTask,
        updateTask,
        deleteTask,
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
