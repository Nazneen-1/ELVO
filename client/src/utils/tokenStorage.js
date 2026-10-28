/**
 * ELVO Token Storage Utility
 *
 * Implements shared browser-profile session management using localStorage as the
 * authoritative origin-level session store, supplemented with BroadcastChannel
 * and StorageEvent cross-tab synchronization.
 *
 * Architecture:
 * 1. Single source of truth:
 *    localStorage is shared across all tabs and windows in the same browser profile.
 *    When User A signs in on Tab 1, Tab 2 in the same browser profile automatically
 *    shares the authenticated session.
 * 2. Cross-tab synchronization:
 *    BroadcastChannel('elvo_auth_sync') and window 'storage' events instantly notify
 *    other open tabs when a login, logout, profile update, or session expiration occurs.
 *    No raw credentials or secrets are broadcasted across event payloads.
 * 3. Browser profile isolation:
 *    Separate browser profiles (or Incognito / InPrivate windows) maintain independent
 *    storage contexts and can authenticate separate accounts independently.
 */

const TOKEN_KEY = 'elvo_token';
const AUTH_EVENT_KEY = 'elvo_auth_event';
const AUTH_CHANNEL_NAME = 'elvo_auth_sync';

// Singleton BroadcastChannel instance
let authChannelInstance = null;
const getAuthChannel = () => {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!authChannelInstance) {
      try {
        authChannelInstance = new BroadcastChannel(AUTH_CHANNEL_NAME);
      } catch (err) {
        console.warn('[ELVO Auth] Failed to initialize BroadcastChannel:', err);
      }
    }
  }
  return authChannelInstance;
};

/**
 * Retrieves the authenticated JWT for the browser profile.
 * Checks localStorage first; falls back to sessionStorage for graceful migration.
 * @returns {string|null} The bearer token or null if unauthenticated.
 */
export const getStoredToken = () => {
  try {
    if (typeof window === 'undefined') return null;

    // 1. Primary authoritative store: localStorage (shared across tabs in browser profile)
    if (window.localStorage) {
      const localToken = window.localStorage.getItem(TOKEN_KEY);
      if (localToken) {
        // Keep sessionStorage aligned for single-tab backup
        if (window.sessionStorage && window.sessionStorage.getItem(TOKEN_KEY) !== localToken) {
          window.sessionStorage.setItem(TOKEN_KEY, localToken);
        }
        return localToken;
      }
    }

    // 2. Migration fallback: check sessionStorage if localStorage was empty
    if (window.sessionStorage) {
      // Check if an explicit logout or expiration occurred in this profile
      if (window.localStorage) {
        const lastAuthEvent = window.localStorage.getItem(AUTH_EVENT_KEY);
        if (lastAuthEvent) {
          try {
            const parsed = JSON.parse(lastAuthEvent);
            if (parsed?.type === 'LOGOUT' || parsed?.type === 'EXPIRED') {
              // User explicitly logged out in this profile; purge stale sessionStorage token
              window.sessionStorage.removeItem(TOKEN_KEY);
              return null;
            }
          } catch {}
        }
      }

      const sessionToken = window.sessionStorage.getItem(TOKEN_KEY);
      if (sessionToken) {
        // Migrate into shared localStorage for cross-tab availability
        if (window.localStorage) {
          window.localStorage.setItem(TOKEN_KEY, sessionToken);
        }
        return sessionToken;
      }
    }
  } catch (err) {
    console.warn('[ELVO Auth] Failed to read auth token from storage:', err);
  }
  return null;
};

/**
 * Persists an authenticated JWT for the browser profile and notifies other tabs.
 * @param {string} token
 */
export const setStoredToken = (token) => {
  try {
    if (typeof window === 'undefined') return;

    if (token) {
      if (window.localStorage) {
        window.localStorage.setItem(TOKEN_KEY, token);
        // Dispatch storage event trigger for cross-tab listeners
        window.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type: 'LOGIN', timestamp: Date.now() }));
      }
      if (window.sessionStorage) {
        window.sessionStorage.setItem(TOKEN_KEY, token);
      }
      broadcastAuthEvent('LOGIN');
    } else {
      clearStoredToken();
    }
  } catch (err) {
    console.warn('[ELVO Auth] Failed to persist auth token to storage:', err);
  }
};

/**
 * Clears the authenticated JWT from storage and notifies other tabs.
 */
export const clearStoredToken = () => {
  try {
    if (typeof window === 'undefined') return;

    if (window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type: 'LOGOUT', timestamp: Date.now() }));
    }
    if (window.sessionStorage) {
      window.sessionStorage.removeItem(TOKEN_KEY);
    }
    broadcastAuthEvent('LOGOUT');
  } catch (err) {
    console.warn('[ELVO Auth] Failed to clear auth token from storage:', err);
  }
};

/**
 * Broadcasts an authentication state change signal to other tabs in this profile.
 * Only signals event types; never broadcasts sensitive token payloads.
 * @param {'LOGIN'|'LOGOUT'|'USER_UPDATED'|'EXPIRED'} type
 */
export const broadcastAuthEvent = (type) => {
  try {
    const channel = getAuthChannel();
    if (channel) {
      channel.postMessage({ type, timestamp: Date.now() });
    }
  } catch (err) {
    console.warn('[ELVO Auth] Failed to broadcast auth event:', err);
  }
};

/**
 * Subscribes to cross-tab authentication events from both BroadcastChannel
 * and localStorage StorageEvent APIs for comprehensive browser support.
 * @param {(type: 'LOGIN'|'LOGOUT'|'USER_UPDATED'|'EXPIRED') => void} callback
 * @returns {() => void} Unsubscribe cleanup function
 */
export const subscribeAuthEvents = (callback) => {
  if (typeof window === 'undefined') return () => {};

  // 1. Memory-based BroadcastChannel listener
  const channel = getAuthChannel();
  const handleChannelMessage = (event) => {
    if (event && event.data && event.data.type) {
      callback(event.data.type);
    }
  };

  if (channel) {
    channel.addEventListener('message', handleChannelMessage);
  }

  // 2. Storage event listener (triggers in all other tabs when localStorage changes)
  const handleStorageEvent = (event) => {
    if (!event) return;

    if (event.key === TOKEN_KEY) {
      if (event.newValue) {
        callback('LOGIN');
      } else {
        callback('LOGOUT');
      }
    } else if (event.key === AUTH_EVENT_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed?.type) {
          callback(parsed.type);
        }
      } catch {}
    } else if (event.key === null) {
      // localStorage.clear() occurred
      callback('LOGOUT');
    }
  };

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    if (channel) {
      channel.removeEventListener('message', handleChannelMessage);
    }
    window.removeEventListener('storage', handleStorageEvent);
  };
};
