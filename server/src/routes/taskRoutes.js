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
  updateTaskOccurrence,
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

// Occurrence actions (complete, reopen, skip)
router.post('/:id/occurrences/:date?', updateTaskOccurrence);
router.post('/:id/occurrence/:date?', updateTaskOccurrence);
router.patch('/:id/occurrences/:date?', updateTaskOccurrence);
router.patch('/:id/occurrence/:date?', updateTaskOccurrence);
router.delete('/:id/occurrences/:date', (req, res, next) => {
  req.body = { ...req.body, action: 'skip' };
  return updateTaskOccurrence(req, res, next);
});

router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .patch(patchTask)
  .delete(deleteTask);

export default router;
