import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import HabitTarget from '../models/HabitTarget.js';

/**
 * Returns today's date formatted as YYYY-MM-DD in UTC/ISO-safe manner.
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into day-of-week (0 = Sun, 1 = Mon, ..., 6 = Sat).
 */
export function getDayOfWeekFromDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay();
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string, returning YYYY-MM-DD.
 */
export function shiftDateString(dateStr, offsetDays) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Checks if a habit is scheduled on a given YYYY-MM-DD date.
 */
export function isHabitScheduledOnDate(habit, dateStr) {
  const dayOfWeek = getDayOfWeekFromDateString(dateStr);
  const scheduledDays = habit.schedule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
  return scheduledDays.includes(dayOfWeek);
}

/**
 * Calculates current streak and best streak for a habit given its logs map.
 * 
 * Rules:
 * 1. Only scheduled days for this habit are evaluated.
 * 2. Unscheduled days (e.g. weekends for weekday habits) are skipped and do NOT break streaks.
 * 3. Today's incomplete occurrence does NOT break an existing streak before the day ends.
 * 4. Best streak is the maximum consecutive scheduled occurrences successfully completed in history.
 *
 * @param {Object} habit - Habit document or plain object
 * @param {Set<string>|Map<string, boolean>} completedDates - Dates where habit is completed
 * @param {string} referenceDate - Reference date (YYYY-MM-DD), defaults to today
 * @returns {{ currentStreak: number, bestStreak: number, completedToday: boolean }}
 */
export function calculateHabitStreaks(habit, completedDates, referenceDate = getTodayDateString()) {
  const isCompletedOn = (dStr) => {
    if (completedDates instanceof Set) return completedDates.has(dStr);
    if (completedDates instanceof Map) return Boolean(completedDates.get(dStr));
    return Boolean(completedDates[dStr]);
  };

  const completedToday = isHabitScheduledOnDate(habit, referenceDate) && isCompletedOn(referenceDate);

  // 1. Calculate Current Streak
  let currentStreak = 0;
  let checkDate = referenceDate;

  // Find earliest completed date for best streak scan
  let earliestDate = referenceDate;
  if (completedDates instanceof Set) {
    for (const d of completedDates) {
      if (d < earliestDate) earliestDate = d;
    }
  } else if (completedDates && typeof completedDates === 'object') {
    Object.keys(completedDates).forEach((d) => {
      if (d < earliestDate) earliestDate = d;
    });
  }

  // If today is scheduled:
  if (isHabitScheduledOnDate(habit, referenceDate)) {
    if (completedToday) {
      currentStreak = 1;
      checkDate = shiftDateString(referenceDate, -1);
    } else {
      // Not completed yet today. Today does NOT break streak prematurely.
      // Check previous scheduled day.
      checkDate = shiftDateString(referenceDate, -1);
    }
  } else {
    // Today is unscheduled, check backwards starting yesterday
    checkDate = shiftDateString(referenceDate, -1);
  }

  // Traverse backwards through past scheduled days
  let safeLimit = 1000;
  while (safeLimit-- > 0 && checkDate >= '2020-01-01') {
    if (isHabitScheduledOnDate(habit, checkDate)) {
      if (isCompletedOn(checkDate)) {
        currentStreak++;
      } else {
        // Streak broken
        break;
      }
    }
    checkDate = shiftDateString(checkDate, -1);
  }

  // 2. Calculate Best Streak across full history
  let bestStreak = 0;
  let tempStreak = 0;

  let cursor = earliestDate;
  safeLimit = 3000;

  while (safeLimit-- > 0 && cursor <= referenceDate) {
    if (isHabitScheduledOnDate(habit, cursor)) {
      if (isCompletedOn(cursor)) {
        tempStreak++;
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }
    cursor = shiftDateString(cursor, 1);
  }

  if (currentStreak > bestStreak) {
    bestStreak = currentStreak;
  }

  return { currentStreak, bestStreak, completedToday };
}

// ==========================================
// CONTROLLER HANDLERS
// ==========================================

// @desc    Get user habits with streak stats
// @route   GET /api/habits
// @access  Private
export const getHabits = async (req, res, next) => {
  try {
    const { includeArchived } = req.query;
    const filter = { userId: req.user._id };

    if (includeArchived !== 'true') {
      filter.isArchived = false;
    }

    const habits = await Habit.find(filter).sort({ sortOrder: 1, createdAt: 1 });

    // Fetch all completed logs for user to compute streaks
    const habitIds = habits.map((h) => h._id);
    const logs = await HabitLog.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      isCompleted: true,
    }).select('habitId date');

    const logsByHabit = {};
    logs.forEach((log) => {
      const hId = log.habitId.toString();
      if (!logsByHabit[hId]) logsByHabit[hId] = new Set();
      logsByHabit[hId].add(log.date);
    });

    const todayStr = getTodayDateString();
    const result = habits.map((h) => {
      const hObj = h.toObject();
      const dateSet = logsByHabit[h._id.toString()] || new Set();
      const { currentStreak, bestStreak, completedToday } = calculateHabitStreaks(h, dateSet, todayStr);
      return {
        ...hObj,
        currentStreak,
        bestStreak,
        completedToday,
        isScheduledToday: isHabitScheduledOnDate(h, todayStr),
      };
    });

    return res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single habit by ID
// @route   GET /api/habits/:id
// @access  Private
export const getHabitById = async (req, res, next) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied to this habit' });
    }

    const logs = await HabitLog.find({
      habitId: habit._id,
      isCompleted: true,
    }).select('date');

    const dateSet = new Set(logs.map((l) => l.date));
    const streaks = calculateHabitStreaks(habit, dateSet, getTodayDateString());

    return res.status(200).json({
      success: true,
      data: {
        ...habit.toObject(),
        ...streaks,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new habit
// @route   POST /api/habits
// @access  Private
export const createHabit = async (req, res, next) => {
  try {
    const { name, description, category, color, icon, schedule, sortOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Habit name is required' });
    }

    let finalSchedule = { type: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
    if (schedule) {
      if (schedule.type === 'weekdays') {
        finalSchedule = { type: 'weekdays', daysOfWeek: [1, 2, 3, 4, 5] };
      } else if (schedule.type === 'custom' && Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
        finalSchedule = {
          type: 'custom',
          daysOfWeek: Array.from(new Set(schedule.daysOfWeek.map(Number))).filter((d) => d >= 0 && d <= 6),
        };
      } else {
        finalSchedule = { type: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
      }
    }

    // Determine default sortOrder if not provided
    let order = Number.isInteger(sortOrder) ? sortOrder : 0;
    if (!Number.isInteger(sortOrder)) {
      const highest = await Habit.findOne({ userId: req.user._id }).sort({ sortOrder: -1 });
      order = highest ? highest.sortOrder + 1 : 0;
    }

    const habit = await Habit.create({
      userId: req.user._id,
      name: name.trim(),
      description: description ? description.trim() : '',
      category: category && category.trim() ? category.trim() : 'General',
      color: color || '#6366F1',
      icon: icon || 'check',
      schedule: finalSchedule,
      sortOrder: order,
    });

    return res.status(201).json({
      success: true,
      data: {
        ...habit.toObject(),
        currentStreak: 0,
        bestStreak: 0,
        completedToday: false,
        isScheduledToday: isHabitScheduledOnDate(habit, getTodayDateString()),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a habit
// @route   PUT /api/habits/:id
// @access  Private
export const updateHabit = async (req, res, next) => {
  try {
    const { name, description, category, color, icon, schedule, sortOrder } = req.body;
    const habit = await Habit.findById(req.params.id);

    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied to this habit' });
    }

    if (name !== undefined) habit.name = name.trim();
    if (description !== undefined) habit.description = description.trim();
    if (category !== undefined) habit.category = category.trim();
    if (color !== undefined) habit.color = color;
    if (icon !== undefined) habit.icon = icon;
    if (Number.isInteger(sortOrder)) habit.sortOrder = sortOrder;

    if (schedule) {
      if (schedule.type === 'weekdays') {
        habit.schedule = { type: 'weekdays', daysOfWeek: [1, 2, 3, 4, 5] };
      } else if (schedule.type === 'custom' && Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
        habit.schedule = {
          type: 'custom',
          daysOfWeek: Array.from(new Set(schedule.daysOfWeek.map(Number))).filter((d) => d >= 0 && d <= 6),
        };
      } else {
        habit.schedule = { type: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
      }
    }

    await habit.save();

    return res.status(200).json({ success: true, data: habit });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive a habit
// @route   PATCH /api/habits/:id/archive
// @access  Private
export const archiveHabit = async (req, res, next) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    habit.isArchived = true;
    habit.archivedAt = new Date();
    await habit.save();

    return res.status(200).json({ success: true, message: 'Habit archived', data: habit });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore an archived habit
// @route   PATCH /api/habits/:id/restore
// @access  Private
export const restoreHabit = async (req, res, next) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    habit.isArchived = false;
    habit.archivedAt = null;
    await habit.save();

    return res.status(200).json({ success: true, message: 'Habit restored', data: habit });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete a habit and its logs
// @route   DELETE /api/habits/:id
// @access  Private
export const deleteHabit = async (req, res, next) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await HabitLog.deleteMany({ habitId: habit._id, userId: req.user._id });
    await Habit.findByIdAndDelete(habit._id);

    return res.status(200).json({ success: true, message: 'Habit permanently deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder habits
// @route   PUT /api/habits/reorder
// @access  Private
export const reorderHabits = async (req, res, next) => {
  try {
    const { habitIds } = req.body;
    if (!Array.isArray(habitIds)) {
      return res.status(400).json({ success: false, message: 'habitIds array is required' });
    }

    const updates = habitIds.map((id, index) =>
      Habit.updateOne({ _id: id, userId: req.user._id }, { $set: { sortOrder: index } })
    );
    await Promise.all(updates);

    const habits = await Habit.find({ userId: req.user._id, isArchived: false }).sort({
      sortOrder: 1,
      createdAt: 1,
    });

    return res.status(200).json({ success: true, data: habits });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle or set completion for a habit on a date
// @route   POST /api/habits/:id/toggle
// @access  Private
export const toggleHabitCompletion = async (req, res, next) => {
  try {
    const { date, isCompleted } = req.body;
    const targetDate = date ? String(date).trim() : getTodayDateString();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ success: false, message: 'Invalid date format (must be YYYY-MM-DD)' });
    }

    const todayStr = getTodayDateString();
    if (targetDate > todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Cannot log habit completion for future dates',
      });
    }

    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied to this habit' });
    }

    // Check existing log
    let existing = await HabitLog.findOne({
      habitId: habit._id,
      date: targetDate,
      userId: req.user._id,
    });

    let newStatus = true;
    if (isCompleted !== undefined) {
      newStatus = Boolean(isCompleted);
    } else if (existing) {
      newStatus = !existing.isCompleted;
    }

    const updatedLog = await HabitLog.findOneAndUpdate(
      { habitId: habit._id, date: targetDate, userId: req.user._id },
      {
        $set: {
          isCompleted: newStatus,
          completedAt: newStatus ? new Date() : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Compute updated streaks for this habit
    const allLogs = await HabitLog.find({
      habitId: habit._id,
      isCompleted: true,
    }).select('date');

    const dateSet = new Set(allLogs.map((l) => l.date));
    const streaks = calculateHabitStreaks(habit, dateSet, todayStr);

    return res.status(200).json({
      success: true,
      data: {
        habitId: habit._id,
        date: targetDate,
        isCompleted: updatedLog.isCompleted,
        ...streaks,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily overview for a specific date
// @route   GET /api/habits/daily
// @access  Private
export const getDailyOverview = async (req, res, next) => {
  try {
    const targetDate = req.query.date ? String(req.query.date).trim() : getTodayDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ success: false, message: 'Invalid date format (must be YYYY-MM-DD)' });
    }

    const dayOfWeek = getDayOfWeekFromDateString(targetDate);
    const todayStr = getTodayDateString();

    // Active habits (plus archived if archived after this date)
    const habits = await Habit.find({
      userId: req.user._id,
      $or: [
        { isArchived: false },
        { isArchived: true, archivedAt: { $gte: new Date(targetDate + 'T00:00:00.000Z') } },
      ],
    }).sort({ sortOrder: 1, createdAt: 1 });

    const scheduledHabits = habits.filter((h) => {
      const days = h.schedule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      return days.includes(dayOfWeek);
    });

    const habitIds = scheduledHabits.map((h) => h._id);
    const logs = await HabitLog.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      date: targetDate,
    });

    const logMap = {};
    logs.forEach((l) => {
      logMap[l.habitId.toString()] = l.isCompleted;
    });

    // Also get all logs for streak calculation
    const allLogs = await HabitLog.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      isCompleted: true,
    }).select('habitId date');

    const allLogsByHabit = {};
    allLogs.forEach((l) => {
      const hId = l.habitId.toString();
      if (!allLogsByHabit[hId]) allLogsByHabit[hId] = new Set();
      allLogsByHabit[hId].add(l.date);
    });

    let completedCount = 0;
    const items = scheduledHabits.map((h) => {
      const isDone = Boolean(logMap[h._id.toString()]);
      if (isDone) completedCount++;

      const dateSet = allLogsByHabit[h._id.toString()] || new Set();
      const streaks = calculateHabitStreaks(h, dateSet, todayStr);

      return {
        ...h.toObject(),
        isCompleted: isDone,
        ...streaks,
      };
    });

    const totalScheduled = scheduledHabits.length;
    const completionPercentage = totalScheduled > 0 ? Math.round((completedCount / totalScheduled) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        isToday: targetDate === todayStr,
        isFuture: targetDate > todayStr,
        totalScheduled,
        completedCount,
        completionPercentage,
        habits: items,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly matrix of habits and calendar date checkboxes
// @route   GET /api/habits/matrix
// @access  Private
export const getMonthMatrix = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const now = new Date();
    const targetYear = year ? parseInt(year, 10) : now.getFullYear();
    const targetMonth = month ? parseInt(month, 10) : now.getMonth() + 1; // 1-12

    if (targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ success: false, message: 'Month must be between 1 and 12' });
    }

    // Days in target month
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const padMonth = String(targetMonth).padStart(2, '0');
    const startDateStr = `${targetYear}-${padMonth}-01`;
    const endDateStr = `${targetYear}-${padMonth}-${String(daysInMonth).padStart(2, '0')}`;
    const todayStr = getTodayDateString();

    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const padDay = String(day).padStart(2, '0');
      const dateStr = `${targetYear}-${padMonth}-${padDay}`;
      const dayOfWeek = getDayOfWeekFromDateString(dateStr);
      dates.push({
        date: dateStr,
        dayNumber: day,
        dayOfWeek,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }

    // Active habits (plus any archived habits that have activity in this month)
    const habits = await Habit.find({
      userId: req.user._id,
      $or: [
        { isArchived: false },
        { isArchived: true, archivedAt: { $gte: new Date(startDateStr + 'T00:00:00.000Z') } },
      ],
    }).sort({ sortOrder: 1, createdAt: 1 });

    const habitIds = habits.map((h) => h._id);

    // Fetch logs in date range
    const logs = await HabitLog.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      date: { $gte: startDateStr, $lte: endDateStr },
    });

    // Fetch all historical logs to calculate streaks
    const allHistoricalLogs = await HabitLog.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      isCompleted: true,
    }).select('habitId date');

    const historicalLogsByHabit = {};
    allHistoricalLogs.forEach((l) => {
      const hId = l.habitId.toString();
      if (!historicalLogsByHabit[hId]) historicalLogsByHabit[hId] = new Set();
      historicalLogsByHabit[hId].add(l.date);
    });

    // Build fast lookup: completions[habitId][date] = true/false
    const completions = {};
    logs.forEach((log) => {
      const hId = log.habitId.toString();
      if (!completions[hId]) completions[hId] = {};
      completions[hId][log.date] = Boolean(log.isCompleted);
    });

    // Build habit rows with schedule mask per date
    let monthlyScheduledOccurrences = 0;
    let monthlyCompletedOccurrences = 0;

    const habitRows = habits.map((h) => {
      const hId = h._id.toString();
      const hCompletions = completions[hId] || {};
      const scheduledDays = h.schedule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];

      let habitMonthScheduled = 0;
      let habitMonthCompleted = 0;

      const dateStatuses = {};
      dates.forEach((d) => {
        const isScheduled = scheduledDays.includes(d.dayOfWeek);
        const isCompleted = Boolean(hCompletions[d.date]);

        dateStatuses[d.date] = {
          isScheduled,
          isCompleted,
          isFuture: d.isFuture,
        };

        // Only count up to today for historical consistency
        if (isScheduled && !d.isFuture) {
          habitMonthScheduled++;
          monthlyScheduledOccurrences++;
          if (isCompleted) {
            habitMonthCompleted++;
            monthlyCompletedOccurrences++;
          }
        }
      });

      const dateSet = historicalLogsByHabit[hId] || new Set();
      const streaks = calculateHabitStreaks(h, dateSet, todayStr);

      const completionRate = habitMonthScheduled > 0
        ? Math.round((habitMonthCompleted / habitMonthScheduled) * 100)
        : 0;

      return {
        ...h.toObject(),
        statuses: dateStatuses,
        monthScheduled: habitMonthScheduled,
        monthCompleted: habitMonthCompleted,
        completionRate,
        ...streaks,
      };
    });

    // Daily breakdown for column footers
    const dailyBreakdown = {};
    dates.forEach((d) => {
      let scheduled = 0;
      let completed = 0;
      habitRows.forEach((hr) => {
        const st = hr.statuses[d.date];
        if (st?.isScheduled) {
          scheduled++;
          if (st.isCompleted) completed++;
        }
      });
      dailyBreakdown[d.date] = {
        scheduled,
        completed,
        percentage: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
      };
    });

    const monthlyCompletionRate = monthlyScheduledOccurrences > 0
      ? Math.round((monthlyCompletedOccurrences / monthlyScheduledOccurrences) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        year: targetYear,
        month: targetMonth,
        startDate: startDateStr,
        endDate: endDateStr,
        dates,
        habits: habitRows,
        dailyBreakdown,
        summary: {
          totalHabits: habitRows.length,
          monthlyScheduledOccurrences,
          monthlyCompletedOccurrences,
          monthlyCompletionRate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get derived habit statistics (for 360 ring, streaks, weekly trends)
// @route   GET /api/habits/stats
// @access  Private
export const getHabitStats = async (req, res, next) => {
  try {
    const todayStr = getTodayDateString();
    const habits = await Habit.find({ userId: req.user._id, isArchived: false }).sort({ sortOrder: 1 });
    const habitIds = habits.map((h) => h._id);

    // 1. Today's stats
    const todayDayOfWeek = getDayOfWeekFromDateString(todayStr);
    const scheduledToday = habits.filter((h) => {
      const days = h.schedule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      return days.includes(todayDayOfWeek);
    });

    const todayLogs = await HabitLog.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      date: todayStr,
      isCompleted: true,
    });
    const todayCompletedCount = todayLogs.length;
    const todayScheduledCount = scheduledToday.length;
    const todayPercentage = todayScheduledCount > 0
      ? Math.round((todayCompletedCount / todayScheduledCount) * 100)
      : 0;

    // 2. Streaks calculation
    const allLogs = await HabitLog.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      isCompleted: true,
    }).select('habitId date');

    const logsByHabit = {};
    allLogs.forEach((l) => {
      const hId = l.habitId.toString();
      if (!logsByHabit[hId]) logsByHabit[hId] = new Set();
      logsByHabit[hId].add(l.date);
    });

    let maxCurrentStreak = 0;
    let maxBestStreak = 0;
    let totalActiveStreaks = 0;

    const habitStreaks = habits.map((h) => {
      const set = logsByHabit[h._id.toString()] || new Set();
      const streaks = calculateHabitStreaks(h, set, todayStr);
      if (streaks.currentStreak > maxCurrentStreak) maxCurrentStreak = streaks.currentStreak;
      if (streaks.bestStreak > maxBestStreak) maxBestStreak = streaks.bestStreak;
      if (streaks.currentStreak > 0) totalActiveStreaks++;
      return {
        habitId: h._id,
        name: h.name,
        category: h.category,
        schedule: h.schedule,
        color: h.color,
        icon: h.icon,
        ...streaks,
      };
    });

    // 3. Weekly 7-day trend
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = shiftDateString(todayStr, -i);
      const dayOfWeek = getDayOfWeekFromDateString(dateStr);
      const scheduledOnDay = habits.filter((h) => {
        const days = h.schedule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        return days.includes(dayOfWeek);
      }).length;

      const dayLogs = allLogs.filter((l) => l.date === dateStr);
      const completedOnDay = dayLogs.length;

      weeklyTrend.push({
        date: dateStr,
        dayOfWeek,
        scheduled: scheduledOnDay,
        completed: completedOnDay,
        percentage: scheduledOnDay > 0 ? Math.round((completedOnDay / scheduledOnDay) * 100) : 0,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        today: {
          date: todayStr,
          scheduled: todayScheduledCount,
          completed: todayCompletedCount,
          percentage: todayPercentage,
        },
        streaks: {
          maxCurrentStreak,
          maxBestStreak,
          totalActiveStreaks,
          habits: habitStreaks,
        },
        weeklyTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Habit Targets Controllers
// ==========================================

// @desc    Get all habit targets for the authenticated user
// @route   GET /api/habits/targets
// @access  Private
export const getHabitTargets = async (req, res, next) => {
  try {
    const targets = await HabitTarget.find({ userId: req.user._id }).sort({
      sortOrder: 1,
      createdAt: 1,
    });
    return res.status(200).json({ success: true, data: targets });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new personal habit target
// @route   POST /api/habits/targets
// @access  Private
export const createHabitTarget = async (req, res, next) => {
  try {
    const { habitName, target, completed } = req.body;
    const trimmedHabit = typeof habitName === 'string' ? habitName.trim() : '';
    const trimmedTarget = typeof target === 'string' ? target.trim() : '';

    if (!trimmedHabit || !trimmedTarget) {
      return res.status(400).json({
        success: false,
        message: 'Both Habit Name and Target are required and cannot be empty',
      });
    }

    const count = await HabitTarget.countDocuments({ userId: req.user._id });

    const newTarget = await HabitTarget.create({
      userId: req.user._id,
      habitName: trimmedHabit,
      target: trimmedTarget,
      completed: typeof completed === 'boolean' ? completed : false,
      sortOrder: count,
    });

    return res.status(201).json({ success: true, data: newTarget });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a personal habit target
// @route   PUT /api/habits/targets/:id
// @access  Private
export const updateHabitTarget = async (req, res, next) => {
  try {
    const targetDoc = await HabitTarget.findById(req.params.id);
    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Habit target not found' });
    }

    if (targetDoc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { habitName, target, completed } = req.body;

    if (typeof completed === 'boolean') {
      targetDoc.completed = completed;
    }

    if (habitName !== undefined || target !== undefined) {
      const trimmedHabit = typeof habitName === 'string' ? habitName.trim() : (targetDoc.habitName || '');
      const trimmedTarget = typeof target === 'string' ? target.trim() : (targetDoc.target || '');

      if (!trimmedHabit || !trimmedTarget) {
        return res.status(400).json({
          success: false,
          message: 'Both Habit Name and Target are required and cannot be empty',
        });
      }
      targetDoc.habitName = trimmedHabit;
      targetDoc.target = trimmedTarget;
    }

    await targetDoc.save();

    return res.status(200).json({ success: true, data: targetDoc });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a personal habit target
// @route   DELETE /api/habits/targets/:id
// @access  Private
export const deleteHabitTarget = async (req, res, next) => {
  try {
    const targetDoc = await HabitTarget.findById(req.params.id);
    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Habit target not found' });
    }

    if (targetDoc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await HabitTarget.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true, message: 'Habit target deleted' });
  } catch (error) {
    next(error);
  }
};
