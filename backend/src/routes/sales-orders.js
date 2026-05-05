const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateSaleOrder = [
  body('customerId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Customer ID is required'),
  body('locationId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Location ID is required'),
  body('totalAmount')
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'completed', 'rejected', 'cancelled'])
    .withMessage('Invalid status'),
  body('paymentType')
    .optional()
    .isIn(['cash', 'credit'])
    .withMessage('Payment type must be cash or credit'),
];

const validateSaleOrderItem = [
  body('saleOrderId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Sale order ID is required'),
  body('articleId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Article ID is required'),
  body('quantity')
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('pricePerUnit')
    .isFloat({ min: 0 })
    .withMessage('Price per unit must be a positive number'),
];

const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

// @route   GET /api/sales-orders
// @desc    Get all sale orders
// @access  Private
router.get('/', authorize(['owner', 'sales', 'finance']), async (req, res) => {
  try {
    const { customerId, status, fromDate, toDate } = req.query;
    
    const whereClause = {};
    if (customerId) whereClause.customerId = customerId;
    if (status) whereClause.status = status;
    
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) whereClause.createdAt.gte = new Date(fromDate);
      if (toDate) whereClause.createdAt.lte = new Date(toDate);
    }

    const saleOrders = await prisma.saleOrder.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            city: true,
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

    return sendSuccess(res, saleOrders, 'Sale orders retrieved successfully');
  } catch (error) {
    console.error('Get sale orders error:', error);
    return sendError(res, 'Failed to retrieve sale orders', 500);
  }
});

// @route   GET /api/sales-orders/:id
// @desc    Get sale order by ID
// @access  Private
router.get('/:id', authorize(['owner', 'sales', 'finance']), async (req, res) => {
  try {
    const { id } = req.params;

    const saleOrder = await prisma.saleOrder.findUnique({
      where: { id },
      include: {
        customer: true,
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
        approvedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!saleOrder) {
      return sendError(res, 'Sale order not found', 404);
    }

    return sendSuccess(res, saleOrder, 'Sale order retrieved successfully');
  } catch (error) {
    console.error('Get sale order error:', error);
    return sendError(res, 'Failed to retrieve sale order', 500);
  }
});

// @route   POST /api/sales-orders
// @desc    Create a new sale order
// @access  Private
router.post('/', authorize(['owner', 'sales']), validateSaleOrder, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { customerId, locationId, totalAmount, status, paymentType, items } = req.body;
    const userId = req.user.id;

    // Generate unique order number
    const orderNumber = `SO-${Date.now()}`;

    const saleOrder = await prisma.saleOrder.create({
      data: {
        orderNumber,
        customerId,
        locationId,
        totalAmount,
        status: status || 'pending',
        paymentType: paymentType || 'credit',
        createdBy: userId,
        items: {
          create: items?.map(item => ({
            articleId: item.articleId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.quantity * item.pricePerUnit,
          })) || [],
        },
      },
      include: {
        customer: true,
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

    return sendSuccess(res, saleOrder, 'Sale order created successfully', 201);
  } catch (error) {
    console.error('Create sale order error:', error);
    return sendError(res, 'Failed to create sale order', 500);
  }
});

// @route   PUT /api/sales-orders/:id
// @desc    Update a sale order
// @access  Private
router.put('/:id', authorize(['owner', 'sales']), validateSaleOrder, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { id } = req.params;
    const { customerId, locationId, totalAmount, status, paymentType } = req.body;

    const saleOrder = await prisma.saleOrder.update({
      where: { id },
      data: {
        customerId,
        locationId,
        totalAmount,
        status,
        paymentType,
      },
      include: {
        customer: true,
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

    return sendSuccess(res, saleOrder, 'Sale order updated successfully');
  } catch (error) {
    console.error('Update sale order error:', error);
    return sendError(res, 'Failed to update sale order', 500);
  }
});

// @route   DELETE /api/sales-orders/:id
// @desc    Delete a sale order
// @access  Private
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.saleOrder.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Sale order deleted successfully');
  } catch (error) {
    console.error('Delete sale order error:', error);
    return sendError(res, 'Failed to delete sale order', 500);
  }
});

module.exports = router;
