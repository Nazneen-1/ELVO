import Task from '../models/Task.js';

// @desc    Get all tasks for current user with optional date range and status filters
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res, next) => {
  try {
    const { start, end, status } = req.query;

    const query = {
      userId: req.user._id,
    };

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

    const tasks = await Task.find(query).sort({ startDate: 1, startTime: 1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
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
      startTime,
      endTime,
      isAllDay,
      status,
      priority,
      color,
    } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide task title and start date',
      });
    }

    const task = await Task.create({
      userId: req.user._id,
      title,
      description: description || '',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(startDate),
      startTime: startTime || null,
      endTime: endTime || null,
      isAllDay: isAllDay !== undefined ? isAllDay : !startTime,
      status: status || 'pending',
      priority: priority || 'medium',
      color: color || 'indigo',
    });

    return res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res, next) => {
  try {
    let task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
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
      'startTime',
      'endTime',
      'isAllDay',
      'status',
      'priority',
      'color',
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          task[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          task[field] = req.body[field];
        }
      }
    });

    await task.save();

    return res.status(200).json({
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
