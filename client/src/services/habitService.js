import api from './api.js';

export const habitService = {
  // Get habits list (with streaks)
  getHabits: async (params = {}) => {
    const response = await api.get('/habits', { params });
    return response.data;
  },

  // Get single habit by ID
  getHabitById: async (id) => {
    const response = await api.get(`/habits/${id}`);
    return response.data;
  },

  // Create habit
  createHabit: async (data) => {
    const response = await api.post('/habits', data);
    return response.data;
  },

  // Update habit
  updateHabit: async (id, data) => {
    const response = await api.put(`/habits/${id}`, data);
    return response.data;
  },

  // Archive habit
  archiveHabit: async (id) => {
    const response = await api.patch(`/habits/${id}/archive`);
    return response.data;
  },

  // Restore habit
  restoreHabit: async (id) => {
    const response = await api.patch(`/habits/${id}/restore`);
    return response.data;
  },

  // Delete habit permanently
  deleteHabit: async (id) => {
    const response = await api.delete(`/habits/${id}`);
    return response.data;
  },

  // Reorder habits
  reorderHabits: async (habitIds) => {
    const response = await api.put('/habits/reorder', { habitIds });
    return response.data;
  },

  // Toggle or set habit completion on date
  toggleCompletion: async (habitId, date, isCompleted) => {
    const response = await api.post(`/habits/${habitId}/toggle`, { date, isCompleted });
    return response.data;
  },

  // Daily overview
  getDailyOverview: async (date) => {
    const response = await api.get('/habits/daily', { params: { date } });
    return response.data;
  },

  // Month matrix
  getMonthMatrix: async (year, month) => {
    const response = await api.get('/habits/matrix', { params: { year, month } });
    return response.data;
  },

  // High-level stats
  getHabitStats: async () => {
    const response = await api.get('/habits/stats');
    return response.data;
  },

  // Habit Targets CRUD
  getHabitTargets: async () => {
    const response = await api.get('/habits/targets');
    return response.data;
  },

  createHabitTarget: async (data) => {
    const response = await api.post('/habits/targets', data);
    return response.data;
  },

  updateHabitTarget: async (id, data) => {
    const response = await api.put(`/habits/targets/${id}`, data);
    return response.data;
  },

  deleteHabitTarget: async (id) => {
    const response = await api.delete(`/habits/targets/${id}`);
    return response.data;
  },
};

export default habitService;
