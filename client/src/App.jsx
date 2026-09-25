import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { WorkspaceProvider } from './context/WorkspaceContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { TaskProvider } from './context/TaskContext.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { TasksPage } from './pages/TasksPage.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { WorkspacesPage } from './pages/WorkspacesPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

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
              <BrowserRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Protected App Routes with AppShell layout */}
                  <Route path="/app" element={<AppLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="workspaces" element={<WorkspacesPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </BrowserRouter>
            </TaskProvider>
          </NotificationProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

