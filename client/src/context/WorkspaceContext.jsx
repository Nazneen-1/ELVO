import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { workspaceService } from '../services/workspaceService.js';
import { useAuth } from './AuthContext.jsx';

const STORAGE_KEY = 'calflow_active_workspace';

const readActiveWorkspaceStorage = () => {
  try {
    if (typeof window !== 'undefined') {
      if (window.sessionStorage) {
        const sessionVal = window.sessionStorage.getItem(STORAGE_KEY);
        if (sessionVal) return sessionVal;
      }
      if (window.localStorage) {
        const localVal = window.localStorage.getItem(STORAGE_KEY);
        if (localVal) return localVal;
      }
    }
  } catch (err) {
    console.error('Failed to read active workspace preference:', err);
  }
  return 'personal';
};

const writeActiveWorkspaceStorage = (nextId) => {
  try {
    if (typeof window !== 'undefined') {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEY, nextId);
      }
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, nextId);
      }
    }
  } catch (err) {
    console.error('Failed to save active workspace preference:', err);
  }
};

const removeActiveWorkspaceStorage = () => {
  try {
    if (typeof window !== 'undefined') {
      if (window.sessionStorage) window.sessionStorage.removeItem(STORAGE_KEY);
      if (window.localStorage) window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
};

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize from tab-isolated sessionStorage (with localStorage fallback) immediately
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => readActiveWorkspaceStorage());

  // Persistent updater
  const setActiveWorkspaceId = useCallback((id) => {
    const nextId = id || 'personal';
    setActiveWorkspaceIdState(nextId);
    writeActiveWorkspaceStorage(nextId);
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await workspaceService.getWorkspaces({ includeArchived: true });
      if (response.success) {
        const fetched = response.data || [];
        setWorkspaces(fetched);

        // Validate stored collaborative workspace ID
        setActiveWorkspaceIdState((currentId) => {
          if (currentId === 'personal' || currentId === 'my-work') {
            return currentId;
          }
          const found = fetched.find((w) => w._id === currentId);
          // If workspace doesn't exist, fall back to personal
          if (!found) {
            writeActiveWorkspaceStorage('personal');
            return 'personal';
          }
          return currentId;
        });
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
    } else if (!authLoading) {
      setWorkspaces([]);
      setActiveWorkspaceIdState('personal');
      removeActiveWorkspaceStorage();
    }
  }, [user, authLoading, fetchWorkspaces]);

  const isPersonal = activeWorkspaceId === 'personal';
  const isMyWork = activeWorkspaceId === 'my-work';

  const activeWorkspace = (activeWorkspaceId === 'personal' || activeWorkspaceId === 'my-work')
    ? null
    : workspaces.find((w) => w._id === activeWorkspaceId) || null;

  // Compute current user's role and capabilities in the active workspace
  const { currentUserRole, isOwner, isAdmin, isMember, isViewer, canManage, canInvite } = useMemo(() => {
    if (!activeWorkspace || !user) {
      return {
        currentUserRole: null,
        isOwner: false,
        isAdmin: false,
        isMember: false,
        isViewer: false,
        canManage: false,
        canInvite: false,
      };
    }

    const uId = (user._id || user.id || '').toString();
    const ownerId = (activeWorkspace.owner?._id || activeWorkspace.owner || '').toString();

    let role = null;
    if (ownerId && ownerId === uId) {
      role = 'owner';
    } else {
      const mem = (activeWorkspace.members || []).find((m) => {
        const mUserId = (m.user?._id || m.user || '').toString();
        return mUserId === uId;
      });
      role = mem ? mem.role || 'member' : null;
    }

    return {
      currentUserRole: role,
      isOwner: role === 'owner',
      isAdmin: role === 'admin',
      isMember: role === 'member',
      isViewer: role === 'viewer',
      canManage: role === 'owner' || role === 'admin',
      canInvite: role === 'owner' || role === 'admin',
    };
  }, [activeWorkspace, user]);

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

  const updateWorkspace = async (id, data) => {
    try {
      const response = await workspaceService.updateWorkspace(id, data);
      if (response.success) {
        setWorkspaces((prev) => prev.map((w) => (w._id === id ? response.data : w)));
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update workspace',
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

  const regenerateJoinCode = async (workspaceId, data) => {
    try {
      const response = await workspaceService.regenerateJoinCode(workspaceId, data);
      if (response.success) {
        setWorkspaces((prev) =>
          prev.map((w) => (w._id === workspaceId ? { ...w, ...response.data } : w))
        );
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to regenerate join code',
      };
    }
  };

  const revokeJoinCode = async (workspaceId, data) => {
    try {
      const response = await workspaceService.revokeJoinCode(workspaceId, data);
      if (response.success) {
        setWorkspaces((prev) =>
          prev.map((w) => (w._id === workspaceId ? { ...w, ...response.data } : w))
        );
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to toggle join code',
      };
    }
  };

  const createInvitation = async (workspaceId, { email, role }) => {
    try {
      const response = await workspaceService.createInvitation(workspaceId, { email, role });
      if (response.success) {
        await fetchWorkspaces();
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to send invitation',
      };
    }
  };

  const acceptInvitation = async (token) => {
    try {
      const response = await workspaceService.acceptInvitation(token);
      if (response.success) {
        await fetchWorkspaces();
        setActiveWorkspaceId(response.data._id);
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to accept invitation',
      };
    }
  };

  const declineInvitation = async (token) => {
    try {
      const response = await workspaceService.declineInvitation(token);
      return response;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to decline invitation',
      };
    }
  };

  const revokeInvitation = async (workspaceId, invitationId) => {
    try {
      const response = await workspaceService.revokeInvitation(workspaceId, invitationId);
      if (response.success) {
        await fetchWorkspaces();
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to revoke invitation',
      };
    }
  };

  const inviteMember = async (workspaceId, email, role) => {
    return createInvitation(workspaceId, { email, role });
  };

  const updateMemberRole = async (workspaceId, userId, role) => {
    try {
      const response = await workspaceService.updateMemberRole(workspaceId, userId, role);
      if (response.success) {
        setWorkspaces((prev) =>
          prev.map((w) => (w._id === workspaceId ? response.data : w))
        );
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update member role',
      };
    }
  };

  const transferOwnership = async (workspaceId, newOwnerId) => {
    try {
      const response = await workspaceService.transferOwnership(workspaceId, newOwnerId);
      if (response.success) {
        setWorkspaces((prev) =>
          prev.map((w) => (w._id === workspaceId ? response.data : w))
        );
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to transfer ownership',
      };
    }
  };

  const removeMember = async (workspaceId, userId, reassignTo = null) => {
    try {
      const response = await workspaceService.removeMember(workspaceId, userId, reassignTo);
      if (response.success) {
        await fetchWorkspaces();
        return { success: true, data: response };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to remove member',
      };
    }
  };

  const archiveWorkspace = async (workspaceId) => {
    try {
      const response = await workspaceService.archiveWorkspace(workspaceId);
      if (response.success) {
        setWorkspaces((prev) =>
          prev.map((w) => (w._id === workspaceId ? response.data : w))
        );
        if (activeWorkspaceId === workspaceId) {
          setActiveWorkspaceId('personal');
        }
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to archive workspace',
      };
    }
  };

  const restoreWorkspace = async (workspaceId) => {
    try {
      const response = await workspaceService.restoreWorkspace(workspaceId);
      if (response.success) {
        setWorkspaces((prev) =>
          prev.map((w) => (w._id === workspaceId ? response.data : w))
        );
        setActiveWorkspaceId(workspaceId);
        return { success: true, data: response.data };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to restore workspace',
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
        isPersonal,
        isMyWork,
        currentUserRole,
        isOwner,
        isAdmin,
        isMember,
        isViewer,
        canManage,
        canInvite,
        isLoading,
        fetchWorkspaces,
        createWorkspace,
        updateWorkspace,
        joinWorkspace,
        regenerateJoinCode,
        revokeJoinCode,
        createInvitation,
        acceptInvitation,
        declineInvitation,
        revokeInvitation,
        inviteMember,
        updateMemberRole,
        transferOwnership,
        removeMember,
        archiveWorkspace,
        restoreWorkspace,
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
