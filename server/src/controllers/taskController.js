import Task from '../models/Task.js';
import Workspace from '../models/Workspace.js';

// Helper to check user access to a workspace
const verifyWorkspaceAccess = async (workspaceId, userId) => {
  if (!workspaceId) return true;
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    $or: [{ owner: userId }, { 'members.user': userId }],
  });
  return !!workspace;
};

const parseDateOrNull = (val) => {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// @desc    Get all tasks for current user with optional date range, status, priority, search, and workspace filters
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res, next) => {
  try {
    const { start, end, status, priority, workspaceId, tag, q, sort } = req.query;

    const query = {};

    // Workspace or personal filter
    if (workspaceId && workspaceId !== 'personal' && workspaceId !== 'all') {
      const hasAccess = await verifyWorkspaceAccess(workspaceId, req.user._id);
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied to this workspace' });
      }
      query.workspaceId = workspaceId;
    } else if (workspaceId === 'personal') {
      query.userId = req.user._id;
      query.workspaceId = null;
    } else {
      // Default: user's own tasks or tasks assigned to user
      query.$or = [{ userId: req.user._id }, { assignedTo: req.user._id }];
    }

    // Filter by date range if provided
    if (start || end) {
      query.startDate = {};
      if (start) {
        query.startDate.$gte = new Date(start);
      }
      if (end) {
        query.startDate.$lte = new Date(end);
      }
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by priority if provided
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Filter by tag if provided
    if (tag && tag !== 'all') {
      query.tags = tag;
    }

    // Text search query on title or description
    if (q && q.trim()) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: q.trim(), $options: 'i' } },
          { description: { $regex: q.trim(), $options: 'i' } },
          { tags: { $regex: q.trim(), $options: 'i' } },
        ],
      });
    }

    // Sorting
    let sortOptions = { startDate: 1, startTime: 1, createdAt: -1 };
    if (sort === 'priority-desc') {
      sortOptions = { priority: -1, startDate: 1 };
    } else if (sort === 'date-desc') {
      sortOptions = { startDate: -1 };
    } else if (sort === 'title-asc') {
      sortOptions = { title: 1 };
    }

    const tasks = await Task.find(query)
      .populate('userId', 'name email')
      .populate('assignedTo', 'name email')
      .sort(sortOptions);

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get task statistics for dashboard & quick widgets
// @route   GET /api/tasks/stats
// @access  Private
export const getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { workspaceId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseQuery = { userId };
    if (workspaceId && workspaceId !== 'personal' && workspaceId !== 'all') {
      baseQuery.workspaceId = workspaceId;
      delete baseQuery.userId;
    } else if (workspaceId === 'personal') {
      baseQuery.workspaceId = null;
    }

    const [total, completed, inProgress, todo, overdue] = await Promise.all([
      Task.countDocuments(baseQuery),
      Task.countDocuments({ ...baseQuery, status: 'Done' }),
      Task.countDocuments({ ...baseQuery, status: 'In Progress' }),
      Task.countDocuments({ ...baseQuery, status: 'To Do' }),
      Task.countDocuments({
        ...baseQuery,
        status: { $ne: 'Done' },
        startDate: { $lt: today },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        completed,
        inProgress,
        todo,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comprehensive productivity analytics
// @route   GET /api/tasks/analytics
// @access  Private
export const getAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { days = 30 } = req.query;
    const numDays = Math.min(Math.max(parseInt(days, 10) || 30, 7), 90);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - numDays);
    sinceDate.setHours(0, 0, 0, 0);

    const userTasks = await Task.find({
      $or: [{ userId }, { assignedTo: userId }],
    });

    const total = userTasks.length;
    const completed = userTasks.filter((t) => t.status === 'Done').length;
    const inProgress = userTasks.filter((t) => t.status === 'In Progress').length;
    const todo = userTasks.filter((t) => t.status === 'To Do').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = userTasks.filter(
      (t) => t.status !== 'Done' && new Date(t.startDate) < today
    ).length;

    // Daily completion trend for the last N days
    const completionTrend = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const doneOnDay = userTasks.filter((t) => {
        if (t.status !== 'Done') return false;
        const taskUpdated = new Date(t.updatedAt || t.startDate);
        return taskUpdated >= dayStart && taskUpdated <= dayEnd;
      }).length;

      const createdOnDay = userTasks.filter((t) => {
        const taskCreated = new Date(t.createdAt || t.startDate);
        return taskCreated >= dayStart && taskCreated <= dayEnd;
      }).length;

      completionTrend.push({
        date: dateStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: doneOnDay,
        created: createdOnDay,
      });
    }

    // Breakdown by Priority
    const priorityBreakdown = {
      High: userTasks.filter((t) => t.priority === 'High').length,
      Medium: userTasks.filter((t) => t.priority === 'Medium').length,
      Low: userTasks.filter((t) => t.priority === 'Low').length,
    };

    // Breakdown by Tag
    const tagCountMap = {};
    userTasks.forEach((t) => {
      (t.tags || []).forEach((tag) => {
        tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
      });
    });
    const tagBreakdown = Object.entries(tagCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Total estimated and actual focus minutes
    const totalEstimatedMinutes = userTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
    const totalActualMinutes = userTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        total,
        completed,
        inProgress,
        todo,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        completionTrend,
        priorityBreakdown,
        tagBreakdown,
        totalEstimatedMinutes,
        totalActualMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private
export const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      $or: [{ userId: req.user._id }, { assignedTo: req.user._id }],
    })
      .populate('userId', 'name email')
      .populate('assignedTo', 'name email')
      .populate('comments.userId', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      dueDate,
      startTime,
      endTime,
      isAllDay,
      status,
      priority,
      color,
      tags,
      subtasks,
      recurrence,
      reminder,
      workspaceId,
      assignedTo,
      estimatedMinutes,
    } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide task title and start date',
      });
    }

    const parsedStart = parseDateOrNull(startDate) || new Date();
    const parsedEnd = parseDateOrNull(endDate) || parsedStart;
    const parsedDue = parseDateOrNull(dueDate);

    const task = await Task.create({
      userId: req.user._id,
      workspaceId: (workspaceId && workspaceId !== 'personal') ? workspaceId : null,
      assignedTo: (assignedTo && assignedTo !== 'personal') ? assignedTo : null,
      title: title.trim(),
      description: description || '',
      startDate: parsedStart,
      endDate: parsedEnd,
      dueDate: parsedDue,
      startTime: startTime || null,
      endTime: endTime || null,
      isAllDay: isAllDay !== undefined ? isAllDay : !startTime,
      status: status || 'To Do',
      priority: priority || 'Medium',
      color: color || 'indigo',
      tags: Array.isArray(tags) ? tags : [],
      subtasks: Array.isArray(subtasks) ? subtasks : [],
      recurrence: recurrence || { frequency: 'none', interval: 1 },
      reminder: reminder || { enabled: false, minutesBefore: 15 },
      estimatedMinutes: Number(estimatedMinutes) || 0,
      activity: [
        {
          action: 'Created task',
          details: `Created by ${req.user?.name || 'User'}`,
          timestamp: new Date(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing task (full update)
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      $or: [{ userId: req.user._id }, { assignedTo: req.user._id }],
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const allowedUpdates = [
      'title',
      'description',
      'startDate',
      'endDate',
      'dueDate',
      'startTime',
      'endTime',
      'isAllDay',
      'status',
      'priority',
      'color',
      'tags',
      'subtasks',
      'recurrence',
      'reminder',
      'workspaceId',
      'assignedTo',
      'estimatedMinutes',
      'actualMinutes',
    ];

    const prevStatus = task.status;

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'startDate') {
          const parsed = parseDateOrNull(req.body[field]);
          if (parsed) task.startDate = parsed;
        } else if (field === 'endDate' || field === 'dueDate') {
          task[field] = parseDateOrNull(req.body[field]);
        } else if (field === 'workspaceId' || field === 'assignedTo') {
          task[field] = (req.body[field] && req.body[field] !== 'personal') ? req.body[field] : null;
        } else {
          task[field] = req.body[field];
        }
      }
    });

    if (req.body.status && req.body.status !== prevStatus) {
      if (!task.activity) task.activity = [];
      task.activity.push({
        action: 'Status changed',
        details: `Changed from ${prevStatus} to ${req.body.status} by ${req.user?.name || 'User'}`,
        timestamp: new Date(),
      });
    }

    await task.save();

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Update Task Error:', error);
    next(error);
  }
};

// @desc    Partially update a task (status, priority, color, subtasks)
// @route   PATCH /api/tasks/:id
// @access  Private
export const patchTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      $or: [{ userId: req.user._id }, { assignedTo: req.user._id }],
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const prevStatus = task.status;

    const patchableFields = [
      'title',
      'status',
      'priority',
      'color',
      'subtasks',
      'actualMinutes',
      'estimatedMinutes',
      'tags',
      'startDate',
      'endDate',
      'dueDate',
    ];

    let updated = false;

    patchableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'startDate') {
          const parsed = parseDateOrNull(req.body[field]);
          if (parsed) task.startDate = parsed;
        } else if (field === 'endDate' || field === 'dueDate') {
          task[field] = parseDateOrNull(req.body[field]);
        } else {
          task[field] = req.body[field];
        }
        updated = true;
      }
    });

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    if (req.body.status && req.body.status !== prevStatus) {
      if (!task.activity) task.activity = [];
      task.activity.push({
        action: 'Status changed',
        details: `Changed from ${prevStatus} to ${req.body.status} by ${req.user?.name || 'User'}`,
        timestamp: new Date(),
      });
    }

    await task.save();

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Patch Task Error:', error);
    next(error);
  }
};

// @desc    Add comment to a task
// @route   POST /api/tasks/:id/comments
// @access  Private
export const addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      $or: [{ userId: req.user._id }, { assignedTo: req.user._id }],
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const newComment = {
      userId: req.user._id,
      userName: req.user.name || 'User',
      text: text.trim(),
      createdAt: new Date(),
    };

    if (!task.comments) task.comments = [];
    task.comments.push(newComment);
    if (!task.activity) task.activity = [];
    task.activity.push({
      action: 'Comment added',
      details: `${req.user?.name || 'User'} commented on this task`,
      timestamp: new Date(),
    });

    await task.save();

    return res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Task successfully deleted',
    });
  } catch (error) {
    next(error);
  }
};
