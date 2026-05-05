const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateProductionOrder = [
  body('processId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Process ID is required'),
  body('locationId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Location ID is required'),
  body('status')
    .optional()
    .isIn(['draft', 'submitted', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
];

const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

// @route   GET /api/production-orders
// @desc    Get all production orders
// @access  Private
router.get('/', authorize(['owner', 'production_manager', 'warehouse']), async (req, res) => {
  try {
    const { processId, status, fromDate, toDate } = req.query;
    
    const whereClause = {};
    if (processId) whereClause.processId = processId;
    if (status) whereClause.status = status;
    
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) whereClause.createdAt.gte = new Date(fromDate);
      if (toDate) whereClause.createdAt.lte = new Date(toDate);
    }

    const productionOrders = await prisma.productionOrder.findMany({
      where: whereClause,
      include: {
        process: {
          select: {
            id: true,
            name: true,
            stage: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            article: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, productionOrders, 'Production orders retrieved successfully');
  } catch (error) {
    console.error('Get production orders error:', error);
    return sendError(res, 'Failed to retrieve production orders', 500);
  }
});

// @route   GET /api/production-orders/:id
// @desc    Get production order by ID
// @access  Private
router.get('/:id', authorize(['owner', 'production_manager', 'warehouse']), async (req, res) => {
  try {
    const { id } = req.params;

    const productionOrder = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        process: true,
        location: true,
        items: {
          include: {
            article: true,
          },
        },
        materialIssues: {
          include: {
            items: {
              include: {
                article: true,
              },
            },
          },
        },
        materialReceipts: {
          include: {
            items: {
              include: {
                article: true,
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!productionOrder) {
      return sendError(res, 'Production order not found', 404);
    }

    return sendSuccess(res, productionOrder, 'Production order retrieved successfully');
  } catch (error) {
    console.error('Get production order error:', error);
    return sendError(res, 'Failed to retrieve production order', 500);
  }
});

// @route   POST /api/production-orders
// @desc    Create a new production order
// @access  Private
router.post('/', authorize(['owner', 'production_manager']), validateProductionOrder, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { processId, locationId, status, notes, items } = req.body;
    const userId = req.user.id;

    // Generate unique order number
    const orderNumber = `PO-${Date.now()}`;

    const productionOrder = await prisma.productionOrder.create({
      data: {
        orderNumber,
        processId,
        locationId,
        status: status || 'draft',
        notes: notes || null,
        createdBy: userId,
        items: {
          create: items?.map(item => ({
            articleId: item.articleId,
            inputQuantity: item.inputQuantity,
            expectedOutput: item.expectedOutput,
          })) || [],
        },
      },
      include: {
        process: true,
        location: true,
        items: {
          include: {
            article: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return sendSuccess(res, productionOrder, 'Production order created successfully', 201);
  } catch (error) {
    console.error('Create production order error:', error);
    return sendError(res, 'Failed to create production order', 500);
  }
});

// @route   PUT /api/production-orders/:id
// @desc    Update a production order
// @access  Private
router.put('/:id', authorize(['owner', 'production_manager']), validateProductionOrder, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { id } = req.params;
    const { processId, locationId, status, notes, startedAt, completedAt } = req.body;

    const productionOrder = await prisma.productionOrder.update({
      where: { id },
      data: {
        processId,
        locationId,
        status,
        notes,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
      },
      include: {
        process: true,
        location: true,
        items: {
          include: {
            article: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return sendSuccess(res, productionOrder, 'Production order updated successfully');
  } catch (error) {
    console.error('Update production order error:', error);
    return sendError(res, 'Failed to update production order', 500);
  }
});

// @route   DELETE /api/production-orders/:id
// @desc    Delete a production order
// @access  Private
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.productionOrder.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Production order deleted successfully');
  } catch (error) {
    console.error('Delete production order error:', error);
    return sendError(res, 'Failed to delete production order', 500);
  }
});

module.exports = router;
