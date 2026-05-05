const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateReceivingInvoice = [
  body('poId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Purchase Order ID is required'),
  body('supplierId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Supplier ID is required'),
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('totalAmount')
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.articleId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Article ID is required for each item'),
  body('items.*.quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  body('items.*.pricePerUnit')
    .isFloat({ min: 0 })
    .withMessage('Price per unit must be a positive number'),
  body('items.*.taxPercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax percent must be between 0 and 100'),
  body('grnIds')
    .optional()
    .isArray()
    .withMessage('GRN IDs must be an array'),
];

const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

// Generate invoice number: RINV-YYYYMMDD-XXX
const generateInvoiceNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RINV-${dateStr}`;
  
  const lastInvoice = await prisma.receivingInvoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
  });

  let nextNum = 1;
  if (lastInvoice) {
    const lastNum = parseInt(lastInvoice.invoiceNumber.slice(-3), 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}-${nextNum.toString().padStart(3, '0')}`;
};

// @route   GET /api/receiving-invoices
// @desc    Get all receiving invoices
// @access  Private
router.get('/', authorize(['owner', 'finance', 'accounts_officer']), async (req, res) => {
  try {
    const { supplierId, status, fromDate, toDate } = req.query;
    
    const whereClause = {};
    if (supplierId) whereClause.supplierId = supplierId;
    if (status) whereClause.status = status;
    
    if (fromDate || toDate) {
      whereClause.date = {};
      if (fromDate) whereClause.date.gte = new Date(fromDate);
      if (toDate) whereClause.date.lte = new Date(toDate);
    }

    const invoices = await prisma.receivingInvoice.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
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
        grnInvoices: {
          include: {
            grn: {
              select: {
                id: true,
                grnNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, invoices, 'Receiving invoices retrieved successfully');
  } catch (error) {
    console.error('Get receiving invoices error:', error);
    return sendError(res, 'Failed to retrieve receiving invoices', 500);
  }
});

// @route   GET /api/receiving-invoices/:id
// @desc    Get receiving invoice by ID
// @access  Private
router.get('/:id', authorize(['owner', 'finance', 'accounts_officer']), async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.receivingInvoice.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            phone: true,
            address: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
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
        grnInvoices: {
          include: {
            grn: {
              select: {
                id: true,
                grnNumber: true,
                receivedAt: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return sendError(res, 'Receiving invoice not found', 404);
    }

    return sendSuccess(res, invoice, 'Receiving invoice retrieved successfully');
  } catch (error) {
    console.error('Get receiving invoice error:', error);
    return sendError(res, 'Failed to retrieve receiving invoice', 500);
  }
});

// @route   POST /api/receiving-invoices
// @desc    Create a new receiving invoice
// @access  Private
router.post('/', authorize(['owner', 'finance', 'accounts_officer']), validateReceivingInvoice, async (req, res) => {
  try {
    if (checkValidation(req, res)) return;

    const {
      billNo,
      poId,
      supplierId,
      date,
      dueDate,
      amount,
      taxAmount,
      totalAmount,
      paymentTerms,
      notes,
      items,
      grnIds = [],
    } = req.body;

    // Verify PO exists and belongs to supplier
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true },
    });

    if (!po) {
      return sendError(res, 'Purchase Order not found', 404);
    }

    if (po.supplierId !== supplierId) {
      return sendError(res, 'Purchase Order does not belong to the specified supplier', 400);
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice with items and GRN relations
    const invoice = await prisma.receivingInvoice.create({
      data: {
        invoiceNumber,
        billNo: billNo || null,
        poId,
        supplierId,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        amount,
        taxAmount: taxAmount || 0,
        totalAmount,
        paymentTerms: paymentTerms || null,
        status: 'pending',
        paidAmount: 0,
        notes: notes || null,
        items: {
          create: items.map(item => ({
            articleId: item.articleId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.totalPrice,
            taxPercent: item.taxPercent || null,
            taxAmount: item.taxAmount || 0,
            lineTotal: item.lineTotal || item.totalPrice,
          })),
        },
        grnInvoices: {
          create: grnIds.map(grnId => ({
            grnId,
          })),
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
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
        grnInvoices: {
          include: {
            grn: {
              select: {
                id: true,
                grnNumber: true,
              },
            },
          },
        },
      },
    });

    // Mark GRNs as invoiced
    if (grnIds.length > 0) {
      await prisma.gRN.updateMany({
        where: {
          id: { in: grnIds },
        },
        data: {
          isInvoiced: true,
        },
      });
    }

    return sendSuccess(res, invoice, 'Receiving invoice created successfully', 201);
  } catch (error) {
    console.error('Create receiving invoice error:', error);
    return sendError(res, 'Failed to create receiving invoice', 500);
  }
});

// @route   PUT /api/receiving-invoices/:id
// @desc    Update a receiving invoice
// @access  Private
router.put('/:id', authorize(['owner', 'finance', 'accounts_officer']), validateReceivingInvoice, async (req, res) => {
  try {
    if (checkValidation(req, res)) return;

    const { id } = req.params;
    const {
      billNo,
      date,
      dueDate,
      amount,
      taxAmount,
      totalAmount,
      paymentTerms,
      status,
      paidAmount,
      notes,
      items,
      grnIds,
    } = req.body;

    // Check if invoice exists
    const existingInvoice = await prisma.receivingInvoice.findUnique({
      where: { id },
      include: { grnInvoices: true },
    });

    if (!existingInvoice) {
      return sendError(res, 'Receiving invoice not found', 404);
    }

    // Get old GRN IDs
    const oldGrnIds = existingInvoice.grnInvoices.map(gi => gi.grnId);
    const newGrnIds = grnIds || [];

    // Update invoice
    const invoice = await prisma.receivingInvoice.update({
      where: { id },
      data: {
        billNo: billNo !== undefined ? (billNo || null) : undefined,
        date: date ? new Date(date) : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        amount: amount !== undefined ? amount : undefined,
        taxAmount: taxAmount !== undefined ? taxAmount : undefined,
        totalAmount: totalAmount !== undefined ? totalAmount : undefined,
        paymentTerms: paymentTerms !== undefined ? (paymentTerms || null) : undefined,
        status: status !== undefined ? status : undefined,
        paidAmount: paidAmount !== undefined ? paidAmount : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
        items: items
          ? {
              deleteMany: {},
              create: items.map(item => ({
                articleId: item.articleId,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                totalPrice: item.totalPrice,
                taxPercent: item.taxPercent || null,
                taxAmount: item.taxAmount || 0,
                lineTotal: item.lineTotal || item.totalPrice,
              })),
            }
          : undefined,
        grnInvoices: grnIds
          ? {
              deleteMany: {},
              create: grnIds.map(grnId => ({
                grnId,
              })),
            }
          : undefined,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
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
        grnInvoices: {
          include: {
            grn: {
              select: {
                id: true,
                grnNumber: true,
              },
            },
          },
        },
      },
    });

    // Update GRN invoiced status
    const grnsToUnmark = oldGrnIds.filter(id => !newGrnIds.includes(id));
    const grnsToMark = newGrnIds.filter(id => !oldGrnIds.includes(id));

    if (grnsToUnmark.length > 0) {
      await prisma.gRN.updateMany({
        where: { id: { in: grnsToUnmark } },
        data: { isInvoiced: false },
      });
    }

    if (grnsToMark.length > 0) {
      await prisma.gRN.updateMany({
        where: { id: { in: grnsToMark } },
        data: { isInvoiced: true },
      });
    }

    return sendSuccess(res, invoice, 'Receiving invoice updated successfully');
  } catch (error) {
    console.error('Update receiving invoice error:', error);
    return sendError(res, 'Failed to update receiving invoice', 500);
  }
});

// @route   DELETE /api/receiving-invoices/:id
// @desc    Delete a receiving invoice
// @access  Private
router.delete('/:id', authorize(['owner', 'finance']), async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.receivingInvoice.findUnique({
      where: { id },
      include: { grnInvoices: true },
    });

    if (!invoice) {
      return sendError(res, 'Receiving invoice not found', 404);
    }

    // Get GRN IDs to unmark
    const grnIds = invoice.grnInvoices.map(gi => gi.grnId);

    // Delete invoice (cascade will delete items and grnInvoices)
    await prisma.receivingInvoice.delete({
      where: { id },
    });

    // Unmark GRNs as invoiced
    if (grnIds.length > 0) {
      await prisma.gRN.updateMany({
        where: { id: { in: grnIds } },
        data: { isInvoiced: false },
      });
    }

    return sendSuccess(res, null, 'Receiving invoice deleted successfully');
  } catch (error) {
    console.error('Delete receiving invoice error:', error);
    return sendError(res, 'Failed to delete receiving invoice', 500);
  }
});

module.exports = router;
