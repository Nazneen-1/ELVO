import React, { useState, useEffect } from 'react';
import { taskService } from '../services/taskService.js';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  BarChart2,
} from 'lucide-react';
import { clsx } from 'clsx';

export const AnalyticsPage = () => {
  const [timeRange, setTimeRange] = useState(30); // 7, 14, 30 days
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await taskService.getAnalytics({ days: timeRange });
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [timeRange]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-zinc-800 rounded-xl w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-80 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const maxCompletedTrend = Math.max(
    ...data.completionTrend.map((t) => Math.max(t.completed, t.created)),
    1
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Productivity Insights
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Track velocity, completion trends, and personal focus metrics
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm text-xs font-semibold">
          {[
            { label: '7 Days', val: 7 },
            { label: '14 Days', val: 14 },
            { label: '30 Days', val: 30 },
          ].map((r) => (
            <button
              key={r.val}
              onClick={() => setTimeRange(r.val)}
              className={clsx(
                'px-3 py-1.5 rounded-lg transition-all',
                timeRange === r.val
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Completion Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
                {data.completionRate}%
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> on-track
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {data.completed} of {data.total} tasks completed
            </p>
          </div>
        </div>

        {/* Tasks in Flight */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              In Progress
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
              {data.inProgress}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {data.todo} pending in backlog
            </p>
          </div>
        </div>

        {/* Overdue Alert */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Overdue Tasks
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
              {data.overdue}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {data.overdue === 0 ? 'All caught up!' : 'Action recommended'}
            </p>
          </div>
        </div>

        {/* Focus Hours Logged */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Focus Time Est.
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
              {(data.totalEstimatedMinutes / 60).toFixed(1)} <span className="text-sm font-normal text-slate-500">hrs</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Total planned deep focus
            </p>
          </div>
        </div>
      </div>

      {/* Completion Velocity Chart (SVG interactive bars) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Task Completion Velocity
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Daily completed tasks vs newly added tasks
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-indigo-600" />
              <span className="text-slate-600 dark:text-zinc-400">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-slate-300 dark:bg-zinc-700" />
              <span className="text-slate-600 dark:text-zinc-400">Created</span>
            </div>
          </div>
        </div>

        {/* Bar Visualizer */}
        <div className="pt-6 pb-2">
          <div className="flex items-end gap-2 h-48 border-b border-slate-100 dark:border-zinc-800 pb-2">
            {data.completionTrend.map((point, index) => {
              const compHeight = Math.round((point.completed / maxCompletedTrend) * 100);
              const createHeight = Math.round((point.created / maxCompletedTrend) * 100);

              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-12 hidden group-hover:flex flex-col items-center z-20 pointer-events-none bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2 py-1 rounded-md text-[10px] whitespace-nowrap shadow-lg">
                    <span>{point.label}</span>
                    <span>Done: {point.completed} | Added: {point.created}</span>
                  </div>

                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    {/* Created Bar */}
                    <div
                      className="w-full max-w-[10px] bg-slate-200 dark:bg-zinc-700 rounded-t transition-all duration-300 group-hover:opacity-80"
                      style={{ height: `${Math.max(createHeight, 4)}%` }}
                    />
                    {/* Completed Bar */}
                    <div
                      className="w-full max-w-[10px] bg-indigo-600 dark:bg-indigo-500 rounded-t transition-all duration-300 group-hover:bg-indigo-500"
                      style={{ height: `${Math.max(compHeight, 4)}%` }}
                    />
                  </div>
                  {/* Date label */}
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500 truncate max-w-full text-center mt-1">
                    {index % Math.ceil(data.completionTrend.length / 7) === 0 ? point.label : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Breakdown Section: Priority & Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Task Priority Distribution
          </h2>

          <div className="space-y-3 pt-2">
            {[
              {
                label: 'High Priority',
                count: data.priorityBreakdown?.High || 0,
                color: 'bg-rose-500',
                textColor: 'text-rose-600 dark:text-rose-400',
              },
              {
                label: 'Medium Priority',
                count: data.priorityBreakdown?.Medium || 0,
                color: 'bg-amber-500',
                textColor: 'text-amber-600 dark:text-amber-400',
              },
              {
                label: 'Low Priority',
                count: data.priorityBreakdown?.Low || 0,
                color: 'bg-emerald-500',
                textColor: 'text-emerald-600 dark:text-emerald-400',
              },
            ].map((p) => {
              const pct = data.total > 0 ? Math.round((p.count / data.total) * 100) : 0;
              return (
                <div key={p.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-zinc-300">{p.label}</span>
                    <span className={p.textColor}>
                      {p.count} tasks ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full transition-all duration-500', p.color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Tags & Categories */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-subtle space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Top Tags & Focus Areas
          </h2>

          {(!data.tagBreakdown || data.tagBreakdown.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
              No tags attached yet. Add tags like #Work, #Study, or #Personal to tasks to see categories breakdown.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {data.tagBreakdown.map((t) => {
                const maxTagCount = Math.max(...data.tagBreakdown.map((item) => item.count), 1);
                const tagPct = Math.round((t.count / maxTagCount) * 100);
                return (
                  <div key={t.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-indigo-600 dark:text-indigo-400">#{t.name}</span>
                      <span className="text-slate-500 dark:text-zinc-400">{t.count} tasks</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${tagPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
