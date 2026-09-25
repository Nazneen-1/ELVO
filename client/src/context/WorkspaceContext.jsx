import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { workspaceService } from '../services/workspaceService.js';
import { useAuth } from './AuthContext.jsx';

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('personal'); // 'personal' or workspace._id
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await workspaceService.getWorkspaces();
      if (response.success) {
        setWorkspaces(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspaceId('personal');
    }
  }, [user, fetchWorkspaces]);

  const activeWorkspace = activeWorkspaceId === 'personal'
    ? null
    : workspaces.find((w) => w._id === activeWorkspaceId) || null;

  const createWorkspace = async (data) => {
    try {
      const response = await workspaceService.createWorkspace(data);
      if (response.success) {
        setWorkspaces((prev) => [response.data, ...prev]);
        setActiveWorkspaceId(response.data._id);
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create workspace',
      };
    }
  };

  const joinWorkspace = async (inviteCode) => {
    try {
      const response = await workspaceService.joinWorkspace(inviteCode);
      if (response.success) {
        setWorkspaces((prev) => [response.data, ...prev]);
        setActiveWorkspaceId(response.data._id);
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to join workspace',
      };
    }
  };

  const inviteMember = async (workspaceId, email, role) => {
    try {
      const response = await workspaceService.inviteMember(workspaceId, email, role);
      if (response.success) {
        setWorkspaces((prev) =>
          prev.map((w) => (w._id === workspaceId ? response.data : w))
        );
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to invite member',
      };
    }
  };

  const removeMember = async (workspaceId, userId) => {
    try {
      const response = await workspaceService.removeMember(workspaceId, userId);
      if (response.success) {
        await fetchWorkspaces();
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to remove member',
      };
    }
  };

  const deleteWorkspace = async (workspaceId) => {
    try {
      const response = await workspaceService.deleteWorkspace(workspaceId);
      if (response.success) {
        setWorkspaces((prev) => prev.filter((w) => w._id !== workspaceId));
        if (activeWorkspaceId === workspaceId) {
          setActiveWorkspaceId('personal');
        }
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete workspace',
      };
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        setActiveWorkspaceId,
        activeWorkspace,
        isLoading,
        fetchWorkspaces,
        createWorkspace,
        joinWorkspace,
        inviteMember,
        removeMember,
        deleteWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
