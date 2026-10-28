import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext.jsx';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Users,
  Clock,
  MessageSquare,
  Sparkles,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';

export const NotificationPopover = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState({});

  // Calculate position dynamically to avoid overflow or clipping
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(380, window.innerWidth - 32);
    const popoverHeight = 420;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = 0;
    let left = 0;

    // Vertical placement: open upwards if near bottom of viewport
    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      top = Math.max(16, rect.top - popoverHeight - 8);
    } else {
      top = Math.min(window.innerHeight - popoverHeight - 16, rect.bottom + 8);
    }

    // Horizontal placement: clamp within viewport
    // Prefer right-aligned to trigger if in header, or to the right if in left sidebar
    if (rect.left < 200) {
      // In sidebar: pop out to the right
      left = Math.min(rect.right + 12, window.innerWidth - popoverWidth - 16);
      if (left < 16) left = 16;
    } else {
      left = rect.right - popoverWidth;
      if (left < 16) left = 16;
    }

    setPopoverStyle({
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${popoverWidth}px`,
      maxHeight: `${Math.min(popoverHeight, window.innerHeight - 32)}px`,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (n) => {
    if (!n.read) {
      markAsRead(n._id);
    }
    setIsOpen(false);

    if (n.relatedTaskId) {
      navigate('/app/tasks');
    } else if (n.relatedWorkspaceId) {
      navigate('/app/workspaces');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'workspace_invite':
        return <Users className="w-4 h-4 text-[#565656] dark:text-[#B3B3B3]" />;
      case 'task_due':
        return <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-[#565656] dark:text-[#B3B3B3]" />;
      case 'task_assigned':
        return <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#565656] dark:text-[#B3B3B3]" />;
    }
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={clsx(
          'relative p-2 rounded-xl transition-colors',
          'text-[#565656] dark:text-[#B3B3B3] hover:text-[#2B2B2B] dark:hover:text-white',
          'hover:bg-black/5 dark:hover:bg-white/5',
          isOpen && 'bg-black/5 dark:bg-white/5 text-[#2B2B2B] dark:text-white'
        )}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2B2B2B] dark:bg-[#E0E0E0] text-[#F5F5F5] dark:text-[#2B2B2B] text-[10px] font-bold flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="rounded-2xl bg-white dark:bg-[#2B2B2B] border border-[#E0E0E0] dark:border-[#3A3A3A] shadow-elvo-lg flex flex-col overflow-hidden animate-scale-in select-none"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E0E0E0] dark:border-[#3A3A3A] flex items-center justify-between bg-[#F5F5F5]/60 dark:bg-[#1A1A1A]/40 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#2B2B2B] dark:text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2B2B2B]/10 dark:bg-white/10 text-[#2B2B2B] dark:text-white">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-[#565656] dark:text-[#B3B3B3] hover:text-[#2B2B2B] dark:hover:text-white flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E0E0E0]/60 dark:divide-[#3A3A3A]/60">
            {isLoading && notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#848484]">
                <Loader2 className="w-5 h-5 animate-spin text-[#565656] dark:text-[#B3B3B3]" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#848484] dark:text-[#B3B3B3] flex flex-col items-center justify-center gap-2">
                <Bell className="w-6 h-6 stroke-1 text-[#848484]/60" />
                <span>No notifications yet.</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={clsx(
                    'p-3.5 flex items-start gap-3 transition-colors cursor-pointer group',
                    n.read
                      ? 'bg-transparent opacity-75 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                      : 'bg-[#E0E0E0]/30 dark:bg-[#3A3A3A]/40 hover:bg-[#E0E0E0]/50 dark:hover:bg-[#3A3A3A]/60'
                  )}
                >
                  <div className="p-2 rounded-xl bg-[#F5F5F5] dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-[#3A3A3A] shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-[#2B2B2B] dark:text-[#E0E0E0] truncate">
                        {n.title}
                      </p>
                      <span className="text-[10px] text-[#848484] dark:text-[#848484] shrink-0">
                        {n.createdAt ? format(parseISO(n.createdAt), 'MMM d, h:mm a') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[#565656] dark:text-[#B3B3B3] mt-0.5 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!n.read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(n._id);
                        }}
                        className="p-1 text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n._id);
                      }}
                      className="p-1 text-[#848484] hover:text-rose-500 transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
