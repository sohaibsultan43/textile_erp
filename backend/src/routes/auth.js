const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { PrismaClient, Prisma } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { generateToken, generateUserPayload } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/hash');

const router = express.Router();
const prisma = new PrismaClient();

const isDatabaseUnavailableError = (error) => {
  if (!error) return false;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return /can't reach database server|database server at/i.test(String(error.message || ''));
};

// Validation middleware
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('role')
    .isIn(['owner', 'sales'])
    .withMessage('Invalid role specified. Only "owner" (admin) and "sales" (sales person) are allowed.'),
];

// Helper function to check validation errors
const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

// @route   POST /api/auth/login
// @desc    Login user and return JWT token
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Generate JWT token
    const userPayload = generateUserPayload(user);
    const token = generateToken(userPayload);

    // Return success response
    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, 'Login successful');

  } catch (error) {
    console.error('Login error:', error);
    if (isDatabaseUnavailableError(error)) {
      const details = process.env.NODE_ENV === 'development' ? String(error.message || '') : null;
      return sendError(res, 'Database is unavailable. Please start PostgreSQL and try again.', 503, details);
    }
    return sendError(res, 'Login failed. Please try again.', 500);
  }
});

// @route   POST /api/auth/register
// @desc    Register new user (admin only)
// @access  Private (Admin/Owner only)
router.post('/register', validateRegister, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { email, password, name, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return sendError(res, 'User with this email already exists', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        role,
      },
    });

    // Generate JWT token
    const userPayload = generateUserPayload(user);
    const token = generateToken(userPayload);

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, 'User registered successfully', 201);

  } catch (error) {
    console.error('Registration error:', error);
    return sendError(res, 'Registration failed. Please try again.', 500);
  }
});

// @route   GET /api/auth/verify
// @desc    Verify JWT token and return user data
// @access  Private
router.get('/verify', async (req, res) => {
  try {
    // Extract token from header
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return sendError(res, 'No token provided', 401);
    }

    // Verify token
    const { verifyToken } = require('../utils/jwt');
    const decoded = verifyToken(token);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    return sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, 'Token verified successfully');

  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid token', 401);
    } else if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    return sendError(res, 'Token verification failed', 500);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', (req, res) => {
  // Since JWT is stateless, logout is handled client-side
  // This endpoint serves as confirmation
  return sendSuccess(res, null, 'Logged out successfully');
});

// @route   GET /api/auth/users
// @desc    Get all users (admin only)
// @access  Private (Admin/Owner only)
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query; // Optional filter by role
    
    const whereClause = role ? { role } : {};
    
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, users, 'Users retrieved successfully');

  } catch (error) {
    console.error('Get users error:', error);
    return sendError(res, 'Failed to retrieve users', 500);
  }
});

// @route   GET /api/auth/users/:id
// @desc    Get user by ID
// @access  Private (Admin/Owner only)
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, user, 'User retrieved successfully');

  } catch (error) {
    console.error('Get user error:', error);
    return sendError(res, 'Failed to retrieve user', 500);
  }
});

// @route   PUT /api/auth/users/:id
// @desc    Update user
// @access  Private (Admin/Owner only)
router.put('/users/:id', [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('role')
    .optional()
    .isIn(['owner', 'sales'])
    .withMessage('Invalid role specified. Only "owner" (admin) and "sales" (sales person) are allowed.'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
], async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { id } = req.params;
    const { email, name, role, password } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return sendError(res, 'User not found', 404);
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (emailTaken) {
        return sendError(res, 'Email already in use', 400);
      }
    }

    // Prepare update data
    const updateData = {};
    if (email) updateData.email = email.toLowerCase();
    if (name) updateData.name = name.trim();
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return sendSuccess(res, user, 'User updated successfully');

  } catch (error) {
    console.error('Update user error:', error);
    return sendError(res, 'Failed to update user', 500);
  }
});

// @route   DELETE /api/auth/users/:id
// @desc    Delete user
// @access  Private (Owner only)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return sendError(res, 'User not found', 404);
    }

    // Prevent deleting owner role
    if (existingUser.role === 'owner') {
      return sendError(res, 'Cannot delete owner user', 400);
    }

    // Check if user has related data
    const hasCustomers = await prisma.customer.count({
      where: { salespersonId: id },
    });

    if (hasCustomers > 0) {
      return sendError(res, 'Cannot delete user with assigned customers. Please reassign customers first.', 400);
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'User deleted successfully');

  } catch (error) {
    console.error('Delete user error:', error);
    return sendError(res, 'Failed to delete user', 500);
  }
});

module.exports = router;