import axios from 'axios';
import { getStoredToken, clearStoredToken, broadcastAuthEvent } from '../utils/tokenStorage.js';

// Resolve API Base URL for both production deployment (Render) and local development
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const isDev = import.meta.env.DEV;

  // In production builds, ignore local dev environment variables pointing to localhost
  if (envUrl && (isDev || !envUrl.includes('localhost'))) {
    const clean = envUrl.replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }

  // If in browser and not on localhost, use production backend on Render
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://elvo.onrender.com/api';
  }

  return 'http://localhost:5002/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000, // 10 second timeout to prevent stuck loading states
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token from shared browser profile storage
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized safely
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Extract the bearer token that was sent on this specific failing request
      const authHeader = error.config?.headers?.Authorization || error.config?.headers?.authorization;
      const requestToken = authHeader && typeof authHeader === 'string'
        ? authHeader.replace(/^Bearer\s+/i, '').trim()
        : null;
      const activeToken = getStoredToken();

      // If the failing request carried an OLD/stale token that has already been superseded
      // by a newer active session in storage, DO NOT clear the active session or redirect!
      if (requestToken && activeToken && requestToken !== activeToken) {
        console.warn('[ELVO API] Ignored 401 from stale in-flight request; active session is newer.');
        return Promise.reject(error);
      }

      // Genuine 401: Active token is invalid or expired
      clearStoredToken();
      broadcastAuthEvent('EXPIRED');

      // If we are in the protected app area, redirect to login
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
