import api from './api.js';

export const taskService = {
  // Get tasks with optional date range, status, priority, workspaceId, tag, q, sort filters
  getTasks: async (params = {}) => {
    const response = await api.get('/tasks', { params });
    return response.data;
  },

  // Get task statistics for dashboard
  getTaskStats: async (params = {}) => {
    const response = await api.get('/tasks/stats', { params });
    return response.data;
  },

  // Get productivity analytics
  getAnalytics: async (params = {}) => {
    const response = await api.get('/tasks/analytics', { params });
    return response.data;
  },

  // Get task by ID
  getTaskById: async (id) => {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  // Create task
  createTask: async (taskData) => {
    const response = await api.post('/tasks', taskData);
    return response.data;
  },

  // Update task (full update)
  updateTask: async (id, taskData) => {
    const response = await api.put(`/tasks/${id}`, taskData);
    return response.data;
  },

  // Patch task (partial update, e.g., quick status toggle)
  patchTask: async (id, fields) => {
    const response = await api.patch(`/tasks/${id}`, fields);
    return response.data;
  },

  // Add comment to task
  addComment: async (id, text) => {
    const response = await api.post(`/tasks/${id}/comments`, { text });
    return response.data;
  },

  // Delete task
  deleteTask: async (id) => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },
};

