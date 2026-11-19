import api from './api.js';

export const authService = {
  // Pre-warm backend (non-blocking ping to wake Render service if sleeping)
  pingHealth: async () => {
    try {
      await api.get('/health', { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  },

  // Register a new user with generous timeout for cold starts
  register: async (userData) => {
    const response = await api.post('/auth/register', userData, { timeout: 45000 });
    return response.data;
  },

  // Login user with cold-start tolerance and safe single-retry for transient gateway/timeout errors
  login: async (credentials) => {
    const sendLogin = () => api.post('/auth/login', credentials, { timeout: 45000 });

    try {
      const response = await sendLogin();
      return response.data;
    } catch (err) {
      // Check if this is a transient server cold start / wake-up condition (502, 503, 504, or abort timeout)
      // Strictly NEVER retry client errors or bad credentials (400, 401, 403, 409, 429)
      const status = err.response?.status;
      const isTransientColdStart =
        status === 502 ||
        status === 503 ||
        status === 504 ||
        (err.code === 'ECONNABORTED' && !err.response);

      if (isTransientColdStart) {
        console.warn('[ELVO Auth] Server cold start / gateway transition detected. Retrying sign in once...');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const retryResponse = await sendLogin();
        return retryResponse.data;
      }

      throw err;
    }
  },

  // Get current user profile
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Update preferences
  updatePreferences: async (preferences) => {
    const response = await api.put('/auth/preferences', preferences);
    return response.data;
  },
};
