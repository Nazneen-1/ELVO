import express from 'express';
import {
  getWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  joinWorkspace,
  inviteMember,
  removeMember,
  deleteWorkspace,
} from '../controllers/workspaceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getWorkspaces)
  .post(createWorkspace);

router.post('/join', joinWorkspace);

router.route('/:id')
  .get(getWorkspaceById)
  .put(updateWorkspace)
  .delete(deleteWorkspace);

router.post('/:id/members', inviteMember);
router.delete('/:id/members/:userId', removeMember);

export default router;
