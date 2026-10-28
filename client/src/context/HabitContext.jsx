import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import habitService from '../services/habitService.js';
import { useAuth } from './AuthContext.jsx';
import { toISODate } from '../utils/dateUtils.js';

const HabitContext = createContext(null);

export const HabitProvider = ({ children }) => {
  const { user } = useAuth();

  const [habits, setHabits] = useState([]);
  const [archivedHabits, setArchivedHabits] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [dailyOverview, setDailyOverview] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth() + 1; // 1-12

  // Refresh all habit data for the active view
  const refreshHabits = useCallback(async () => {
    if (!user) {
      setHabits([]);
      setArchivedHabits([]);
      setDailyOverview(null);
      setMatrixData(null);
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [habitsRes, archivedRes, matrixRes, dailyRes, statsRes] = await Promise.all([
        habitService.getHabits({ includeArchived: false }),
        habitService.getHabits({ includeArchived: true }),
        habitService.getMonthMatrix(currentYear, currentMonth),
        habitService.getDailyOverview(selectedDate),
        habitService.getHabitStats(),
      ]);

      if (habitsRes.success) setHabits(habitsRes.data || []);
      if (archivedRes.success) {
        setArchivedHabits((archivedRes.data || []).filter((h) => h.isArchived));
      }
      if (matrixRes.success) setMatrixData(matrixRes.data);
      if (dailyRes.success) setDailyOverview(dailyRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load habit data:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, [user, currentYear, currentMonth, selectedDate]);

  // Initial and reactive load on user or month or date change
  useEffect(() => {
    refreshHabits();
  }, [refreshHabits]);

  // Navigate to previous month
  const goToPrevMonth = useCallback(() => {
    setCurrentMonthDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  // Navigate to next month
  const goToNextMonth = useCallback(() => {
    setCurrentMonthDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  // Go to today
  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedDate(toISODate(today));
  }, []);

  // Create habit
  const createHabit = async (habitData) => {
    try {
      const res = await habitService.createHabit(habitData);
      if (res.success && res.data) {
        await refreshHabits();
        return res.data;
      }
    } catch (err) {
      throw err;
    }
  };

  // Update habit
  const updateHabit = async (id, habitData) => {
    try {
      const res = await habitService.updateHabit(id, habitData);
      if (res.success && res.data) {
        await refreshHabits();
        return res.data;
      }
    } catch (err) {
      throw err;
    }
  };

  // Archive habit
  const archiveHabit = async (id) => {
    try {
      const res = await habitService.archiveHabit(id);
      if (res.success) {
        await refreshHabits();
      }
    } catch (err) {
      throw err;
    }
  };

  // Restore habit
  const restoreHabit = async (id) => {
    try {
      const res = await habitService.restoreHabit(id);
      if (res.success) {
        await refreshHabits();
      }
    } catch (err) {
      throw err;
    }
  };

  // Permanently delete habit
  const deleteHabit = async (id) => {
    try {
      const res = await habitService.deleteHabit(id);
      if (res.success) {
        await refreshHabits();
      }
    } catch (err) {
      throw err;
    }
  };

  // Reorder habits
  const reorderHabits = async (habitIds) => {
    try {
      // Optimistically reorder local state
      setHabits((prev) => {
        const map = new Map(prev.map((h) => [h._id, h]));
        return habitIds.map((id) => map.get(id)).filter(Boolean);
      });
      await habitService.reorderHabits(habitIds);
    } catch (err) {
      await refreshHabits();
      throw err;
    }
  };

  // Toggle habit completion with optimistic update and rollback
  const toggleHabit = async (habitId, dateStr = selectedDate) => {
    const todayStr = toISODate(new Date());
    if (dateStr > todayStr) {
      throw new Error('Cannot log habit completion for future dates');
    }

    // Save snapshot for rollback
    const prevDaily = dailyOverview;
    const prevMatrix = matrixData;

    const targetDate = dateStr;

    // Optimistic Daily update
    if (dailyOverview && dailyOverview.date === targetDate) {
      const updatedHabits = dailyOverview.habits.map((h) => {
        if (h._id === habitId) {
          return { ...h, isCompleted: !h.isCompleted };
        }
        return h;
      });
      const newDone = updatedHabits.filter((h) => h.isCompleted).length;
      setDailyOverview({
        ...dailyOverview,
        completedCount: newDone,
        completionPercentage: dailyOverview.totalScheduled > 0
          ? Math.round((newDone / dailyOverview.totalScheduled) * 100)
          : 0,
        habits: updatedHabits,
      });
    }

    // Optimistic Matrix update
    if (matrixData && matrixData.habits) {
      const updatedMatrixHabits = matrixData.habits.map((h) => {
        if (h._id === habitId) {
          const currentStatus = h.statuses[targetDate] || {};
          const nextCompleted = !currentStatus.isCompleted;
          return {
            ...h,
            statuses: {
              ...h.statuses,
              [targetDate]: {
                ...currentStatus,
                isCompleted: nextCompleted,
              },
            },
          };
        }
        return h;
      });
      setMatrixData({
        ...matrixData,
        habits: updatedMatrixHabits,
      });
    }

    try {
      const res = await habitService.toggleCompletion(habitId, targetDate);
      if (res.success) {
        // Sync fresh stats in background without flickering
        const [dailyRes, matrixRes, statsRes] = await Promise.all([
          habitService.getDailyOverview(targetDate),
          habitService.getMonthMatrix(currentYear, currentMonth),
          habitService.getHabitStats(),
        ]);
        if (dailyRes.success) setDailyOverview(dailyRes.data);
        if (matrixRes.success) setMatrixData(matrixRes.data);
        if (statsRes.success) setStats(statsRes.data);
      }
    } catch (err) {
      // Rollback on failure
      setDailyOverview(prevDaily);
      setMatrixData(prevMatrix);
      console.error('Failed to toggle habit completion:', err);
      throw err;
    }
  };

  const value = {
    habits,
    archivedHabits,
    selectedDate,
    setSelectedDate,
    currentMonthDate,
    currentYear,
    currentMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    dailyOverview,
    matrixData,
    stats,
    loading,
    error,
    refreshHabits,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    deleteHabit,
    reorderHabits,
    toggleHabit,
  };

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>;
};

export const useHabits = () => {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error('useHabits must be used within a HabitProvider');
  }
  return context;
};
