import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('elvo_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hydrate user profile if token exists on mount
  const loadUser = useCallback(async () => {
    const savedToken = localStorage.getItem('elvo_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.getMe();
      if (response.success) {
        const currentUser = response.data.user;
        setUser(currentUser);
        if (currentUser && !currentUser.preferences?.timezone) {
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
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      localStorage.removeItem('elvo_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Register
  const register = async (name, email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.register({ name, email, password });
      if (response.success) {
        const { user: newUser, token: newToken } = response.data;
        localStorage.setItem('elvo_token', newToken);
        setToken(newToken);
        setUser(newUser);
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
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login({ email, password });
      if (response.success) {
        const { user: loggedInUser, token: newToken } = response.data;
        localStorage.setItem('elvo_token', newToken);
        setToken(newToken);
        setUser(loggedInUser);
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
    localStorage.removeItem('elvo_token');
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
