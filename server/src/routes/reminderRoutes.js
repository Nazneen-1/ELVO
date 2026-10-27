import express from 'express';
import { processRemindersTrigger } from '../controllers/reminderController.js';

const router = express.Router();

// Trigger due reminder processing (authenticated by secret token)
router.post('/process', processRemindersTrigger);

export default router;
