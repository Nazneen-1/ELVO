import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import {
  registerUser,
  loginUser,
  getMe,
  updatePreferences,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rate limiter for authentication endpoints: max 30 requests per 15 minutes per IP
// Prevents brute-force credential stuffing and registration flooding
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
  skip: () => config.nodeEnv === 'test' || process.env.NODE_ENV === 'test',
});

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.get('/me', protect, getMe);
router.put('/preferences', protect, updatePreferences);

export default router;
