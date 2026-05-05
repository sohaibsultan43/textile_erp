const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateStockItem = [
  body('articleId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Article ID is required'),
  body('locationId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Location ID is required'),
  body('quantity')
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('pricePerUnit')
    .isFloat({ min: 0 })
    .withMessage('Price per unit must be a positive number'),
  body('stage')
    .optional()
    .isIn(['RM', 'WIP', 'FG'])
    .withMessage('Stage must be RM, WIP, or FG'),
];

// Helper function to check validation errors
const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

const parseDateBoundary = (dateStr, boundary) => {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  if (boundary === 'start') {
    parsed.setHours(0, 0, 0, 0);
  } else {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
};

// @route   GET /api/stock
// @desc    Get all stock items
// @access  Private
router.get('/', authorize(['owner', 'warehouse', 'inventory_controller', 'sales']), async (req, res) => {
  try {
    const { locationId, articleId, stage } = req.query;
    
    const whereClause = {};
    if (locationId) whereClause.locationId = locationId;
    if (articleId) whereClause.articleId = articleId;
    if (stage) whereClause.stage = stage;

    const stockItems = await prisma.stockItem.findMany({
      where: whereClause,
      include: {
        article: {
          select: {
            name: true,
            fabricType: true,
            color: true,
            grade: true,
            lotNumber: true,
            unit: true,
            cost: true,
            salePrice: true,
            yarnCount: true,
            constraction: true,
            composition: true,
            width: true,
          },
        },
        location: {
          select: {
            name: true,
            type: true,
            address: true,
          },
        },
      },
      orderBy: [
        { location: { name: 'asc' } },
        { article: { name: 'asc' } },
      ],
    });

    return sendSuccess(res, stockItems, 'Stock items retrieved successfully');
  } catch (error) {
    console.error('Get stock error:', error);
    return sendError(res, 'Failed to retrieve stock items', 500);
  }
});

// @route   GET /api/stock/ledger/:articleId
// @desc    Get ledger-style movements for an article (GRN receipts and stock snapshot)
// @access  Private
router.get('/ledger/:articleId', authorize(['owner', 'warehouse', 'inventory_controller', 'sales']), async (req, res) => {
  try {
    const { articleId } = req.params;
    const { locationId, from, to, search } = req.query;

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        name: true,
        unit: true,
      },
    });

    if (!article) {
      return sendError(res, 'Article not found', 404);
    }

    const fromDate = parseDateBoundary(from, 'start');
    const toDate = parseDateBoundary(to, 'end');

    const dateFilter = {};
    if (fromDate) dateFilter.gte = fromDate;
    if (toDate) dateFilter.lte = toDate;

    const whereClause = {
      articleId,
      ...(locationId && { locationId }),
    };

    // Simplified ledger entries from GRN items
    const grnEntries = await prisma.gRNItem.findMany({
      where: {
        articleId,
        grn: {
          status: 'confirmed',
          ...(locationId && { warehouseId: locationId }),
          ...(Object.keys(dateFilter).length > 0 && { receivedAt: dateFilter }),
        },
      },
      include: {
        grn: {
          include: {
            supplier: true,
            warehouse: true,
          },
        },
      },
      orderBy: { grn: { receivedAt: 'asc' } },
    });

    // Simplified ledger entries from Sale Order items (as an example of 'out' movement)
    const saleEntries = await prisma.saleOrderItem.findMany({
      where: {
        articleId,
        saleOrder: {
          status: 'completed',
          ...(locationId && { locationId }),
          ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
        },
      },
      include: {
        saleOrder: {
          include: {
            customer: true,
            location: true,
          },
        },
      },
      orderBy: { saleOrder: { updatedAt: 'asc' } },
    });

    const ledger = [
      ...grnEntries.map(item => ({
        id: item.id,
        date: item.grn.receivedAt,
        reference: item.grn.grnNumber,
        referenceNumber: item.grn.grnNumber,
        type: 'Receipt',
        location: item.grn.warehouse?.name || 'N/A',
        locationName: item.grn.warehouse?.name || 'N/A',
        quantityIn: item.acceptedQuantity,
        qtyIn: item.acceptedQuantity,
        quantityOut: 0,
        qtyOut: 0,
        value: item.acceptedQuantity * (item.pricePerUnit || 0),
        pricePerUnit: item.pricePerUnit,
        notes: `From ${item.grn.supplier.name}`,
        remarks: `From ${item.grn.supplier.name}`,
        supplierName: item.grn.supplier.name,
      })),
      ...saleEntries.map(item => ({
        id: item.id,
        date: item.saleOrder.updatedAt,
        reference: item.saleOrder.orderNumber,
        referenceNumber: item.saleOrder.orderNumber,
        type: 'Issue',
        location: item.saleOrder.location.name,
        locationName: item.saleOrder.location.name,
        quantityIn: 0,
        qtyIn: 0,
        quantityOut: item.quantity,
        qtyOut: item.quantity,
        value: item.quantity * item.pricePerUnit,
        pricePerUnit: item.pricePerUnit,
        notes: `To ${item.saleOrder.customer.name}`,
        remarks: `To ${item.saleOrder.customer.name}`,
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Apply search filter
    const filteredLedger = search
      ? ledger.filter(entry =>
          Object.values(entry).some(val =>
            String(val).toLowerCase().includes(search.toLowerCase())
          )
        )
      : ledger;

    const totalReceived = filteredLedger.reduce((acc, item) => acc + (item.qtyIn || 0), 0);
    const totalIssued = filteredLedger.reduce((acc, item) => acc + (item.qtyOut || 0), 0);
    const netMovement = totalReceived - totalIssued;

    const stockSnapshot = await prisma.stockItem.findFirst({
      where: {
        articleId,
        ...(locationId && { locationId }),
      },
      select: { quantity: true },
    });

    return sendSuccess(res, {
      article: {
        id: article.id,
        name: article.name,
        unit: article.unit,
      },
      entries: filteredLedger,
      summary: {
        totalIn: totalReceived,
        totalReceived: totalReceived,
        totalOut: totalIssued,
        totalIssued: totalIssued,
        net: netMovement,
        netMovement: netMovement,
        currentStock: stockSnapshot?.quantity || 0,
        stockByLocation: [],
      },
    });
  } catch (error) {
    console.error('Get article ledger error:', error);
    return sendError(res, 'Failed to retrieve article ledger', 500);
  }
});

// @route   GET /api/stock/:id
// @desc    Get stock item by ID
// @access  Private
router.get('/:id', authorize(['owner', 'warehouse', 'inventory_controller', 'sales']), async (req, res) => {
  try {
    const { id } = req.params;

    const stockItem = await prisma.stockItem.findUnique({
      where: { id },
      include: {
        article: true,
        location: true,
      },
    });

    if (!stockItem) {
      return sendError(res, 'Stock item not found', 404);
    }

    return sendSuccess(res, stockItem, 'Stock item retrieved successfully');
  } catch (error) {
    console.error('Get stock item error:', error);
    return sendError(res, 'Failed to retrieve stock item', 500);
  }
});

// @route   POST /api/stock
// @desc    Create new stock item
// @access  Private
router.post('/', authorize(['owner', 'warehouse', 'inventory_controller']), validateStockItem, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { 
      articleId, 
      locationId, 
      quantity, 
      pricePerUnit, 
      stage = 'FG',
      batchNumber,
      processId,
      lotNo,
      shade,
      thanId,
      meterEquivalent,
      isLoose = false,
      isCutPiece = false
    } = req.body;

    // Verify article and location exist
    const [article, location] = await Promise.all([
      prisma.article.findUnique({ where: { id: articleId } }),
      prisma.location.findUnique({ where: { id: locationId } })
    ]);

    if (!article) {
      return sendError(res, 'Article not found', 400);
    }

    if (!location) {
      return sendError(res, 'Location not found', 400);
    }

    const stockItem = await prisma.stockItem.create({
      data: {
        articleId,
        locationId,
        quantity: parseFloat(quantity),
        pricePerUnit: parseFloat(pricePerUnit),
        stage,
        batchNumber,
        processId,
        lotNo,
        shade,
        thanId,
        meterEquivalent: meterEquivalent ? parseFloat(meterEquivalent) : null,
        isLoose,
        isCutPiece,
      },
      include: {
        article: true,
        location: true,
      },
    });

    return sendSuccess(res, stockItem, 'Stock item created successfully', 201);
  } catch (error) {
    console.error('Create stock item error:', error);
    return sendError(res, 'Failed to create stock item', 500);
  }
});

// @route   PUT /api/stock/:id
// @desc    Update stock item
// @access  Private
router.put('/:id', authorize(['owner', 'warehouse', 'inventory_controller']), validateStockItem, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { id } = req.params;
    const { 
      articleId, 
      locationId, 
      quantity, 
      pricePerUnit, 
      stage,
      batchNumber,
      processId,
      lotNo,
      shade,
      thanId,
      meterEquivalent,
      isLoose,
      isCutPiece
    } = req.body;

    // Check if stock item exists
    const existingItem = await prisma.stockItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return sendError(res, 'Stock item not found', 404);
    }

    // Verify article and location exist
    const [article, location] = await Promise.all([
      prisma.article.findUnique({ where: { id: articleId } }),
      prisma.location.findUnique({ where: { id: locationId } })
    ]);

    if (!article) {
      return sendError(res, 'Article not found', 400);
    }

    if (!location) {
      return sendError(res, 'Location not found', 400);
    }

    const stockItem = await prisma.stockItem.update({
      where: { id },
      data: {
        articleId,
        locationId,
        quantity: parseFloat(quantity),
        pricePerUnit: parseFloat(pricePerUnit),
        stage: stage || existingItem.stage,
        batchNumber: batchNumber !== undefined ? batchNumber : existingItem.batchNumber,
        processId: processId !== undefined ? processId : existingItem.processId,
        lotNo: lotNo !== undefined ? lotNo : existingItem.lotNo,
        shade: shade !== undefined ? shade : existingItem.shade,
        thanId: thanId !== undefined ? thanId : existingItem.thanId,
        meterEquivalent: meterEquivalent !== undefined ? (meterEquivalent ? parseFloat(meterEquivalent) : null) : existingItem.meterEquivalent,
        isLoose: isLoose !== undefined ? isLoose : existingItem.isLoose,
        isCutPiece: isCutPiece !== undefined ? isCutPiece : existingItem.isCutPiece,
      },
      include: {
        article: true,
        location: true,
      },
    });

    return sendSuccess(res, stockItem, 'Stock item updated successfully');
  } catch (error) {
    console.error('Update stock item error:', error);
    return sendError(res, 'Failed to update stock item', 500);
  }
});

// @route   DELETE /api/stock/:id
// @desc    Delete stock item
// @access  Private (Owner only)
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if stock item exists
    const existingItem = await prisma.stockItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return sendError(res, 'Stock item not found', 404);
    }

    await prisma.stockItem.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Stock item deleted successfully');
  } catch (error) {
    console.error('Delete stock item error:', error);
    return sendError(res, 'Failed to delete stock item', 500);
  }
});

// @route   GET /api/stock/summary/location/:locationId
// @desc    Get stock summary by location
// @access  Private
router.get('/summary/location/:locationId', authorize(['owner', 'warehouse', 'inventory_controller', 'sales']), async (req, res) => {
  try {
    const { locationId } = req.params;

    // Verify location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return sendError(res, 'Location not found', 404);
    }

    const stockSummary = await prisma.stockItem.groupBy({
      by: ['articleId', 'stage'],
      where: {
        locationId,
      },
      _sum: {
        quantity: true,
      },
      _avg: {
        pricePerUnit: true,
      },
      _count: {
        id: true,
      },
    });

    // Get article details for each group
    const summaryWithArticles = await Promise.all(
      stockSummary.map(async (summary) => {
        const article = await prisma.article.findUnique({
          where: { id: summary.articleId },
        });
        return {
          ...summary,
          article,
        };
      })
    );

    return sendSuccess(res, {
      location,
      summary: summaryWithArticles,
      totalItems: summaryWithArticles.length,
      totalQuantity: summaryWithArticles.reduce((sum, item) => sum + item._sum.quantity, 0),
    }, 'Stock summary retrieved successfully');

  } catch (error) {
    console.error('Get stock summary error:', error);
    return sendError(res, 'Failed to retrieve stock summary', 500);
  }
});

// @route   POST /api/stock/adjust
// @desc    Adjust stock quantity (increase/decrease)
// @access  Private
router.post('/adjust', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const { stockItemId, adjustment, reason } = req.body;

    if (!stockItemId || typeof adjustment !== 'number') {
      return sendError(res, 'Stock item ID and adjustment amount are required', 400);
    }

    // Get current stock item
    const stockItem = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
      include: {
        article: true,
        location: true,
      },
    });

    if (!stockItem) {
      return sendError(res, 'Stock item not found', 404);
    }

    const newQuantity = stockItem.quantity + adjustment;

    if (newQuantity < 0) {
      return sendError(res, 'Adjustment would result in negative stock quantity', 400);
    }

    const updatedStockItem = await prisma.stockItem.update({
      where: { id: stockItemId },
      data: {
        quantity: newQuantity,
      },
      include: {
        article: true,
        location: true,
      },
    });

    return sendSuccess(res, {
      stockItem: updatedStockItem,
      adjustment,
      reason,
      previousQuantity: stockItem.quantity,
      newQuantity,
    }, 'Stock quantity adjusted successfully');

  } catch (error) {
    console.error('Stock adjustment error:', error);
    return sendError(res, 'Failed to adjust stock quantity', 500);
  }
});

module.exports = router;