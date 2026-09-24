import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('calflow_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hydrate user profile if token exists on mount
  const loadUser = useCallback(async () => {
    const savedToken = localStorage.getItem('calflow_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.getMe();
      if (response.success) {
        setUser(response.data.user);
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      localStorage.removeItem('calflow_token');
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
        localStorage.setItem('calflow_token', newToken);
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
        localStorage.setItem('calflow_token', newToken);
        setToken(newToken);
        setUser(loggedInUser);
        return { success: true };
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
    localStorage.removeItem('calflow_token');
    setToken(null);
    setUser(null);
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
