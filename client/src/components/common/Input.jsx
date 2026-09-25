import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Input = forwardRef(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2 text-sm rounded-xl transition-all duration-150',
              'bg-white dark:bg-[#1A1A1A]',
              'border border-[#E0E0E0] dark:border-[#3A3A3A]',
              'text-elvo-noir dark:text-white placeholder-elvo-silver dark:placeholder-elvo-iron',
              'focus:outline-none focus:ring-2 focus:ring-elvo-cloud dark:focus:ring-[#4A4A4A] focus:border-elvo-noir dark:focus:border-white',
              'disabled:opacity-50 disabled:bg-[#F5F5F5] dark:disabled:bg-[#2B2B2B]',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500',
              className
            )
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-slate-500 dark:text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
