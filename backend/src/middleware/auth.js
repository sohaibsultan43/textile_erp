const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendError } = require('../utils/response');

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return sendError(res, 'Access denied. No token provided.', 401);
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Ensure token user still exists after reseeds/migrations.
      let dbUser = null;
      if (decoded?.id) {
        dbUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, email: true, role: true, name: true },
        });
      }

      // Fallback: if ID no longer exists but email is the same user, repair session context.
      if (!dbUser && decoded?.email) {
        dbUser = await prisma.user.findUnique({
          where: { email: String(decoded.email).toLowerCase() },
          select: { id: true, email: true, role: true, name: true },
        });
      }

      if (!dbUser) {
        return sendError(res, 'Session is no longer valid. Please log in again.', 401);
      }

      req.user = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name,
      };
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return sendError(res, 'Token expired.', 401);
      } else if (jwtError.name === 'JsonWebTokenError') {
        return sendError(res, 'Invalid token.', 401);
      } else {
        return sendError(res, 'Token verification failed.', 401);
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return sendError(res, 'Authentication error occurred.', 500);
  }
};

// Role-based authorization middleware
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required.', 401);
      }

      // Development simplification: allow all authenticated users when RBAC is disabled.
      // Set RBAC_ENABLED=false in backend/.env to bypass role checks.
      if (String(process.env.RBAC_ENABLED).toLowerCase() === 'false') {
        return next();
      }

      if (!allowedRoles.includes(req.user.role)) {
        return sendError(res, 'Access denied. Insufficient permissions.', 403);
      }

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      return sendError(res, 'Authorization error occurred.', 500);
    }
  };
};

module.exports = { authMiddleware, authorize };