import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { NotificationPopover } from '../notifications/NotificationPopover.jsx';
import {
  Calendar,
  CheckSquare,
  LayoutDashboard,
  TrendingUp,
  Users,
  Settings,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Briefcase,
  Sparkles,
  FileText,
  Target
} from 'lucide-react';
import { clsx } from 'clsx';

const ElvoLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#1C1C1C"/>
    <path d="M68 24 C52 18 30 22 24 38 C20 48 26 55 30 57" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
    <path d="M30 56 C42 50 56 55 68 62" stroke="#D8D8D8" strokeWidth="5.5" strokeLinecap="round"/>
    <path d="M30 60 C24 68 20 76 28 84 C36 92 52 86 68 80" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
  </svg>
);

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/app/calendar', label: 'Calendar', icon: Calendar },
  { to: '/app/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/app/focus', label: 'Focus', icon: Target },
  { to: '/app/workspaces', label: 'Projects', icon: Briefcase },
  { to: '/app/notes', label: 'Notes', icon: FileText },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const SidebarLink = ({ to, label, icon: Icon, collapsed }) => (
  <NavLink
    to={to}
    end
    className={({ isActive }) =>
      clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
        isActive
          ? 'bg-elvo-cloud/80 dark:bg-[#3A3A3A] text-elvo-noir dark:text-white font-semibold shadow-sm'
          : 'text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5 hover:text-elvo-noir dark:hover:text-white'
      )
    }
  >
    <Icon className="w-[18px] h-[18px] shrink-0" />
    {!collapsed && <span>{label}</span>}
  </NavLink>
);

export const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className="min-h-screen flex bg-elvo-white dark:bg-[#1A1A1A] transition-colors font-sans">
      {/* ───── Desktop Sidebar ───── */}
      <aside
        className={clsx(
          'hidden md:flex flex-col border-r border-[#E0E0E0] dark:border-[#3A3A3A] bg-[#F5F5F5] dark:bg-[#2B2B2B] transition-all duration-200 shrink-0',
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* Brand */}
        <div className="h-20 flex items-center justify-between px-5">
          {!sidebarCollapsed && (
            <NavLink to="/app/dashboard" className="flex items-center gap-2.5">
              <ElvoLogo size={28} />
              <span className="text-lg font-bold tracking-tight text-elvo-noir dark:text-white mt-0.5">
                ELVO
              </span>
            </NavLink>
          )}
          {sidebarCollapsed && (
            <div className="mx-auto">
              <ElvoLogo size={28} />
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg text-elvo-fog hover:text-elvo-noir dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Workspace Quick Indicator */}
        {!sidebarCollapsed && (
          <div className="px-4 pt-1 pb-3">
            <NavLink
              to="/app/workspaces"
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-[#3A3A3A] hover:border-elvo-silver dark:hover:border-elvo-fog transition-colors shadow-subtle"
            >
              <div className="flex items-center gap-2 min-w-0">
                {activeWorkspaceId === 'personal' ? (
                  <Sparkles className="w-3.5 h-3.5 text-elvo-iron dark:text-elvo-silver shrink-0" />
                ) : (
                  <Briefcase className="w-3.5 h-3.5 text-elvo-iron dark:text-elvo-silver shrink-0" />
                )}
                <span className="text-xs font-semibold text-elvo-noir dark:text-white truncate">
                  {activeWorkspaceId === 'personal' ? 'Personal Space' : activeWorkspace?.name || 'Workspace'}
                </span>
              </div>
            </NavLink>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-full flex items-center justify-center p-2.5 rounded-xl text-elvo-fog hover:text-elvo-noir dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors mb-2"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>
          )}
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} {...item} collapsed={sidebarCollapsed} />
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="px-3 py-4 border-t border-[#E0E0E0] dark:border-[#3A3A3A] space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5 hover:text-elvo-noir dark:hover:text-white transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-[18px] h-[18px] shrink-0" />
            ) : (
              <Moon className="w-[18px] h-[18px] shrink-0" />
            )}
            {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-elvo-iron dark:text-elvo-silver hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>

          {/* User info */}
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-3 py-2 mt-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-[#3A3A3A]">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src="/elvo-avatar.png" alt="Profile" className="w-7 h-7 rounded-full shrink-0 object-cover border border-[#E0E0E0] dark:border-[#3A3A3A]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-elvo-noir dark:text-white truncate">
                    {user?.name || 'User'}
                  </p>
                </div>
              </div>
              <NotificationPopover />
            </div>
          )}
        </div>
      </aside>

      {/* ───── Mobile Overlay Menu ───── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-[#2B2B2B] border-r border-[#E0E0E0] dark:border-[#3A3A3A] flex flex-col animate-slide-in-left">
            <div className="h-16 flex items-center justify-between px-4 border-b border-[#E0E0E0] dark:border-[#3A3A3A]">
              <div className="flex items-center gap-2.5">
                <ElvoLogo size={28} />
                <span className="text-lg font-bold tracking-tight text-elvo-noir dark:text-white">
                  ELVO
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-elvo-fog hover:text-elvo-noir dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive
                        ? 'bg-elvo-cloud/80 dark:bg-[#3A3A3A] text-elvo-noir dark:text-white font-semibold'
                        : 'text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5 hover:text-elvo-noir dark:hover:text-white'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="px-3 py-4 border-t border-[#E0E0E0] dark:border-[#3A3A3A] space-y-1">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5 hover:text-elvo-noir dark:hover:text-white transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-elvo-iron dark:text-elvo-silver hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── Main Content Area ───── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F5F5F5] dark:bg-[#1A1A1A]">
        {/* Top Header Bar for Desktop (Collapsed) & Mobile */}
        {(sidebarCollapsed || true) && ( // Always show a minimal header for mobile, conditional for desktop
           <header className={clsx(
             "sticky top-0 z-30 h-14 flex items-center justify-between px-4 sm:px-6 border-b border-[#E0E0E0] dark:border-[#3A3A3A] bg-white/90 dark:bg-[#2B2B2B]/90 backdrop-blur-md",
             !sidebarCollapsed && "md:hidden" // Hide on desktop if sidebar is open, keep clean look
           )}>
             {/* Mobile menu button / Logo */}
             <div className="flex items-center gap-3 md:hidden">
               <button
                 onClick={() => setMobileMenuOpen(true)}
                 className="p-1 -ml-1 rounded-xl text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
               >
                 <Menu className="w-5 h-5" />
               </button>
               <NavLink to="/app/dashboard" className="flex items-center gap-2">
                 <ElvoLogo size={24} />
               </NavLink>
             </div>

             {/* Desktop breadcrumb/context when sidebar collapsed */}
             <div className="hidden md:flex items-center gap-2">
               <span className="text-xs font-semibold text-elvo-fog">
                 Context:
               </span>
               <span className="px-2.5 py-1 rounded-lg bg-elvo-cloud/50 dark:bg-[#3A3A3A] text-xs font-bold text-elvo-noir dark:text-white">
                 {activeWorkspaceId === 'personal' ? 'Personal Space' : activeWorkspace?.name || 'Workspace'}
               </span>
             </div>

             {/* Header Right Actions */}
             <div className="flex items-center gap-3">
               <NotificationPopover />
               <NavLink
                 to="/app/settings"
                 className="w-8 h-8 rounded-full hover:opacity-90 transition-opacity overflow-hidden border border-[#E0E0E0] dark:border-[#3A3A3A]"
                 title="Settings & Profile"
               >
                 <img src="/elvo-avatar.png" alt="Profile" className="w-full h-full object-cover" />
               </NavLink>
             </div>
           </header>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden sticky bottom-0 z-30 flex items-center border-t border-[#E0E0E0] dark:border-[#3A3A3A] bg-white/95 dark:bg-[#2B2B2B]/95 backdrop-blur-md safe-area-pb">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors',
                  isActive
                    ? 'text-elvo-noir dark:text-white font-bold'
                    : 'text-elvo-fog'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
