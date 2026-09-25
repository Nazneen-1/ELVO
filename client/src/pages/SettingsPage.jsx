import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useTasks } from '../context/TaskContext.jsx';
import { userService } from '../services/userService.js';
import { Button } from '../components/common/Button.jsx';
import {
  User,
  Moon,
  Sun,
  Calendar,
  Download,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';

export const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { tasks } = useTasks();

  const [name, setName] = useState(user?.name || '');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(user?.preferences?.firstDayOfWeek ?? 0);
  const [defaultView, setDefaultView] = useState('calendar');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await userService.updateUserProfile({
        name,
        preferences: {
          firstDayOfWeek,
          theme,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    const backup = {
      exportDate: new Date().toISOString(),
      user: { name: user?.name, email: user?.email },
      taskCount: tasks.length,
      tasks,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elvo-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-full">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/elvo-app-bg.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-80 dark:opacity-30 mix-blend-multiply dark:mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/60 to-[#F5F5F5] dark:from-[#1A1A1A]/90 dark:via-[#1A1A1A]/95 dark:to-[#1A1A1A]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-8 lg:px-10 py-10 sm:py-14 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#565656] dark:text-[#848484] mb-2 uppercase">
              SETTINGS
            </p>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-[#2B2B2B] dark:text-white leading-none mb-3">
              Settings & Preferences
            </h1>
            <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">
              Customize your profile, workflow preferences, and application theme.
            </p>
          </div>

          <div className="hidden md:block">
            <p className="text-xs font-medium tracking-[0.2em] text-[#565656] dark:text-[#848484] uppercase leading-relaxed text-right border-l border-[#565656]/30 pl-4">
              A space<br />
              that works<br />
              like you.
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-emerald-500/30 text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 shadow-sm">
            <Check className="w-5 h-5" /> Preferences saved successfully!
          </div>
        )}

        {/* Profile Section */}
        <div className="p-6 sm:p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo relative overflow-hidden group">
          <div className="flex items-start gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-full shrink-0 border border-white/60 dark:border-white/10 overflow-hidden shadow-sm">
              <img src="/elvo-avatar.png" alt="Profile" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2B2B2B] dark:text-white">Profile Information</h2>
              <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">Manage your personal information.</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#565656] dark:text-[#848484]">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#565656] dark:text-[#848484]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-[#3A3A3A] text-sm text-[#2B2B2B] dark:text-white placeholder-[#848484] focus:outline-none focus:border-[#565656] transition-colors"
                />
              </div>
            </div>

            <div className="md:col-span-5 space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#565656] dark:text-[#848484]">
                Email Address
              </label>
              <div className="relative">
                <div className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#565656] dark:text-[#848484] flex items-center justify-center">@</div>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/20 dark:bg-black/10 border border-white/40 dark:border-[#3A3A3A]/50 text-sm text-[#848484] dark:text-[#565656] cursor-not-allowed"
                />
              </div>
              <span className="text-[10px] text-[#565656] dark:text-[#565656] block ml-1">
                Email cannot be changed directly for security reasons.
              </span>
            </div>

            <div className="md:col-span-3 flex items-start md:items-center justify-end mt-4 md:mt-0 pt-3">
              <Button type="submit" variant="primary" size="md" isLoading={isSaving} className="w-full md:w-auto rounded-xl shadow-lg">
                Save Profile Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Appearance & Theme */}
        <div className="p-6 sm:p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0 border border-white/60 dark:border-white/10">
              <Sun className="w-5 h-5 text-[#2B2B2B] dark:text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2B2B2B] dark:text-white">Interface Theme</h2>
              <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">Choose your preferred appearance.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { if (theme === 'dark') toggleTheme(); }}
              className={clsx(
                'p-5 rounded-2xl border flex items-center justify-between transition-all group',
                theme === 'light'
                  ? 'border-[#2B2B2B] bg-white/60 shadow-md'
                  : 'border-transparent bg-white/20 dark:bg-black/20 hover:bg-white/40 dark:hover:bg-black/40'
              )}
            >
              <div className="flex items-center gap-4">
                <Sun className={clsx("w-6 h-6", theme === 'light' ? 'text-amber-500' : 'text-[#848484] dark:text-[#565656]')} />
                <div className="text-left">
                  <p className={clsx("text-sm font-bold", theme === 'light' ? 'text-[#2B2B2B]' : 'text-[#565656] dark:text-[#848484]')}>Light Mode</p>
                  <p className="text-xs text-[#848484] mt-0.5">Crisp, high contrast</p>
                </div>
              </div>
              <div className={clsx(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                theme === 'light' ? "border-[#2B2B2B]" : "border-[#B3B3B3] dark:border-[#565656]"
              )}>
                {theme === 'light' && <div className="w-2.5 h-2.5 rounded-full bg-[#2B2B2B]" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => { if (theme === 'light') toggleTheme(); }}
              className={clsx(
                'p-5 rounded-2xl border flex items-center justify-between transition-all group',
                theme === 'dark'
                  ? 'border-indigo-500 bg-[#1A1A1A]/80 shadow-md ring-1 ring-indigo-500/50'
                  : 'border-transparent bg-white/20 dark:bg-black/20 hover:bg-white/40 dark:hover:bg-black/40'
              )}
            >
              <div className="flex items-center gap-4">
                <Moon className={clsx("w-6 h-6", theme === 'dark' ? 'text-indigo-400' : 'text-[#848484] dark:text-[#565656]')} />
                <div className="text-left">
                  <p className={clsx("text-sm font-bold", theme === 'dark' ? 'text-white' : 'text-[#565656] dark:text-[#848484]')}>Dark Mode</p>
                  <p className="text-xs text-[#848484] mt-0.5">Sleek, low light comfort</p>
                </div>
              </div>
              <div className={clsx(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                theme === 'dark' ? "border-indigo-400" : "border-[#B3B3B3] dark:border-[#565656]"
              )}>
                {theme === 'dark' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />}
              </div>
            </button>
          </div>
        </div>

        {/* Calendar & Scheduling */}
        <div className="p-6 sm:p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0 border border-white/60 dark:border-white/10">
              <Calendar className="w-5 h-5 text-[#2B2B2B] dark:text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2B2B2B] dark:text-white">Calendar & Scheduling</h2>
              <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">Set your calendar preferences.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#565656] dark:text-[#848484]">
                Start Week On
              </label>
              <select
                value={firstDayOfWeek}
                onChange={(e) => setFirstDayOfWeek(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-[#3A3A3A] text-sm text-[#2B2B2B] dark:text-white focus:outline-none focus:border-[#565656] transition-colors appearance-none"
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#565656] dark:text-[#848484]">
                Default Landing View
              </label>
              <select
                value={defaultView}
                onChange={(e) => setDefaultView(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-[#3A3A3A] text-sm text-[#2B2B2B] dark:text-white focus:outline-none focus:border-[#565656] transition-colors appearance-none"
              >
                <option value="dashboard">Dashboard Overview</option>
                <option value="calendar">Month Calendar</option>
                <option value="tasks">Tasks & Kanban</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Export & Backup */}
        <div className="p-6 sm:p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0 border border-white/60 dark:border-white/10">
              <Download className="w-5 h-5 text-[#2B2B2B] dark:text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2B2B2B] dark:text-white">Data Export & Backup</h2>
              <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-1 max-w-sm">
                Export all your tasks, notes, checklists, and calendar schedule to JSON format.
              </p>
            </div>
          </div>

          <Button variant="outline" size="md" onClick={handleExportData} className="w-full sm:w-auto rounded-xl bg-white/20 dark:bg-black/20 backdrop-blur-md hover:bg-white/60 dark:hover:bg-white/10">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>
    </div>
  );
};
