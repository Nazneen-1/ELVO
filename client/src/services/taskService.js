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

  // Update a comment on task
  updateComment: async (taskId, commentId, text) => {
    const response = await api.put(`/tasks/${taskId}/comments/${commentId}`, { text });
    return response.data;
  },

  // Delete a comment from task
  deleteComment: async (taskId, commentId) => {
    const response = await api.delete(`/tasks/${taskId}/comments/${commentId}`);
    return response.data;
  },

  // Delete task
  deleteTask: async (id) => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },

  // Update or skip an occurrence of a recurring task
  updateOccurrence: async (id, date, { action, status, overrides } = {}) => {
    const response = await api.post(`/tasks/${id}/occurrences`, {
      date,
      action,
      status,
      overrides,
    });
    return response.data;
  },

  // Skip a specific occurrence
  skipOccurrence: async (id, date) => {
    const response = await api.post(`/tasks/${id}/occurrences`, {
      date,
      action: 'skip',
    });
    return response.data;
  },

  // Reschedule a single occurrence of a recurring task
  rescheduleOccurrence: async (id, date, { rescheduledDate, startTime, endTime, isAllDay, confirmed } = {}) => {
    const response = await api.post(`/tasks/${id}/occurrences/${date}/reschedule`, {
      rescheduledDate,
      startTime,
      endTime,
      isAllDay,
      ...(confirmed ? { confirmed: true } : {}),
    });
    return response.data;
  },

  // Authoritative preflight conflict check
  checkConflicts: async ({ candidate, excludeTaskId, excludeOccurrenceDate, workspaceId } = {}) => {
    const response = await api.post('/tasks/check-conflicts', {
      candidate,
      excludeTaskId,
      excludeOccurrenceDate,
      workspaceId,
    });
    return response.data;
  },
};

