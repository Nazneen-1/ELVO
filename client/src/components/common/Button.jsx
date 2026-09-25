import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-[#2B2B2B] hover:bg-[#1A1A1A] dark:bg-[#F5F5F5] dark:hover:bg-[#E0E0E0] text-white dark:text-[#2B2B2B] shadow-sm focus:ring-[#848484]',
    secondary: 'bg-[#E0E0E0]/50 dark:bg-[#3A3A3A] text-[#2B2B2B] dark:text-[#F5F5F5] hover:bg-[#E0E0E0] dark:hover:bg-[#4A4A4A] focus:ring-[#848484] border border-[#E0E0E0] dark:border-[#3A3A3A]',
    outline: 'border border-[#B3B3B3] dark:border-[#565656] bg-transparent text-[#2B2B2B] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 focus:ring-[#848484]',
    ghost: 'bg-transparent text-[#565656] dark:text-[#B3B3B3] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#2B2B2B] dark:hover:text-[#F5F5F5] focus:ring-[#848484]',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 shadow-sm shadow-rose-500/20',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
    icon: 'p-2',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};
