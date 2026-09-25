import express from 'express';
import {
  getTasks,
  getTaskById,
  getTaskStats,
  getAnalytics,
  createTask,
  updateTask,
  patchTask,
  deleteTask,
  addComment,
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All task routes require authentication
router.use(protect);

// Specific routes before param route
router.get('/stats', getTaskStats);
router.get('/analytics', getAnalytics);

router.route('/')
  .get(getTasks)
  .post(createTask);

router.post('/:id/comments', addComment);

router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .patch(patchTask)
  .delete(deleteTask);

export default router;
