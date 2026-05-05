const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient, Prisma } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const grnIdempotencyCache = new Map();

// Validation rules
const validateGRN = [
  body('poId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Purchase Order ID is required'),
  body('supplierId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Supplier ID is required'),
  body('receivedAt')
    .isISO8601()
    .withMessage('Received at must be a valid date'),
  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'cancelled'])
    .withMessage('Invalid status'),
];

const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

const pruneIdempotencyCache = () => {
  const now = Date.now();
  for (const [key, value] of grnIdempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      grnIdempotencyCache.delete(key);
    }
  }
};

const normalizeGrnItems = (items = []) =>
  items
    .filter((item) => Number(item.receivedQuantity || 0) > 0)
    .map((item) => ({
      articleId: item.articleId,
      receivedQuantity: Number(item.receivedQuantity || 0),
      lotNo: String(item.lotNo || '').trim(),
      unit: String(item.unit || '').trim(),
      packages: Number(item.packages || 0),
    }))
    .sort((a, b) => {
      if (a.articleId !== b.articleId) return a.articleId.localeCompare(b.articleId);
      return a.lotNo.localeCompare(b.lotNo);
    });

const grnSignature = (items = []) => JSON.stringify(normalizeGrnItems(items));

const recalculatePoReceiptStatus = async (tx, poId) => {
  const purchaseOrder = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true },
  });

  if (!purchaseOrder) {
    throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });
  }

  // Preserve manually cancelled POs.
  if (purchaseOrder.status === 'cancelled') {
    return purchaseOrder.status;
  }

  const grns = await tx.gRN.findMany({
    where: {
      poId,
      status: { in: ['pending', 'confirmed'] },
    },
    include: { items: true },
  });

  const receivedByArticle = {};
  grns.forEach((grn) => {
    grn.items.forEach((item) => {
      receivedByArticle[item.articleId] =
        (receivedByArticle[item.articleId] || 0) + Number(item.receivedQuantity || 0);
    });
  });

  const poItems = purchaseOrder.items || [];
  const hasAnyReceipt = poItems.some(
    (item) => Number(receivedByArticle[item.articleId] || 0) > 0
  );
  const isFullyReceived =
    poItems.length > 0 &&
    poItems.every(
      (item) => Number(receivedByArticle[item.articleId] || 0) >= Number(item.quantity || 0)
    );

  let nextStatus = purchaseOrder.status === 'approved' ? 'approved' : 'pending';
  if (isFullyReceived) {
    nextStatus = 'complete';
  } else if (hasAnyReceipt) {
    nextStatus = 'partially_received';
  }

  if (purchaseOrder.status !== nextStatus) {
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: nextStatus },
    });
  }

  return nextStatus;
};

// @route   GET /api/grns
// @desc    Get all GRNs
// @access  Private
router.get('/', authorize(['owner', 'warehouse', 'quality_inspector']), async (req, res) => {
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

    const grns = await prisma.gRN.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            address: true,
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
        receivedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, grns, 'GRNs retrieved successfully');
  } catch (error) {
    console.error('Get GRNs error:', error);
    return sendError(res, 'Failed to retrieve GRNs', 500);
  }
});

// @route   GET /api/grns/:id
// @desc    Get GRN by ID
// @access  Private
router.get('/:id', authorize(['owner', 'warehouse', 'quality_inspector']), async (req, res) => {
  try {
    const { id } = req.params;

    const grn = await prisma.gRN.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        items: {
          include: {
            article: true,
          },
        },
        receivedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
        inspection: {
          include: {
            items: {
              include: {
                article: true,
              },
            },
          },
        },
      },
    });

    if (!grn) {
      return sendError(res, 'GRN not found', 404);
    }

    return sendSuccess(res, grn, 'GRN retrieved successfully');
  } catch (error) {
    console.error('Get GRN error:', error);
    return sendError(res, 'Failed to retrieve GRN', 500);
  }
});

// @route   POST /api/grns
// @desc    Create a new GRN
// @access  Private
router.post('/', authorize(['owner', 'warehouse']), validateGRN, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { poId, supplierId, warehouseId, receivedAt, notes, items } = req.body;
    const userId = req.user.id;
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();

    pruneIdempotencyCache();
    if (idempotencyKey && grnIdempotencyCache.has(idempotencyKey)) {
      const cached = grnIdempotencyCache.get(idempotencyKey);
      return sendSuccess(res, cached.data, 'GRN created successfully', 201);
    }

    const receivedItems = (items || []).filter((item) => Number(item.receivedQuantity || 0) > 0);
    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      return sendError(res, 'At least one item with received quantity > 0 is required', 400);
    }
    if (receivedItems.some((item) => Number(item.receivedQuantity || 0) < 0)) {
      return sendError(res, 'Received quantity cannot be negative', 400);
    }

    const payloadSignature = grnSignature(receivedItems);
    const grn = await prisma.$transaction(
      async (tx) => {
        // Generate unique GRN number inside transaction scope.
        const grnNumber = `GRN-${Date.now()}`;

        const purchaseOrder = await tx.purchaseOrder.findUnique({
          where: { id: poId },
          include: { items: true },
        });

        if (!purchaseOrder) {
          throw Object.assign(new Error('Purchase Order not found'), { statusCode: 404 });
        }
        if (!['approved', 'partially_received'].includes(purchaseOrder.status)) {
          throw Object.assign(
            new Error(`Cannot create GRN for a purchase order with status '${purchaseOrder.status}'`),
            { statusCode: 400 }
          );
        }

        const poItemMap = new Map(
          purchaseOrder.items.map((item) => [item.articleId, Number(item.quantity || 0)])
        );
        const existingGrns = await tx.gRN.findMany({
          where: { poId, status: { in: ['pending', 'confirmed'] } },
          include: { items: true },
        });

        const now = new Date(receivedAt);
        const hasDuplicatePayload = existingGrns.some((existing) => {
          const withinWindow = Math.abs(now.getTime() - new Date(existing.receivedAt).getTime()) <= IDEMPOTENCY_TTL_MS;
          return (
            withinWindow &&
            existing.supplierId === supplierId &&
            String(existing.warehouseId || '') === String(warehouseId || '') &&
            grnSignature(existing.items) === payloadSignature
          );
        });
        if (hasDuplicatePayload) {
          throw Object.assign(new Error('Duplicate GRN request detected. Please refresh and verify before retrying.'), { statusCode: 409 });
        }

        const alreadyReceivedByArticle = {};
        existingGrns.forEach((existing) => {
          existing.items.forEach((item) => {
            alreadyReceivedByArticle[item.articleId] =
              (alreadyReceivedByArticle[item.articleId] || 0) + Number(item.receivedQuantity || 0);
          });
        });

        for (const item of receivedItems) {
          const orderedQty = poItemMap.get(item.articleId);
          if (orderedQty == null) {
            throw Object.assign(new Error('One or more GRN items are not part of the selected Purchase Order.'), { statusCode: 400 });
          }
          const remaining = orderedQty - Number(alreadyReceivedByArticle[item.articleId] || 0);
          if (Number(item.receivedQuantity) > remaining) {
            throw Object.assign(
              new Error(`Received quantity exceeds remaining quantity for article ${item.articleId}. Remaining: ${remaining}`),
              { statusCode: 400 }
            );
          }
        }

        const createdGrn = await tx.gRN.create({
          data: {
            grnNumber,
            poId,
            supplierId,
            warehouseId: warehouseId || null,
            receivedAt: new Date(receivedAt),
            receivedBy: userId,
            status: 'pending',
            notes: notes || null,
            items: {
              create: receivedItems.map((item) => ({
                articleId: item.articleId,
                orderedQuantity: item.orderedQuantity,
                receivedQuantity: item.receivedQuantity,
                acceptedQuantity: item.receivedQuantity,
                rejectedQuantity: 0,
                packages: item.packages ?? null,
                unit: item.unit || null,
                lotNo: item.lotNo || null,
                remarks: item.remarks || null,
              })),
            },
          },
          include: {
            supplier: true,
            warehouse: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
            items: {
              include: {
                article: true,
              },
            },
            receivedByUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        await recalculatePoReceiptStatus(tx, poId);

        return createdGrn;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (idempotencyKey) {
      grnIdempotencyCache.set(idempotencyKey, { data: grn, timestamp: Date.now() });
    }

    return sendSuccess(res, grn, 'GRN created successfully', 201);
  } catch (error) {
    console.error('Create GRN error:', error);
    const statusCode = Number(error?.statusCode || 500);
    return sendError(res, error?.message || 'Failed to create GRN', statusCode);
  }
});

// @route   PATCH /api/grns/:id/confirm
// @desc    Confirm a GRN, update stock, and post to vendor ledger
// @access  Private (Owner only)
router.patch('/:id/confirm', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Get the GRN
    const grn = await prisma.gRN.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!grn) {
      return sendError(res, 'GRN not found', 404);
    }

    if (grn.status === 'confirmed') {
      return sendError(res, 'This GRN is already confirmed', 400);
    }

    // Get the purchase order for pricing info
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: grn.poId },
      include: { items: true },
    });

    if (!purchaseOrder) {
      return sendError(res, 'Purchase Order not found', 404);
    }

    // 2. Perform the side effects in a transaction
    const confirmedGrn = await prisma.$transaction(async (prisma) => {
      // Update GRN status
      const updatedGrn = await prisma.gRN.update({
        where: { id },
        data: { status: 'confirmed' },
        include: {
          supplier: true,
          warehouse: true,
          items: { include: { article: true } },
          receivedByUser: true,
        },
      });

      // Stock Updates
      if (grn.warehouseId && grn.items.length > 0) {
        for (const item of grn.items) {
          if (item.receivedQuantity > 0) {
            const article = await prisma.article.findUnique({
              where: { id: item.articleId },
            });

            if (!article) continue;

            let stage = 'FG';
            if (article.category === 'grey_material' || article.category === 'packaging_material') {
              stage = 'RM';
            } else if (article.category === 'finished_goods') {
              stage = 'FG';
            }

            const poItem = purchaseOrder.items.find(pi => pi.articleId === item.articleId);
            const pricePerUnit = poItem ? poItem.pricePerUnit : (article.cost || 0);

            const existingStock = await prisma.stockItem.findFirst({
              where: {
                articleId: item.articleId,
                locationId: grn.warehouseId,
                stage: stage,
                ...(item.lotNo ? { lotNo: item.lotNo } : {}),
              }
            });

            if (existingStock) {
              await prisma.stockItem.update({
                where: { id: existingStock.id },
                data: {
                  quantity: { increment: item.receivedQuantity },
                  lotNo: existingStock.lotNo || item.lotNo || null,
                }
              });
            } else {
              await prisma.stockItem.create({
                data: {
                  articleId: item.articleId,
                  locationId: grn.warehouseId,
                  quantity: item.receivedQuantity,
                  pricePerUnit: pricePerUnit,
                  stage: stage,
                  lotNo: item.lotNo || null,
                }
              });
            }
          }
        }
      }

      await recalculatePoReceiptStatus(prisma, grn.poId);

      // Vendor Ledger Entry
      let grnTotalValue = 0;
      grn.items.forEach(item => {
        const poItem = purchaseOrder.items.find(pi => pi.articleId === item.articleId);
        const pricePerUnit = poItem ? poItem.pricePerUnit : 0;
        grnTotalValue += (item.receivedQuantity * pricePerUnit);
      });

      if (grnTotalValue > 0) {
        const previousEntries = await prisma.vendorLedger.findMany({
          where: { supplierId: grn.supplierId, date: { lte: new Date(grn.receivedAt) } },
          orderBy: [
            { date: 'asc' },
            { createdAt: 'asc' },
          ],
        });

        let runningBalance = 0;
        previousEntries.forEach(entry => {
          runningBalance += entry.entryType === 'credit' ? entry.amount : -entry.amount;
        });

        const newBalance = runningBalance + grnTotalValue;

        await prisma.vendorLedger.create({
          data: {
            supplierId: grn.supplierId,
            entryType: 'credit',
            amount: grnTotalValue,
            balance: newBalance,
            referenceType: 'grn',
            referenceId: updatedGrn.id,
            referenceNumber: updatedGrn.grnNumber,
            description: `Goods Received - ${updatedGrn.grnNumber}`,
            date: new Date(grn.receivedAt),
            createdBy: userId
          }
        });
      }

      return updatedGrn;
    });

    return sendSuccess(res, confirmedGrn, 'GRN confirmed successfully', 200);
  } catch (error) {
    console.error('Confirm GRN error:', error);
    return sendError(res, 'Failed to confirm GRN', 500);
  }
});

// @route   PUT /api/grns/:id
// @desc    Update a GRN
// @access  Private
router.put('/:id', authorize(['owner', 'warehouse']), validateGRN, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return validationError;

    const { id } = req.params;
    const { poId, supplierId, warehouseId, receivedAt, status, notes } = req.body;

    const grn = await prisma.gRN.update({
      where: { id },
      data: {
        poId,
        supplierId,
        warehouseId: warehouseId !== undefined ? (warehouseId || null) : undefined,
        receivedAt: new Date(receivedAt),
        status,
        notes,
      },
      include: {
        supplier: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        items: {
          include: {
            article: true,
          },
        },
        receivedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return sendSuccess(res, grn, 'GRN updated successfully');
  } catch (error) {
    console.error('Update GRN error:', error);
    return sendError(res, 'Failed to update GRN', 500);
  }
});

// @route   DELETE /api/grns/:id
// @desc    Delete a GRN
// @access  Private
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.gRN.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'GRN deleted successfully');
  } catch (error) {
    console.error('Delete GRN error:', error);
    return sendError(res, 'Failed to delete GRN', 500);
  }
});

// @route   PATCH /api/grns/:id/cancel
// @desc    Cancel a pending GRN
// @access  Private (owner only)
router.patch('/:id/cancel', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    const grn = await prisma.gRN.findUnique({ where: { id } });
    
    if (!grn) {
      return sendError(res, 'GRN not found', 404);
    }

    if (grn.status !== 'pending') {
      return sendError(res, `Cannot cancel a GRN with status '${grn.status}'`, 400);
    }

    const updatedGrn = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.gRN.update({
        where: { id },
        data: {
          status: 'cancelled',
        },
      });

      await recalculatePoReceiptStatus(tx, grn.poId);

      return cancelled;
    });

    return sendSuccess(res, updatedGrn, 'GRN cancelled successfully');
  } catch (error) {
    console.error('Cancel GRN error:', error);
    return sendError(res, 'Failed to cancel GRN', 500);
  }
});

module.exports = router;
