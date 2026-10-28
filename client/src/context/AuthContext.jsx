import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/authService.js';
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  broadcastAuthEvent,
  subscribeAuthEvents,
} from '../utils/tokenStorage.js';

// Clear user-specific selections & workspace filters so they do not leak across accounts
const clearUserSessionPreferences = () => {
  try {
    if (typeof window !== 'undefined') {
      const keysToClear = [
        'calflow_active_workspace',
        'elvo_notes_scope',
        'elvo_notes_workspace_id',
        'elvo_notes_collection',
        'elvo_tasks_assigned_filter',
        'elvo_calendar_assigned_filter',
        'elvo_tasks_filter_source_ws',
        'elvo_tasks_filter_tag',
      ];
      keysToClear.forEach((k) => {
        if (window.localStorage) localStorage.removeItem(k);
        if (window.sessionStorage) window.sessionStorage.removeItem(k);
      });
    }
  } catch (err) {
    console.error('Failed to clear user session preferences:', err);
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getStoredToken());
  // Only start in loading state if there is actually a token that requires hydration
  const [isLoading, setIsLoading] = useState(() => !!getStoredToken());
  const [error, setError] = useState(null);

  // Request sequence ref to prevent out-of-order race conditions
  const loadUserSeqRef = useRef(0);

  // Hydrate user profile if token exists
  const loadUser = useCallback(async (overrideToken) => {
    const currentSeq = ++loadUserSeqRef.current;
    const tokenToUse = overrideToken !== undefined ? overrideToken : getStoredToken();

    if (!tokenToUse) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.getMe();
      if (currentSeq !== loadUserSeqRef.current) return;

      if (response.success && response.data?.user) {
        const currentUser = response.data.user;
        setUser(currentUser);
        setToken(tokenToUse);

        if (currentUser && !currentUser.preferences?.timezone) {
          try {
            const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (detectedTz) {
              authService.updatePreferences({ timezone: detectedTz }).then((res) => {
                if (res.success && res.data?.preferences && currentSeq === loadUserSeqRef.current) {
                  setUser((prev) => (prev ? {
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      timezone: detectedTz,
                    },
                  } : prev));
                }
              }).catch(() => {});
            }
          } catch {}
        }
      } else {
        if (getStoredToken() === tokenToUse && currentSeq === loadUserSeqRef.current) {
          clearStoredToken();
          setToken(null);
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      // Only clear if the failing token is still the active token in storage
      if (getStoredToken() === tokenToUse && currentSeq === loadUserSeqRef.current) {
        clearStoredToken();
        setToken(null);
        setUser(null);
      }
    } finally {
      if (currentSeq === loadUserSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Listen for cross-tab session changes (BroadcastChannel & storage events)
  useEffect(() => {
    const unsubscribe = subscribeAuthEvents((eventType) => {
      if (eventType === 'LOGIN') {
        const latestToken = getStoredToken();
        if (latestToken) {
          setToken(latestToken);
          loadUser(latestToken);
        }
      } else if (eventType === 'LOGOUT' || eventType === 'EXPIRED') {
        clearUserSessionPreferences();
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            window.sessionStorage.removeItem('elvo_token');
          } catch {}
        }
        setToken(null);
        setUser(null);
        setIsLoading(false);
      } else if (eventType === 'USER_UPDATED') {
        const latestToken = getStoredToken();
        if (latestToken) {
          loadUser(latestToken);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadUser]);

  // Register
  const register = async (name, email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.register({ name, email, password });
      if (response.success) {
        const { user: newUser, token: newToken } = response.data;
        setStoredToken(newToken);
        setToken(newToken);
        setUser(newUser);
        broadcastAuthEvent('LOGIN');
        return { success: true };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  // Login
  const login = async (email, password) => {
    setError(null);
    try {
      const response = await authService.login({ email, password });
      if (response.success) {
        const { user: loggedInUser, token: newToken } = response.data;
        setStoredToken(newToken);
        setToken(newToken);
        setUser(loggedInUser);
        broadcastAuthEvent('LOGIN');
        if (loggedInUser && !loggedInUser.preferences?.timezone) {
          try {
            const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (detectedTz) {
              authService.updatePreferences({ timezone: detectedTz }).then((res) => {
                if (res.success && res.data?.preferences) {
                  setUser((prev) => (prev ? {
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      timezone: detectedTz,
                    },
                  } : prev));
                }
              }).catch(() => {});
            }
          } catch {}
        }
        return { success: true, user: loggedInUser };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid email or password.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = () => {
    clearUserSessionPreferences();
    clearStoredToken();
    broadcastAuthEvent('LOGOUT');
    setToken(null);
    setUser(null);
  };

  // Update user preferences
  const updateUserPreferences = async (newPrefs) => {
    try {
      const response = await authService.updatePreferences(newPrefs);
      if (response.success) {
        const updatedPrefs = response.data?.preferences || response.data;
        setUser((prev) => (prev ? {
          ...prev,
          preferences: {
            ...prev.preferences,
            ...updatedPrefs,
          },
        } : prev));
        broadcastAuthEvent('USER_UPDATED');
        return { success: true, data: updatedPrefs };
      }
      return { success: false, error: response.message || 'Failed to update preferences' };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to update preferences';
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        error,
        register,
        login,
        logout,
        setUser,
        updateUserPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
