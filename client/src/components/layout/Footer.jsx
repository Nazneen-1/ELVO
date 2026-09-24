import React from 'react';
import { Calendar } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="border-t border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">CalFlow</span>
          <span className="text-xs text-slate-400 dark:text-zinc-500">© {new Date().getFullYear()}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-500 text-center sm:text-right">
          Calendar-first task management built for focus and simplicity.
        </p>
      </div>
    </footer>
  );
};
