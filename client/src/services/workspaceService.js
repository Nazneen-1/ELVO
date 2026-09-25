import api from './api.js';

export const workspaceService = {
  getWorkspaces: async () => {
    const response = await api.get('/workspaces');
    return response.data;
  },

  createWorkspace: async (data) => {
    const response = await api.post('/workspaces', data);
    return response.data;
  },

  getWorkspaceById: async (id) => {
    const response = await api.get(`/workspaces/${id}`);
    return response.data;
  },

  updateWorkspace: async (id, data) => {
    const response = await api.put(`/workspaces/${id}`, data);
    return response.data;
  },

  joinWorkspace: async (inviteCode) => {
    const response = await api.post('/workspaces/join', { inviteCode });
    return response.data;
  },

  inviteMember: async (workspaceId, email, role = 'member') => {
    const response = await api.post(`/workspaces/${workspaceId}/members`, { email, role });
    return response.data;
  },

  removeMember: async (workspaceId, userId) => {
    const response = await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
    return response.data;
  },

  deleteWorkspace: async (id) => {
    const response = await api.delete(`/workspaces/${id}`);
    return response.data;
  },
};
