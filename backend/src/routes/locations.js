const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateLocation = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('type')
    .isIn(['godown', 'salepoint'])
    .withMessage('Type must be either godown or salepoint'),
  body('address')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Address must be at least 5 characters long'),
  body('ownershipType')
    .optional()
    .isIn(['own', 'vendor'])
    .withMessage('Ownership type must be either own or vendor'),
  body('vendorId')
    .if(body('ownershipType').equals('vendor'))
    .notEmpty()
    .withMessage('Vendor is required for vendor-owned warehouses'),
];

// Helper function to check validation errors
const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

// @route   GET /api/locations
// @desc    Get all locations
// @access  Private
router.get('/', authorize(['owner', 'warehouse', 'sales', 'inventory_controller']), async (req, res) => {
  try {
    const { type } = req.query;

    const whereClause = type ? { type } : {};

    const locations = await prisma.location.findMany({
      where: whereClause,
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
      include: {
        stockItems: {
          include: {
            article: {
              select: {
                name: true,
                unit: true,
                yarnCount: true,
                composition: true,
                constraction: true,
                width: true,
                lotNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            stockItems: true,
            saleOrders: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          }
        },
      },
    });

    return sendSuccess(res, locations, 'Locations retrieved successfully');
  } catch (error) {
    console.error('Get locations error:', error);
    return sendError(res, 'Failed to retrieve locations', 500);
  }
});

// @route   GET /api/locations/:id
// @desc    Get location by ID
// @access  Private
router.get('/:id', authorize(['owner', 'warehouse', 'sales', 'inventory_controller']), async (req, res) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        stockItems: {
          include: {
            article: {
              select: {
                name: true,
                fabricType: true,
                color: true,
                grade: true,
                unit: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
        saleOrders: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          }
        },
      },
    });

    if (!location) {
      return sendError(res, 'Location not found', 404);
    }

    return sendSuccess(res, location, 'Location retrieved successfully');
  } catch (error) {
    console.error('Get location error:', error);
    return sendError(res, 'Failed to retrieve location', 500);
  }
});

// @route   POST /api/locations
// @desc    Create new location
// @access  Private
router.post('/', authorize(['owner', 'warehouse']), validateLocation, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { name, type, address, ownershipType, vendorId } = req.body;

    const location = await prisma.location.create({
      data: {
        name: name.trim(),
        type,
        address: address.trim(),
        ownershipType: ownershipType || 'own',
        vendorId: ownershipType === 'vendor' ? vendorId : null,
      },
    });

    return sendSuccess(res, location, 'Location created successfully', 201);
  } catch (error) {
    console.error('Create location error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Location with this name already exists', 400);
    }
    return sendError(res, 'Failed to create location', 500);
  }
});

// @route   PUT /api/locations/:id
// @desc    Update location
// @access  Private
router.put('/:id', authorize(['owner', 'warehouse']), validateLocation, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { id } = req.params;
    const { name, type, address, ownershipType, vendorId } = req.body;

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id },
    });

    if (!existingLocation) {
      return sendError(res, 'Location not found', 404);
    }

    const location = await prisma.location.update({
      where: { id },
      data: {
        name: name.trim(),
        type,
        address: address.trim(),
        ownershipType: ownershipType || 'own',
        vendorId: ownershipType === 'vendor' ? vendorId : null,
      },
    });

    return sendSuccess(res, location, 'Location updated successfully');
  } catch (error) {
    console.error('Update location error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Location with this name already exists', 400);
    }
    return sendError(res, 'Failed to update location', 500);
  }
});

// @route   DELETE /api/locations/:id
// @desc    Delete location
// @access  Private (Owner only)
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id },
      include: {
        stockItems: true,
        saleOrders: true,
        fromRequisitions: true,
        toRequisitions: true,
        fromGatePasses: true,
        toGatePasses: true,
      },
    });

    if (!existingLocation) {
      return sendError(res, 'Location not found', 404);
    }

    // Check for related records and provide detailed information
    const blockingRecords = {
      stockItems: existingLocation.stockItems.length,
      saleOrders: existingLocation.saleOrders.length,
      fromRequisitions: existingLocation.fromRequisitions.length,
      toRequisitions: existingLocation.toRequisitions.length,
      fromGatePasses: existingLocation.fromGatePasses.length,
      toGatePasses: existingLocation.toGatePasses.length,
    };

    const totalBlocking = Object.values(blockingRecords).reduce((sum, count) => sum + count, 0);

    if (totalBlocking > 0) {
      const details = [];
      if (blockingRecords.stockItems > 0) details.push(`${blockingRecords.stockItems} stock item(s)`);
      if (blockingRecords.saleOrders > 0) details.push(`${blockingRecords.saleOrders} sale order(s)`);
      if (blockingRecords.fromRequisitions > 0) details.push(`${blockingRecords.fromRequisitions} outgoing requisition(s)`);
      if (blockingRecords.toRequisitions > 0) details.push(`${blockingRecords.toRequisitions} incoming requisition(s)`);
      if (blockingRecords.fromGatePasses > 0) details.push(`${blockingRecords.fromGatePasses} outgoing gate pass(es)`);
      if (blockingRecords.toGatePasses > 0) details.push(`${blockingRecords.toGatePasses} incoming gate pass(es)`);

      return sendError(
        res,
        `Cannot delete warehouse. It has ${details.join(', ')}. Please remove or reassign these records first.`,
        400,
        { blockingRecords, details }
      );
    }

    await prisma.location.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Location deleted successfully');
  } catch (error) {
    console.error('Delete location error:', error);
    return sendError(res, 'Failed to delete location', 500);
  }
});

// @route   GET /api/locations/:id/deletion-status
// @desc    Get deletion status and blocking records for a location
// @access  Private (Owner only)
router.get('/:id/deletion-status', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        stockItems: {
          select: {
            id: true,
            quantity: true,
            article: {
              select: {
                name: true,
                id: true
              }
            }
          },
          take: 10, // Increased to get more items for PO matching
        },
        saleOrders: {
          select: { id: true, orderNumber: true, totalAmount: true, status: true },
          take: 5,
        },
        fromRequisitions: { select: { id: true, requisitionNumber: true }, take: 5 },
        toRequisitions: { select: { id: true, requisitionNumber: true }, take: 5 },
        fromGatePasses: { select: { id: true, gatePassNumber: true }, take: 5 },
        toGatePasses: { select: { id: true, gatePassNumber: true }, take: 5 },
        _count: {
          select: {
            stockItems: true,
            saleOrders: true,
            fromRequisitions: true,
            toRequisitions: true,
            fromGatePasses: true,
            toGatePasses: true,
          },
        },
      },
    });

    if (!location) {
      return sendError(res, 'Location not found', 404);
    }

    // Get PO numbers for stock items by finding Purchase Orders with matching articles
    const stockItemsWithPO = await Promise.all(
      location.stockItems.slice(0, 10).map(async (stockItem) => {
        // Find Purchase Orders that have items matching this article
        const purchaseOrderItems = await prisma.purchaseOrderItem.findMany({
          where: {
            articleId: stockItem.article.id,
          },
          include: {
            purchaseOrder: {
              select: {
                id: true,
                poNumber: true,
                status: true,
              },
            },
          },
          take: 3, // Get up to 3 PO numbers per stock item
          orderBy: {
            purchaseOrder: {
              createdAt: 'desc',
            },
          },
        });

        const poNumbers = purchaseOrderItems
          .map(poi => poi.purchaseOrder.poNumber)
          .filter((po, index, self) => self.indexOf(po) === index); // Remove duplicates

        return {
          id: stockItem.id,
          quantity: stockItem.quantity,
          article: {
            name: stockItem.article.name,
          },
          poNumbers: poNumbers.length > 0 ? poNumbers : null,
        };
      })
    );

    const blockingRecords = {
      stockItems: location._count.stockItems,
      saleOrders: location._count.saleOrders,
      fromRequisitions: location._count.fromRequisitions,
      toRequisitions: location._count.toRequisitions,
      fromGatePasses: location._count.fromGatePasses,
      toGatePasses: location._count.toGatePasses,
    };

    const canDelete = Object.values(blockingRecords).every(count => count === 0);

    return sendSuccess(res, {
      canDelete,
      blockingRecords,
      preview: {
        stockItems: stockItemsWithPO,
        saleOrders: location.saleOrders,
        fromRequisitions: location.fromRequisitions,
        toRequisitions: location.toRequisitions,
        fromGatePasses: location.fromGatePasses,
        toGatePasses: location.toGatePasses,
      },
    }, 'Deletion status retrieved successfully');
  } catch (error) {
    console.error('Get deletion status error:', error);
    return sendError(res, 'Failed to retrieve deletion status', 500);
  }
});

// @route   GET /api/locations/:id/stock-detail
// @desc    Get detailed stock view for a location (with GRN, supplier, dyeing info)
// @access  Private
router.get('/:id/stock-detail', authorize(['owner', 'warehouse', 'purchase_officer', 'inventory_controller']), async (req, res) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) return sendError(res, 'Location not found', 404);

    // Get raw stock items with full article details
    const stockItems = await prisma.stockItem.findMany({
      where: { locationId: id },
      include: {
        article: {
          select: {
            id: true,
            name: true,
            unit: true,
            yarnCount: true,
            composition: true,
            constraction: true,
            width: true,
            lotNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // For each stock item, find the most recent confirmed GRN for the same article+warehouse
    const enriched = await Promise.all(
      stockItems.map(async (item) => {
        const normalizedLotNo = String(item.lotNo || '').trim();

        // Find the most relevant confirmed GRN row for this stock line.
        // Prefer exact lot match so warehouse view stays in sync with GRN table.
        const lotScopedWhere = {
          articleId: item.articleId,
          grn: { warehouseId: id, status: 'confirmed' },
          ...(normalizedLotNo
            ? {
                OR: [
                  { lotNo: normalizedLotNo },
                  { lotNo: { contains: normalizedLotNo } },
                ],
              }
            : {}),
        };

        const grnItem = await prisma.gRNItem.findFirst({
          where: lotScopedWhere,
          include: {
            grn: {
              include: {
                supplier: { select: { id: true, name: true, phone: true, contactPerson: true } },
              },
            },
          },
          orderBy: { grn: { receivedAt: 'desc' } },
        });

        // Fallback for legacy rows without lot numbers: match by article/warehouse.
        const fallbackGrnItem = !grnItem
          ? await prisma.gRNItem.findFirst({
              where: {
                articleId: item.articleId,
                grn: { warehouseId: id, status: 'confirmed' },
              },
              include: {
                grn: {
                  include: {
                    supplier: { select: { id: true, name: true, phone: true, contactPerson: true } },
                  },
                },
              },
              orderBy: { grn: { receivedAt: 'desc' } },
            })
          : null;

        const matchedGrnItem = grnItem || fallbackGrnItem;

        // Find dyeing jobs issued for this lot/article.
        // A single lot can map to multiple dyeing rows (e.g. split by colour),
        // so aggregate issued than/meters across all matching jobs.
        const dyeingJobs = item.lotNo
          ? await prisma.dyeingJob.findMany({
              where: {
                OR: [
                  { lotNo: item.lotNo },
                  { lotNo: { contains: item.lotNo } },
                ],
              },
              select: {
                jobNumber: true,
                dyeingHouse: true,
                workOrderNo: true,
                lotNo: true,
                greyThan: true,
                greyMeters: true,
                status: true,
              },
              orderBy: { createdAt: 'desc' },
            })
          : [];

        const exactLotJobs = dyeingJobs.filter((job) =>
          String(job.lotNo || '')
            .split(',')
            .map((s) => s.trim())
            .includes(normalizedLotNo)
        );

        const issuedToDyeing = exactLotJobs.length > 0
          ? {
              workOrderNo: exactLotJobs[0].workOrderNo,
              dyeingHouse: exactLotJobs[0].dyeingHouse,
              jobNumber: exactLotJobs[0].jobNumber,
              greyThan: exactLotJobs.reduce((sum, job) => sum + (Number(job.greyThan) || 0), 0),
              greyMeters: exactLotJobs.reduce((sum, job) => sum + (Number(job.greyMeters) || 0), 0),
              status: exactLotJobs[0].status,
            }
          : null;

        return {
          id: item.id,
          articleId: item.articleId,
          article: item.article,
          quantity: item.quantity,          // Qty in Than
          meterEquivalent: item.meterEquivalent, // Qty in Meters
          pricePerUnit: item.pricePerUnit,
          lotNo: item.lotNo || item.article?.lotNumber || null,
          shade: item.shade,
          stage: item.stage,
          createdAt: item.createdAt,
          // GRN-derived fields
          receivingDate: matchedGrnItem?.grn?.receivedAt || null,
          transactionNo: matchedGrnItem?.grn?.grnNumber || null,
          supplier: matchedGrnItem?.grn?.supplier || null,
          packages: matchedGrnItem?.packages || null,
          // Dyeing issue info
          issuedToDyeing,
        };
      })
    );

    return sendSuccess(res, enriched, 'Stock detail retrieved successfully');
  } catch (error) {
    console.error('Get stock detail error:', error);
    return sendError(res, 'Failed to retrieve stock detail', 500);
  }
});

// @route   GET /api/locations/:id/stock
// @desc    Get stock summary for a location
// @access  Private
router.get('/:id/stock', authorize(['owner', 'warehouse', 'sales', 'inventory_controller']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      return sendError(res, 'Location not found', 404);
    }

    const stockSummary = await prisma.stockItem.groupBy({
      by: ['articleId'],
      where: {
        locationId: id,
      },
      _sum: {
        quantity: true,
      },
      _avg: {
        pricePerUnit: true,
      },
    });

    // Get article details for each stock item
    const stockWithArticles = await Promise.all(
      stockSummary.map(async (stock) => {
        const article = await prisma.article.findUnique({
          where: { id: stock.articleId },
        });
        return {
          ...stock,
          article,
        };
      })
    );

    return sendSuccess(res, {
      location,
      stockSummary: stockWithArticles,
    }, 'Stock summary retrieved successfully');

  } catch (error) {
    console.error('Get location stock error:', error);
    return sendError(res, 'Failed to retrieve location stock', 500);
  }
});

module.exports = router;