import express from 'express';
import {
  getNoteCollections,
  createNoteCollection,
  updateNoteCollection,
  deleteNoteCollection,
} from '../controllers/noteCollectionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getNoteCollections)
  .post(createNoteCollection);

router.route('/:id')
  .put(updateNoteCollection)
  .delete(deleteNoteCollection);

export default router;
