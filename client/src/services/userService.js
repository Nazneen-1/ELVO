import api from './api.js';

export const userService = {
  getUserProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateUserProfile: async (data) => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },
};
