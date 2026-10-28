import React from 'react';
import { clsx } from 'clsx';

export const CircularProgressRing = ({
  percentage = 0,
  size = 110,
  strokeWidth = 9,
  label = 'Completed',
  sublabel = null,
  color = '#6366F1',
}) => {
  const safePercentage = Math.min(Math.max(Math.round(percentage || 0), 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background Track (360 degrees) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-zinc-800"
          />

          {/* Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center Percentage Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
            {safePercentage}%
          </span>
          {sublabel && (
            <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
      </div>

      {label && (
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            {label}
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-zinc-300 mt-0.5">
            {safePercentage >= 100
              ? 'All habits completed! 🎉'
              : safePercentage >= 50
              ? 'Over halfway there'
              : safePercentage > 0
              ? 'Good start today'
              : 'No completions yet'}
          </span>
        </div>
      )}
    </div>
  );
};
