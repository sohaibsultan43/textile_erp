const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateConfig = [
  body('key')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Config key is required'),
  body('value')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Config value is required'),
  body('category')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Config category is required'),
];

// Helper function to check validation errors
const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

// @route   GET /api/config
// @desc    Get all system configurations
// @access  Private (Owner only)
router.get('/', authorize(['owner']), async (req, res) => {
  try {
    const { category } = req.query;
    
    const whereClause = category ? { category } : {};

    const configs = await prisma.systemConfig.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });

    // Group configs by category
    const groupedConfigs = configs.reduce((acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = [];
      }
      acc[config.category].push(config);
      return acc;
    }, {});

    return sendSuccess(res, groupedConfigs, 'System configurations retrieved successfully');
  } catch (error) {
    console.error('Get configs error:', error);
    return sendError(res, 'Failed to retrieve system configurations', 500);
  }
});

// @route   GET /api/config/:key
// @desc    Get specific configuration by key
// @access  Private (Owner only)
router.get('/:key', authorize(['owner']), async (req, res) => {
  try {
    const { key } = req.params;

    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return sendError(res, 'Configuration not found', 404);
    }

    return sendSuccess(res, config, 'Configuration retrieved successfully');
  } catch (error) {
    console.error('Get config error:', error);
    return sendError(res, 'Failed to retrieve configuration', 500);
  }
});

// @route   POST /api/config
// @desc    Create new system configuration
// @access  Private (Owner only)
router.post('/', authorize(['owner']), validateConfig, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { key, value, category } = req.body;

    const config = await prisma.systemConfig.create({
      data: {
        key: key.trim(),
        value: value.trim(),
        category: category.trim(),
      },
    });

    return sendSuccess(res, config, 'Configuration created successfully', 201);
  } catch (error) {
    console.error('Create config error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Configuration with this key already exists', 400);
    }
    return sendError(res, 'Failed to create configuration', 500);
  }
});

// @route   PUT /api/config/:key
// @desc    Update system configuration
// @access  Private (Owner only)
router.put('/:key', authorize(['owner']), validateConfig, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { key } = req.params;
    const { value, category } = req.body;

    // Check if config exists
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!existingConfig) {
      return sendError(res, 'Configuration not found', 404);
    }

    const config = await prisma.systemConfig.update({
      where: { key },
      data: {
        value: value.trim(),
        category: category.trim(),
      },
    });

    return sendSuccess(res, config, 'Configuration updated successfully');
  } catch (error) {
    console.error('Update config error:', error);
    return sendError(res, 'Failed to update configuration', 500);
  }
});

// @route   DELETE /api/config/:key
// @desc    Delete system configuration
// @access  Private (Owner only)
router.delete('/:key', authorize(['owner']), async (req, res) => {
  try {
    const { key } = req.params;

    // Check if config exists
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!existingConfig) {
      return sendError(res, 'Configuration not found', 404);
    }

    await prisma.systemConfig.delete({
      where: { key },
    });

    return sendSuccess(res, null, 'Configuration deleted successfully');
  } catch (error) {
    console.error('Delete config error:', error);
    return sendError(res, 'Failed to delete configuration', 500);
  }
});

// @route   POST /api/config/bulk
// @desc    Bulk update system configurations
// @access  Private (Owner only)
router.post('/bulk', authorize(['owner']), async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return sendError(res, 'Configs must be an array', 400);
    }

    const results = [];
    
    for (const configData of configs) {
      try {
        const { key, value, category } = configData;
        
        if (!key || !value || !category) {
          results.push({
            key,
            success: false,
            error: 'Key, value, and category are required'
          });
          continue;
        }

        const config = await prisma.systemConfig.upsert({
          where: { key },
          update: {
            value: value.trim(),
            category: category.trim(),
          },
          create: {
            key: key.trim(),
            value: value.trim(),
            category: category.trim(),
          },
        });

        results.push({
          key,
          success: true,
          config
        });
      } catch (error) {
        results.push({
          key: configData.key,
          success: false,
          error: error.message
        });
      }
    }

    return sendSuccess(res, results, 'Bulk configuration update completed');
  } catch (error) {
    console.error('Bulk config update error:', error);
    return sendError(res, 'Failed to update configurations', 500);
  }
});

// @route   GET /api/config/categories/list
// @desc    Get list of all configuration categories
// @access  Private (Owner only)
router.get('/categories/list', authorize(['owner']), async (req, res) => {
  try {
    const categories = await prisma.systemConfig.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
    });

    const categoryList = categories.map(c => c.category);

    return sendSuccess(res, categoryList, 'Configuration categories retrieved successfully');
  } catch (error) {
    console.error('Get config categories error:', error);
    return sendError(res, 'Failed to retrieve configuration categories', 500);
  }
});

module.exports = router;