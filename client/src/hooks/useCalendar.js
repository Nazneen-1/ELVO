import { useState, useMemo, useCallback } from 'react';
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  format,
  getCalendarMatrix,
  getWeekDays,
  formatViewLabel,
  toISODate,
} from '../utils/dateUtils.js';

export const useCalendar = (initialDate = new Date(), weekStartsOn = 0, initialView = 'month') => {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState(initialView); // 'month' | 'week' | 'day'

  // Step forward depending on active view mode
  const next = useCallback(() => {
    setCurrentDate((prev) => {
      let nextDate;
      if (viewMode === 'day') {
        nextDate = addDays(prev, 1);
        setSelectedDate(nextDate);
      } else if (viewMode === 'week') {
        nextDate = addWeeks(prev, 1);
        // If current selectedDate is outside the new week, shift it
        setSelectedDate((sel) => addWeeks(sel, 1));
      } else {
        nextDate = addMonths(prev, 1);
      }
      return nextDate;
    });
  }, [viewMode]);

  // Step backward depending on active view mode
  const prev = useCallback(() => {
    setCurrentDate((prev) => {
      let prevDate;
      if (viewMode === 'day') {
        prevDate = subDays(prev, 1);
        setSelectedDate(prevDate);
      } else if (viewMode === 'week') {
        prevDate = subWeeks(prev, 1);
        setSelectedDate((sel) => subWeeks(sel, 1));
      } else {
        prevDate = subMonths(prev, 1);
      }
      return prevDate;
    });
  }, [viewMode]);

  // Jump to Today
  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  // Explicitly select a date (also synchronizes currentDate if in day view)
  const selectDate = useCallback((date) => {
    setSelectedDate(date);
    if (viewMode === 'day') {
      setCurrentDate(date);
    }
  }, [viewMode]);

  // Change view mode and synchronize date state if needed
  const changeViewMode = useCallback((newMode) => {
    setViewMode(newMode);
    if (newMode === 'day') {
      setCurrentDate(selectedDate);
    }
  }, [selectedDate]);

  // Month grid 35/42 slots
  const daysMatrix = useMemo(() => {
    return getCalendarMatrix(currentDate, weekStartsOn);
  }, [currentDate, weekStartsOn]);

  // Week view 7-day columns
  const weekDays = useMemo(() => {
    return getWeekDays(currentDate, weekStartsOn);
  }, [currentDate, weekStartsOn]);

  // Dynamic header label depending on view mode
  const viewLabel = useMemo(() => {
    return formatViewLabel(currentDate, viewMode, weekStartsOn);
  }, [currentDate, viewMode, weekStartsOn]);

  // Backward-compatible month-only label
  const monthLabel = useMemo(() => {
    return format(currentDate, 'MMMM yyyy');
  }, [currentDate]);

  return {
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate: selectDate,
    viewMode,
    setViewMode: changeViewMode,
    daysMatrix,
    weekDays,
    viewLabel,
    monthLabel,
    next,
    prev,
    nextMonth: next,
    prevMonth: prev,
    goToToday,
    selectedDateISO: toISODate(selectedDate),
  };
};
