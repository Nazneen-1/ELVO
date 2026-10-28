import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { WorkspaceProvider } from './context/WorkspaceContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { TaskProvider } from './context/TaskContext.jsx';
import { NoteProvider } from './context/NoteContext.jsx';
import { HabitProvider } from './context/HabitContext.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { TasksPage } from './pages/TasksPage.jsx';
import { NotesPage } from './pages/NotesPage.jsx';
import { HabitTrackerPage } from './pages/HabitTrackerPage.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { WorkspacesPage } from './pages/WorkspacesPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

import { useAuth } from './context/AuthContext.jsx';

function AppIndexRedirect() {
  const { user } = useAuth();
  const validViews = {
    dashboard: '/app/dashboard',
    calendar: '/app/calendar',
    tasks: '/app/tasks',
    notes: '/app/notes',
    habits: '/app/habits',
    focus: '/app/habits',
  };
  const target = validViews[user?.preferences?.defaultLandingView] || '/app/dashboard';
  return <Navigate to={target} replace />;
}

function AppLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <NotificationProvider>
            <TaskProvider>
              <NoteProvider>
                <HabitProvider>
                  <BrowserRouter>
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />

                      {/* Protected App Routes with AppShell layout */}
                      <Route path="/app" element={<AppLayout />}>
                        <Route index element={<AppIndexRedirect />} />
                        <Route path="dashboard" element={<DashboardPage />} />
                        <Route path="calendar" element={<CalendarPage />} />
                        <Route path="tasks" element={<TasksPage />} />
                        <Route path="notes" element={<NotesPage />} />
                        <Route path="habits" element={<HabitTrackerPage />} />
                        {/* Compatibility redirect for Focus */}
                        <Route path="focus" element={<Navigate to="/app/habits" replace />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="workspaces" element={<WorkspacesPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                      </Route>

                      {/* Fallback */}
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </BrowserRouter>
                </HabitProvider>
              </NoteProvider>
            </TaskProvider>
          </NotificationProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

