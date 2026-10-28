import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Safety watchdog: ensure loading state never hangs indefinitely on network stalls
  useEffect(() => {
    if (!isLoading) {
      setHasTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 8000); // 8 second timeout threshold

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading && !hasTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#1A1A1A] text-elvo-noir dark:text-white transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 border-3 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="text-sm font-semibold tracking-wide text-elvo-noir dark:text-white">ELVO</p>
            <p className="text-xs text-elvo-fog mt-0.5">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

