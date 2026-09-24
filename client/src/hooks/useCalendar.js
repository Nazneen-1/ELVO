import { useState, useMemo, useCallback } from 'react';
import {
  addMonths,
  subMonths,
  format,
  getCalendarMatrix,
  toISODate,
} from '../utils/dateUtils.js';

export const useCalendar = (initialDate = new Date(), weekStartsOn = 0) => {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const nextMonth = useCallback(() => {
    setCurrentDate((prev) => addMonths(prev, 1));
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentDate((prev) => subMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  const daysMatrix = useMemo(() => {
    return getCalendarMatrix(currentDate, weekStartsOn);
  }, [currentDate, weekStartsOn]);

  const monthLabel = useMemo(() => {
    return format(currentDate, 'MMMM yyyy');
  }, [currentDate]);

  return {
    currentDate,
    selectedDate,
    setSelectedDate,
    daysMatrix,
    monthLabel,
    nextMonth,
    prevMonth,
    goToToday,
    selectedDateISO: toISODate(selectedDate),
  };
};
