import express from 'express';
import {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  archiveNote,
  restoreNote,
  trashNote,
  deleteNotePermanently,
  emptyTrash,
  togglePin,
  toggleFavorite,
  linkTaskToNote,
  unlinkTaskFromNote,
  createTaskFromSelection,
} from '../controllers/noteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getNotes)
  .post(createNote);

// Specific routes before param :id
router.delete('/trash/empty', emptyTrash);

router.route('/:id')
  .get(getNoteById)
  .put(updateNote)
  .delete(deleteNotePermanently);

router.patch('/:id/archive', archiveNote);
router.patch('/:id/restore', restoreNote);
router.patch('/:id/trash', trashNote);
router.patch('/:id/pin', togglePin);
router.patch('/:id/favorite', toggleFavorite);
router.post('/:id/link-task', linkTaskToNote);
router.post('/:id/unlink-task', unlinkTaskFromNote);
router.post('/:id/create-task-from-selection', createTaskFromSelection);

export default router;
