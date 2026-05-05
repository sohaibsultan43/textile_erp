const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const buildPoNumber = async (dateStr, sequenceOffset = 0) => {
  const latestTodayPo = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: `PO-${dateStr}-` } },
    select: { poNumber: true },
    orderBy: { poNumber: 'desc' },
  });

  let nextSequence = 1 + sequenceOffset;
  if (latestTodayPo?.poNumber) {
    const lastSegment = latestTodayPo.poNumber.split('-').pop();
    const parsed = Number(lastSegment);
    if (Number.isFinite(parsed)) {
      nextSequence = parsed + 1 + sequenceOffset;
    }
  }

  return `PO-${dateStr}-${String(nextSequence).padStart(3, '0')}`;
};

// Validation rules
const validatePurchaseOrder = [
  body('supplierId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Supplier ID is required'),
  body('totalAmount')
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number'),
  body('promiseDeliveryDays')
    .isInt({ min: 0 })
    .withMessage('Promise delivery days must be a positive integer'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'partially_received', 'complete', 'cancelled'])
    .withMessage('Invalid status'),
];

const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("PO Validation Failed:", JSON.stringify(errors.array(), null, 2));
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

const validateScheduleTotals = (items = []) => {
  for (const item of items || []) {
    const scheduledQty = (item.deliverySchedules || []).reduce((sum, schedule) => sum + (Number(schedule.quantity) || 0), 0);
    if (scheduledQty > Number(item.quantity || 0)) {
      return {
        valid: false,
        message: `Delivery schedule quantity cannot exceed ordered quantity for article ${item.articleId}`,
      };
    }
  }

  return { valid: true };
};

// @route   GET /api/purchase-orders
// @desc    Get all purchase orders
// @access  Private
router.get('/', authorize(['owner', 'purchase_officer', 'warehouse']), async (req, res) => {
  try {
    const { supplierId, status, fromDate, toDate } = req.query;

    const whereClause = {};
    if (supplierId) whereClause.supplierId = supplierId;
    if (status) whereClause.status = status;

    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) whereClause.createdAt.gte = new Date(fromDate);
      if (toDate) whereClause.createdAt.lte = new Date(toDate);
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
          },
        },
        items: {
          include: {
            article: {
              select: {
                id: true,
                name: true,
                unit: true,
                yarnCount: true,
                constraction: true,
                composition: true,
                width: true,
              },
            },
            deliverySchedules: true,
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

    return sendSuccess(res, purchaseOrders, 'Purchase orders retrieved successfully');
  } catch (error) {
    console.error('Get purchase orders error:', error);
    return sendError(res, 'Failed to retrieve purchase orders', 500);
  }
});

// @route   GET /api/purchase-orders/:id
// @desc    Get purchase order by ID
// @access  Private
router.get('/:id', authorize(['owner', 'purchase_officer', 'warehouse']), async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            article: true,
            deliverySchedules: true,
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

    if (!purchaseOrder) {
      return sendError(res, 'Purchase order not found', 404);
    }

    return sendSuccess(res, purchaseOrder, 'Purchase order retrieved successfully');
  } catch (error) {
    console.error('Get purchase order error:', error);
    return sendError(res, 'Failed to retrieve purchase order', 500);
  }
});

// @route   POST /api/purchase-orders
// @desc    Create a new purchase order
// @access  Private
router.post('/', authorize(['owner', 'purchase_officer']), validatePurchaseOrder, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { supplierId, transactionDate, totalAmount, promiseDeliveryDays, status, notes, items } = req.body;
    const userId = req.user.id;

    const scheduleValidation = validateScheduleTotals(items);
    if (!scheduleValidation.valid) {
      return sendError(res, scheduleValidation.message, 400);
    }

    // Generate PO number for today (e.g., PO-20231124-001)
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    let purchaseOrder = null;
    let lastCreateError = null;
    const maxCreateAttempts = 5;

    for (let attempt = 0; attempt < maxCreateAttempts; attempt += 1) {
      const poNumber = await buildPoNumber(dateStr, attempt);
      try {
        purchaseOrder = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            supplierId,
            ...(transactionDate ? { createdAt: new Date(transactionDate) } : {}),
            totalAmount,
            promiseDeliveryDays,
            status: status || 'pending',
            notes: notes || null,
            createdBy: userId,
            items: {
              create: items?.map(item => ({
                articleId: item.articleId,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                totalPrice: item.quantity * item.pricePerUnit,
                yarnCount: item.yarnCount || null,
                composition: item.composition || null,
                constraction: item.constraction || null,
                width: item.width || null,
                expectedDeliveryDate: item.expectedDeliveryDate ? new Date(item.expectedDeliveryDate) : null,
                deliverySchedules: {
                  create: item.deliverySchedules?.map(schedule => ({
                    quantity: schedule.quantity,
                    pickDate: new Date(schedule.pickDate),
                  })) || [],
                },
              })) || [],
            },
          },
          include: {
            supplier: true,
            items: {
              include: {
                article: true,
                deliverySchedules: true,
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
        break;
      } catch (createError) {
        lastCreateError = createError;
        if (createError?.code !== 'P2002') {
          throw createError;
        }
      }
    }

    if (!purchaseOrder) {
      throw lastCreateError || new Error('Unable to generate a unique purchase order number');
    }

    return sendSuccess(res, purchaseOrder, 'Purchase order created successfully', 201);
  } catch (error) {
    console.error('Create purchase order error:', error);
    return sendError(res, 'Failed to create purchase order', 500);
  }
});

// @route   PUT /api/purchase-orders/:id
// @desc    Update a purchase order
// @access  Private
router.put('/:id', authorize(['owner', 'purchase_officer']), validatePurchaseOrder, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { id } = req.params;
    const { supplierId, transactionDate, totalAmount, promiseDeliveryDays, status, notes, items } = req.body;

    const scheduleValidation = validateScheduleTotals(items);
    if (!scheduleValidation.valid) {
      return sendError(res, scheduleValidation.message, 400);
    }

    // Fetch existing PO to check its status
    const existingPO = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existingPO) {
      return sendError(res, 'Purchase order not found', 404);
    }
    if (existingPO.status !== 'pending') {
      return sendError(res, `Cannot edit purchase order with status '${existingPO.status}'`, 400);
    }

    // Check if any GRNs exist for this PO
    const grnCount = await prisma.gRN.count({ where: { poId: id } });
    if (grnCount > 0) {
      return sendError(res, 'Cannot edit purchase order: GRNs have already been created for it', 400);
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId,
        ...(transactionDate ? { createdAt: new Date(transactionDate) } : {}),
        totalAmount,
        promiseDeliveryDays,
        status,
        notes,
        items: {
          deleteMany: {}, // Delete all existing items (cascade deletes schedules)
          create: items?.map(item => ({
            articleId: item.articleId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.quantity * item.pricePerUnit,
            yarnCount: item.yarnCount || null,
            composition: item.composition || null,
            constraction: item.constraction || null,
            width: item.width || null,
            expectedDeliveryDate: item.expectedDeliveryDate ? new Date(item.expectedDeliveryDate) : null,
            deliverySchedules: {
              create: item.deliverySchedules?.map(schedule => ({
                quantity: schedule.quantity,
                pickDate: new Date(schedule.pickDate),
              })) || [],
            },
          })) || [],
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            article: true,
            deliverySchedules: true,
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

    return sendSuccess(res, purchaseOrder, 'Purchase order updated successfully');
  } catch (error) {
    console.error('Update purchase order error:', error);
    return sendError(res, 'Failed to update purchase order', 500);
  }
});

// @route   PATCH /api/purchase-orders/:id/confirm
// @desc    Approve a pending purchase order (admin only)
// @access  Private (owner only)
router.patch('/:id/confirm', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if PO exists and is pending
    const existingPO = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existingPO) {
      return sendError(res, 'Purchase order not found', 404);
    }
    if (existingPO.status !== 'pending') {
      return sendError(res, `Cannot confirm a purchase order with status '${existingPO.status}'`, 400);
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        supplier: true,
        items: {
          include: {
            article: true,
            deliverySchedules: true,
          },
        },
        createdByUser: {
          select: { id: true, name: true },
        },
        approvedByUser: {
          select: { id: true, name: true },
        },
      },
    });

    return sendSuccess(res, purchaseOrder, 'Purchase order approved successfully');
  } catch (error) {
    console.error('Confirm purchase order error:', error);
    return sendError(res, 'Failed to confirm purchase order', 500);
  }
});

// @route   PATCH /api/purchase-orders/:id/cancel
// @desc    Cancel a pending purchase order
// @access  Private (owner only)
router.patch('/:id/cancel', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if PO exists and is pending
    const existingPO = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existingPO) {
      return sendError(res, 'Purchase order not found', 404);
    }
    if (existingPO.status !== 'pending') {
      return sendError(res, `Cannot cancel a purchase order with status '${existingPO.status}'`, 400);
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        supplier: true,
        items: {
          include: {
            article: true,
            deliverySchedules: true,
          },
        },
        createdByUser: {
          select: { id: true, name: true },
        },
        approvedByUser: {
          select: { id: true, name: true },
        },
      },
    });

    return sendSuccess(res, purchaseOrder, 'Purchase order cancelled successfully');
  } catch (error) {
    console.error('Cancel purchase order error:', error);
    return sendError(res, 'Failed to cancel purchase order', 500);
  }
});

// @route   DELETE /api/purchase-orders/:id
// @desc    Delete a purchase order
// @access  Private
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.purchaseOrder.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Purchase order deleted successfully');
  } catch (error) {
    console.error('Delete purchase order error:', error);
    return sendError(res, 'Failed to delete purchase order', 500);
  }
});

module.exports = router;
