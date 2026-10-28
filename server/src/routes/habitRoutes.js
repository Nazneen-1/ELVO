import express from 'express';
import {
  getHabits,
  getHabitById,
  createHabit,
  updateHabit,
  archiveHabit,
  restoreHabit,
  deleteHabit,
  reorderHabits,
  toggleHabitCompletion,
  getDailyOverview,
  getMonthMatrix,
  getHabitStats,
  getHabitTargets,
  createHabitTarget,
  updateHabitTarget,
  deleteHabitTarget,
} from '../controllers/habitController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Specific collections / aggregates before param :id
router.get('/matrix', getMonthMatrix);
router.get('/daily', getDailyOverview);
router.get('/stats', getHabitStats);
router.put('/reorder', reorderHabits);

// Habit Targets CRUD
router.route('/targets')
  .get(getHabitTargets)
  .post(createHabitTarget);

router.route('/targets/:id')
  .put(updateHabitTarget)
  .delete(deleteHabitTarget);

// Base CRUD
router.route('/')
  .get(getHabits)
  .post(createHabit);

// Param :id routes
router.route('/:id')
  .get(getHabitById)
  .put(updateHabit)
  .delete(deleteHabit);

router.post('/:id/toggle', toggleHabitCompletion);
router.patch('/:id/archive', archiveHabit);
router.patch('/:id/restore', restoreHabit);

export default router;
