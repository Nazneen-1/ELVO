import React from 'react';
import { clsx } from 'clsx';

/**
 * ELVO Animated Streak Fire Icon
 * Lightweight SVG-based subtle flame animation fitting the ELVO visual language.
 * Compact, restrained, respects prefers-reduced-motion, causes zero layout shift.
 */
export const StreakFireIcon = ({ size = 14, className }) => {
  return (
    <span
      className={clsx('inline-flex items-center justify-center shrink-0 animate-flame select-none', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="elvo-flame-outer" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="60%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="elvo-flame-inner" x1="12" y1="10" x2="12" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Outer Flame */}
        <path
          d="M12 2C10.5 4.5 8 8 8 11.5C8 14.5 10 16 10 18C10 19.5 8.8 20.5 7.5 20.5C6.2 20.5 5 19.2 5 17.5C5 13.5 8.5 9 8.5 9C5 10.5 3 13.8 3 17C3 20.5 6 22 8.5 22C14.5 22 19 18 19 13C19 8.5 15.5 5.5 14 3.5C13.5 5 12.8 6.5 11.8 7.5C11.5 6 11.8 4 12 2Z"
          fill="url(#elvo-flame-outer)"
        />

        {/* Inner Flame Core */}
        <path
          d="M12 12C11 13.5 10 15 10 16.8C10 18.5 11 19.8 12.5 19.8C14 19.8 15 18.5 15 16.5C15 14.5 13.5 13 12 12Z"
          fill="url(#elvo-flame-inner)"
          className="opacity-90"
        />
      </svg>
    </span>
  );
};

export default StreakFireIcon;

