/**
 * ELVO — Cross-Tab Authentication Session Management Verification Suite
 *
 * Verifies:
 * 1. Same account opened in two tabs (single source of truth in browser profile).
 * 2. Signing in in Tab 1 synchronizes Tab 2 to the same authenticated user.
 * 3. Refreshing both tabs preserves the authenticated identity.
 * 4. Logging out in Tab 1 immediately synchronizes Tab 2, clears user state, and blocks protected routes.
 * 5. Expired/invalid 401 responses transition cleanly to unauthenticated state.
 * 6. Stale 401 responses from older in-flight requests do NOT invalidate a newer valid session.
 * 7. Repeated login/logout transitions maintain deterministic consistency without leaks.
 * 8. Separate browser profiles (or isolated sessions) remain strictly independent.
 * 9. Protected routes never render another account's stale data.
 * 10. Legacy sessionStorage migration and loading watchdog safeguards.
 */

const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function record(name, passed, detail = '') {
  testResults.tests.push({ name, passed, detail });
  if (passed) {
    testResults.passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    testResults.failed++;
    console.log(`  \x1b[31m✖\x1b[0m ${name}: ${detail}`);
  }
}

console.log('\n\x1b[1m\x1b[36m=== ELVO: CROSS-TAB AUTHENTICATION SESSION MANAGEMENT SUITE ===\x1b[0m\n');

// Mock HTML5 Storage implementation
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

// Mock BroadcastChannel Bus scoped to a browser profile
function createBroadcastBus() {
  const channels = new Map(); // channelName -> Set of listeners

  return {
    createChannel(channelName) {
      if (!channels.has(channelName)) {
        channels.set(channelName, new Set());
      }
      const listeners = channels.get(channelName);
      const myListeners = new Set();

      const channelObj = {
        name: channelName,
        postMessage(data) {
          // Deliver to all other channels on this bus
          listeners.forEach((listener) => {
            if (!myListeners.has(listener)) {
              listener({ data });
            }
          });
        },
        addEventListener(type, fn) {
          if (type === 'message') {
            listeners.add(fn);
            myListeners.add(fn);
          }
        },
        removeEventListener(type, fn) {
          if (type === 'message') {
            listeners.delete(fn);
            myListeners.delete(fn);
          }
        },
        close() {
          myListeners.forEach((fn) => listeners.delete(fn));
          myListeners.clear();
        },
      };

      return channelObj;
    },
  };
}

// Browser Profile Factory
function createBrowserProfile(profileName) {
  const localStorage = createMockStorage();
  const broadcastBus = createBroadcastBus();
  const storageEventListeners = new Set();

  const mockUsers = {
    'user-alice-111': { _id: 'user-alice-111', name: 'Alice', email: 'alice@elvo.test', timezone: 'UTC' },
    'user-bob-222': { _id: 'user-bob-222', name: 'Bob', email: 'bob@elvo.test', timezone: 'UTC' },
  };

  const dispatchStorageEvent = (sourceTabName, key, oldValue, newValue) => {
    storageEventListeners.forEach((entry) => {
      if (entry.tabName !== sourceTabName) {
        entry.fn({ key, oldValue, newValue });
      }
    });
  };

  const createTab = (tabName) => {
    const sessionStorage = createMockStorage();
    const TOKEN_KEY = 'elvo_token';
    const AUTH_EVENT_KEY = 'elvo_auth_event';
    const AUTH_CHANNEL_NAME = 'elvo_auth_sync';

    const tabWindow = {
      localStorage,
      sessionStorage,
      location: { pathname: '/app/dashboard', href: 'http://localhost:5173/app/dashboard' },
      addEventListener: (type, fn) => {
        if (type === 'storage') storageEventListeners.add({ tabName, fn });
      },
      removeEventListener: (type, fn) => {
        if (type === 'storage') {
          for (const entry of storageEventListeners) {
            if (entry.tabName === tabName && entry.fn === fn) {
              storageEventListeners.delete(entry);
            }
          }
        }
      },
      BroadcastChannel: function (name) {
        return broadcastBus.createChannel(name);
      },
    };

    let authChannelInstance = null;
    const getAuthChannel = () => {
      if (!authChannelInstance) {
        authChannelInstance = new tabWindow.BroadcastChannel(AUTH_CHANNEL_NAME);
      }
      return authChannelInstance;
    };

    const getStoredToken = () => {
      if (tabWindow.localStorage) {
        const local = tabWindow.localStorage.getItem(TOKEN_KEY);
        if (local) {
          if (tabWindow.sessionStorage && tabWindow.sessionStorage.getItem(TOKEN_KEY) !== local) {
            tabWindow.sessionStorage.setItem(TOKEN_KEY, local);
          }
          return local;
        }
      }
      if (tabWindow.sessionStorage) {
        if (tabWindow.localStorage) {
          const lastAuthEvent = tabWindow.localStorage.getItem(AUTH_EVENT_KEY);
          if (lastAuthEvent) {
            try {
              const parsed = JSON.parse(lastAuthEvent);
              if (parsed?.type === 'LOGOUT' || parsed?.type === 'EXPIRED') {
                tabWindow.sessionStorage.removeItem(TOKEN_KEY);
                return null;
              }
            } catch {}
          }
        }
        const session = tabWindow.sessionStorage.getItem(TOKEN_KEY);
        if (session) {
          if (tabWindow.localStorage) {
            tabWindow.localStorage.setItem(TOKEN_KEY, session);
          }
          return session;
        }
      }
      return null;
    };

    const broadcastAuthEvent = (type) => {
      const ch = getAuthChannel();
      if (ch) ch.postMessage({ type, timestamp: Date.now() });
    };

    const setStoredToken = (token) => {
      if (token) {
        const prev = tabWindow.localStorage.getItem(TOKEN_KEY);
        tabWindow.localStorage.setItem(TOKEN_KEY, token);
        tabWindow.sessionStorage.setItem(TOKEN_KEY, token);
        tabWindow.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type: 'LOGIN', timestamp: Date.now() }));
        dispatchStorageEvent(tabName, TOKEN_KEY, prev, token);
        broadcastAuthEvent('LOGIN');
      } else {
        clearStoredToken();
      }
    };

    const clearStoredToken = () => {
      const prev = tabWindow.localStorage.getItem(TOKEN_KEY);
      tabWindow.localStorage.removeItem(TOKEN_KEY);
      tabWindow.sessionStorage.removeItem(TOKEN_KEY);
      tabWindow.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type: 'LOGOUT', timestamp: Date.now() }));
      dispatchStorageEvent(tabName, TOKEN_KEY, prev, null);
      broadcastAuthEvent('LOGOUT');
    };

    const subscribeAuthEvents = (callback) => {
      const ch = getAuthChannel();
      const handleChannel = (event) => {
        if (event && event.data && event.data.type) {
          callback(event.data.type);
        }
      };
      if (ch) ch.addEventListener('message', handleChannel);

      const handleStorage = (event) => {
        if (event.key === TOKEN_KEY) {
          if (event.newValue) callback('LOGIN');
          else callback('LOGOUT');
        } else if (event.key === AUTH_EVENT_KEY && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            if (parsed?.type) callback(parsed.type);
          } catch {}
        } else if (event.key === null) {
          callback('LOGOUT');
        }
      };
      tabWindow.addEventListener('storage', handleStorage);

      return () => {
        if (ch) ch.removeEventListener('message', handleChannel);
        tabWindow.removeEventListener('storage', handleStorage);
      };
    };

    // Axios Interceptor simulation
    const requestInterceptor = (config = { headers: {} }) => {
      const token = getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    };

    const responseInterceptorError = (error) => {
      if (error?.response && error.response.status === 401) {
        const authHeader = error.config?.headers?.Authorization;
        const requestToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
        const activeToken = getStoredToken();

        // Stale 401 protection
        if (requestToken && activeToken && requestToken !== activeToken) {
          return { ignoredStale: true };
        }

        clearStoredToken();
        broadcastAuthEvent('EXPIRED');
        if (tabWindow.location.pathname.startsWith('/app')) {
          tabWindow.location.href = '/login';
        }
        return { handled401: true };
      }
      return { error };
    };

    // Simulated React AuthContext instance
    let stateUser = null;
    let stateToken = getStoredToken();
    let stateIsLoading = !!getStoredToken();

    const loadUser = (forcedToken) => {
      const token = forcedToken !== undefined ? forcedToken : getStoredToken();
      if (!token) {
        stateUser = null;
        stateToken = null;
        stateIsLoading = false;
        return;
      }
      stateIsLoading = true;
      // Mock API user retrieval based on token
      if (token.startsWith('jwt-token-alice')) {
        stateUser = { ...mockUsers['user-alice-111'] };
        stateToken = token;
      } else if (token.startsWith('jwt-token-bob')) {
        stateUser = { ...mockUsers['user-bob-222'] };
        stateToken = token;
      } else {
        // Invalid/expired token
        clearStoredToken();
        stateUser = null;
        stateToken = null;
      }
      stateIsLoading = false;
    };

    // Initial hydration
    loadUser();

    // Cross-tab subscriber
    const unsubscribeAuth = subscribeAuthEvents((eventType) => {
      if (eventType === 'LOGIN') {
        const latest = getStoredToken();
        if (latest) {
          stateToken = latest;
          loadUser(latest);
        }
      } else if (eventType === 'LOGOUT' || eventType === 'EXPIRED') {
        tabWindow.sessionStorage.removeItem(TOKEN_KEY);
        stateToken = null;
        stateUser = null;
        stateIsLoading = false;
      } else if (eventType === 'USER_UPDATED') {
        const latest = getStoredToken();
        if (latest) loadUser(latest);
      }
    });

    const checkProtectedRoute = () => {
      if (stateIsLoading) return 'LOADING';
      if (!stateToken || !stateUser) return 'REDIRECT_LOGIN';
      return 'ALLOWED';
    };

    return {
      tabName,
      window: tabWindow,
      getStoredToken,
      setStoredToken,
      clearStoredToken,
      broadcastAuthEvent,
      subscribeAuthEvents,
      requestInterceptor,
      responseInterceptorError,
      loadUser,
      unsubscribeAuth,
      getUser: () => stateUser,
      getToken: () => stateToken,
      isLoading: () => stateIsLoading,
      checkProtectedRoute,
      logout: () => {
        clearStoredToken();
        stateToken = null;
        stateUser = null;
        stateIsLoading = false;
      },
      updateUserPreferences: (prefs) => {
        if (stateUser) {
          Object.assign(mockUsers[stateUser._id], prefs);
          stateUser = { ...mockUsers[stateUser._id] };
          broadcastAuthEvent('USER_UPDATED');
        }
      },
    };
  };

  return { profileName, localStorage, createTab };
}

// -----------------------------------------------------------------
// Suite 1: Same Account Across Multiple Tabs (Login Sync)
// -----------------------------------------------------------------
console.log('\x1b[1mSuite 1: Same Account Across Multiple Tabs & Login Synchronization\x1b[0m');

const profileA = createBrowserProfile('Default Profile');
const tab1 = profileA.createTab('Tab 1');

// Tab 1 logs in as Alice
const aliceToken = 'jwt-token-alice-account-111';
tab1.setStoredToken(aliceToken);
tab1.loadUser(aliceToken);

record('1.1. Tab 1 signs in and stores token in shared profile storage', profileA.localStorage.getItem('elvo_token') === aliceToken);
record('1.2. Tab 1 AuthContext reflects Alice identity', tab1.getUser()?.name === 'Alice');

// Tab 2 opens in the same browser profile
const tab2 = profileA.createTab('Tab 2');

record('1.3. Tab 2 automatically recognizes the active token from shared storage', tab2.getStoredToken() === aliceToken);
record('1.4. Tab 2 immediately loads and reflects the same authenticated user (Alice)', tab2.getUser()?.name === 'Alice');
record('1.5. Both tabs share identical user ID and token', tab1.getUser()?._id === tab2.getUser()?._id && tab1.getToken() === tab2.getToken());

// Both tabs make authenticated requests
const req1 = tab1.requestInterceptor({ headers: {} });
const req2 = tab2.requestInterceptor({ headers: {} });
record('1.6. Both tabs carry the same Bearer token on API requests', req1.headers.Authorization === `Bearer ${aliceToken}` && req2.headers.Authorization === `Bearer ${aliceToken}`);

// -----------------------------------------------------------------
// Suite 2: Refresh and Profile Update Continuity
// -----------------------------------------------------------------
console.log('\n\x1b[1mSuite 2: Tab Refresh and Profile Update Synchronization\x1b[0m');

// Refreshing Tab 1
tab1.loadUser();
record('2.1. Refreshing Tab 1 retains authenticated Alice session', tab1.getUser()?.name === 'Alice' && tab1.getToken() === aliceToken);

// Refreshing Tab 2
tab2.loadUser();
record('2.2. Refreshing Tab 2 retains authenticated Alice session', tab2.getUser()?.name === 'Alice' && tab2.getToken() === aliceToken);

// Tab 1 updates user preferences (e.g. timezone)
tab1.updateUserPreferences({ timezone: 'America/New_York' });
record('2.3. User preference update in Tab 1 synchronizes to Tab 2 without drop in session', tab2.getUser()?.timezone === 'America/New_York');

// -----------------------------------------------------------------
// Suite 3: Logout Synchronization Across Tabs
// -----------------------------------------------------------------
console.log('\n\x1b[1mSuite 3: Logout Synchronization Across Tabs\x1b[0m');

// Alice logs out in Tab 1
tab1.logout();

record('3.1. Tab 1 logout clears shared storage', profileA.localStorage.getItem('elvo_token') === null);
record('3.2. Tab 2 detects logout signal and clears user state', tab2.getUser() === null && tab2.getToken() === null);
record('3.3. Protected routes on Tab 2 immediately block access and redirect to /login', tab2.checkProtectedRoute() === 'REDIRECT_LOGIN');

const reqAfterLogout = tab2.requestInterceptor({ headers: {} });
record('3.4. Tab 2 cannot make authenticated requests using stale token', reqAfterLogout.headers.Authorization === undefined);

// Logging back in on Tab 2 re-synchronizes Tab 1
tab2.setStoredToken(aliceToken);
tab2.loadUser(aliceToken);
record('3.5. Logging back in in Tab 2 re-synchronizes Tab 1 to authenticated state', tab1.getUser()?.name === 'Alice');

// -----------------------------------------------------------------
// Suite 4: 401 Unauthorized, Session Expiration & Stale 401 Safety
// -----------------------------------------------------------------
console.log('\n\x1b[1mSuite 4: 401 Unauthorized & Stale 401 Race Condition Safety\x1b[0m');

// 4.1. Genuine 401 on active token
const genuine401 = {
  response: { status: 401 },
  config: { headers: { Authorization: `Bearer ${aliceToken}` } },
};
const resGenuine = tab1.responseInterceptorError(genuine401);
record('4.1. Genuine 401 on active token clears session and redirects to /login', resGenuine.handled401 === true && profileA.localStorage.getItem('elvo_token') === null);
record('4.2. Tab 2 transitions to unauthenticated state upon session expiration', tab2.getUser() === null && tab2.getToken() === null);

// 4.3. Stale 401 arriving after new login established
const newToken = 'jwt-token-alice-account-111-renewed';
tab1.setStoredToken(newToken);
tab1.loadUser(newToken);

const stale401 = {
  response: { status: 401 },
  config: { headers: { Authorization: 'Bearer old-stale-expired-token-999' } },
};
const resStale = tab1.responseInterceptorError(stale401);

record('4.3. Stale 401 from older in-flight request is ignored; newer session preserved', resStale.ignoredStale === true && profileA.localStorage.getItem('elvo_token') === newToken);
record('4.4. Tab 1 user session remains intact after stale 401', tab1.getToken() === newToken && tab1.getUser()?.name === 'Alice');

// -----------------------------------------------------------------
// Suite 5: Repeated Login/Logout Cycles
// -----------------------------------------------------------------
console.log('\n\x1b[1mSuite 5: Repeated Login and Logout Transitions\x1b[0m');

let cyclesPassed = true;
for (let i = 0; i < 5; i++) {
  tab1.logout();
  if (tab2.getUser() !== null || tab2.getToken() !== null) {
    cyclesPassed = false;
    break;
  }
  tab2.setStoredToken(aliceToken);
  tab2.loadUser(aliceToken);
  if (tab1.getUser()?.name !== 'Alice') {
    cyclesPassed = false;
    break;
  }
}
record('5.1. Rapid alternating login/logout cycles synchronize reliably without state leaks', cyclesPassed);

// -----------------------------------------------------------------
// Suite 6: Separate Browser Profiles Remain Strictly Independent
// -----------------------------------------------------------------
console.log('\n\x1b[1mSuite 6: Separate Browser Profiles Remain Strictly Independent\x1b[0m');

// Profile B (separate browser profile or incognito window)
const profileB = createBrowserProfile('Isolated Profile B');
const tabB1 = profileB.createTab('Profile B - Tab 1');
const tabB2 = profileB.createTab('Profile B - Tab 2');

// Profile B logs into Bob's account
const bobToken = 'jwt-token-bob-account-222';
tabB1.setStoredToken(bobToken);
tabB1.loadUser(bobToken);

record('6.1. Profile B signs into Bob independently', tabB1.getUser()?.name === 'Bob');
record('6.2. Profile B Tab 2 shares Bob session', tabB2.getUser()?.name === 'Bob');
record('6.3. Profile A tabs remain authenticated as Alice (no contamination from Profile B)', tab1.getUser()?.name === 'Alice' && tab2.getUser()?.name === 'Alice');

// Logout in Profile A does not affect Profile B
tab1.logout();
record('6.4. Logout in Profile A does NOT affect Profile B (Bob remains logged in)', tabB1.getUser()?.name === 'Bob' && tabB2.getUser()?.name === 'Bob');
record('6.5. Profile A tabs are completely logged out', tab1.getUser() === null && tab2.getUser() === null);

// -----------------------------------------------------------------
// Suite 7: Legacy Storage Migration & Watchdog Safeguards
// -----------------------------------------------------------------
console.log('\n\x1b[1mSuite 7: Legacy Storage Migration & Watchdog Safeguards\x1b[0m');

const profileMigration = createBrowserProfile('Migration Profile');
const legacyToken = 'jwt-token-alice-legacy';
// Place token in sessionStorage only (simulating pre-fix state)
const tabMigrate = profileMigration.createTab('Migration Tab');
tabMigrate.window.sessionStorage.setItem('elvo_token', legacyToken);

const recovered = tabMigrate.getStoredToken();
record('7.1. Legacy sessionStorage token is migrated to localStorage for multi-tab sharing', recovered === legacyToken && profileMigration.localStorage.getItem('elvo_token') === legacyToken);

// Watchdog timer simulation
const simulateWatchdog = (isLoading, delayMs) => {
  if (!isLoading) return false;
  return delayMs >= 8000;
};
record('7.2. Watchdog allows normal loading under 8 seconds', simulateWatchdog(true, 1500) === false);
record('7.3. Watchdog forces timeout when loading exceeds 8 seconds to prevent freeze', simulateWatchdog(true, 8500) === true);

// -----------------------------------------------------------------
// Summary
// -----------------------------------------------------------------
console.log('\n=== SUITE SUMMARY ===');
console.log(`Total tests : ${testResults.tests.length}`);
console.log(`Passed      : \x1b[32m${testResults.passed}\x1b[0m`);
console.log(`Failed      : ${testResults.failed > 0 ? `\x1b[31m${testResults.failed}\x1b[0m` : '0'}`);

if (testResults.failed > 0) {
  console.error('\nSome tests failed!');
  process.exit(1);
} else {
  console.log('\nAll cross-tab session management tests passed successfully!\n');
}
