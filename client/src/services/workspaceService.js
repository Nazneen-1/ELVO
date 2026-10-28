import api from './api.js';

export const workspaceService = {
  getWorkspaces: async (params = {}) => {
    const response = await api.get('/workspaces', { params });
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

  regenerateJoinCode: async (workspaceId, data = {}) => {
    const response = await api.post(`/workspaces/${workspaceId}/join-code/regenerate`, data);
    return response.data;
  },

  revokeJoinCode: async (workspaceId, data = {}) => {
    const response = await api.post(`/workspaces/${workspaceId}/join-code/revoke`, data);
    return response.data;
  },

  createInvitation: async (workspaceId, { email, role = 'member' }) => {
    const response = await api.post(`/workspaces/${workspaceId}/invitations`, { email, role });
    return response.data;
  },

  acceptInvitation: async (token) => {
    const response = await api.post(`/workspaces/invitations/${token}/accept`);
    return response.data;
  },

  declineInvitation: async (token) => {
    const response = await api.post(`/workspaces/invitations/${token}/decline`);
    return response.data;
  },

  revokeInvitation: async (workspaceId, invitationId) => {
    const response = await api.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`);
    return response.data;
  },

  inviteMember: async (workspaceId, email, role = 'member') => {
    const response = await api.post(`/workspaces/${workspaceId}/members`, { email, role });
    return response.data;
  },

  updateMemberRole: async (workspaceId, userId, role) => {
    const response = await api.put(`/workspaces/${workspaceId}/members/${userId}/role`, { role });
    return response.data;
  },

  transferOwnership: async (workspaceId, newOwnerId) => {
    const response = await api.post(`/workspaces/${workspaceId}/transfer-ownership`, { newOwnerId });
    return response.data;
  },

  removeMember: async (workspaceId, userId, reassignTo = null) => {
    const response = await api.delete(`/workspaces/${workspaceId}/members/${userId}`, {
      data: { reassignTo },
      params: reassignTo ? { reassignTo } : {},
    });
    return response.data;
  },

  archiveWorkspace: async (id) => {
    const response = await api.post(`/workspaces/${id}/archive`);
    return response.data;
  },

  restoreWorkspace: async (id) => {
    const response = await api.post(`/workspaces/${id}/restore`);
    return response.data;
  },

  getWorkspaceActivity: async (id) => {
    const response = await api.get(`/workspaces/${id}/activity`);
    return response.data;
  },

  deleteWorkspace: async (id) => {
    const response = await api.delete(`/workspaces/${id}`);
    return response.data;
  },
};

export default workspaceService;
