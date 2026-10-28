import express from 'express';
import {
  getWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  joinWorkspace,
  regenerateJoinCode,
  revokeJoinCode,
  createInvitation,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
  inviteMember,
  updateMemberRole,
  transferOwnership,
  removeMember,
  archiveWorkspace,
  restoreWorkspace,
  getWorkspaceActivity,
  deleteWorkspace,
} from '../controllers/workspaceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getWorkspaces)
  .post(createWorkspace);

// Global invitation and join routes (must precede /:id)
router.post('/join', joinWorkspace);
router.post('/invitations/:token/accept', acceptInvitation);
router.post('/invitations/:token/decline', declineInvitation);

// Workspace lifecycle and management routes
router.post('/:id/archive', archiveWorkspace);
router.post('/:id/restore', restoreWorkspace);
router.post('/:id/transfer-ownership', transferOwnership);
router.get('/:id/activity', getWorkspaceActivity);

// Join codes
router.post('/:id/join-code/regenerate', regenerateJoinCode);
router.post('/:id/join-code/revoke', revokeJoinCode);

// Email invitations
router.post('/:id/invitations', createInvitation);
router.delete('/:id/invitations/:invitationId', revokeInvitation);

// Membership routes
router.post('/:id/members', inviteMember);
router.put('/:id/members/:userId/role', updateMemberRole);
router.delete('/:id/members/:userId', removeMember);

// Core workspace CRUD
router.route('/:id')
  .get(getWorkspaceById)
  .put(updateWorkspace)
  .delete(deleteWorkspace);

export default router;
