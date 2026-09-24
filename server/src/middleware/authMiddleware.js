import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';

export const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.trim().toLowerCase().startsWith('bearer ')) {
    try {
      token = authHeader.trim().substring(7).trim();

      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Get user from token (exclude password)
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user not found',
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token invalid or expired',
      });
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Not authorized, no token provided',
  });
};
