const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateLedgerEntry = [
  body('supplierId')
    .notEmpty()
    .withMessage('Supplier ID is required'),
  body('entryType')
    .isIn(['debit', 'credit'])
    .withMessage('Entry type must be debit or credit'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('referenceType')
    .isIn(['receiving_invoice', 'payment', 'adjustment', 'opening_balance'])
    .withMessage('Invalid reference type'),
  body('description')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Description is required'),
  body('date')
    .isISO8601()
    .withMessage('Valid date is required'),
];

const validatePaymentEntry = [
  body('supplierId')
    .notEmpty()
    .withMessage('Supplier ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  body('paymentMethod')
    .isIn(['cash', 'cheque', 'bank_transfer', 'online', 'credit'])
    .withMessage('Invalid payment method'),
  body('date')
    .isISO8601()
    .withMessage('Valid payment date is required'),
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

// Helper function to calculate running balance
const calculateRunningBalance = async (supplierId, entryDate, entryId = null) => {
  const whereClause = {
    supplierId,
    date: {
      lte: new Date(entryDate),
    },
  };

  if (entryId) {
    whereClause.id = {
      not: entryId,
    };
  }

  const previousEntries = await prisma.vendorLedger.findMany({
    where: whereClause,
    orderBy: [
      { date: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  let runningBalance = 0;
  previousEntries.forEach(entry => {
    // Credit = liability increase (goods received / invoices); Debit = liability decrease (payments)
    runningBalance += entry.entryType === 'credit' ? entry.amount : -entry.amount;
  });

  return runningBalance;
};

// @route   GET /api/vendor-ledger/:supplierId
// @desc    Get all ledger entries for a supplier
// @access  Private
router.get('/:supplierId', authorize(['owner', 'purchase_officer', 'finance']), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return sendError(res, 'Supplier not found', 404);
    }

    if (startDate && Number.isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid startDate. Use YYYY-MM-DD format.', 400);
    }

    if (endDate && Number.isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid endDate. Use YYYY-MM-DD format.', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'startDate cannot be later than endDate.', 400);
    }

    const whereClause = { supplierId };
    const gte = parseDateBoundary(startDate, 'start');
    const lte = parseDateBoundary(endDate, 'end');
    if (gte || lte) {
      whereClause.date = {};
      if (gte) whereClause.date.gte = gte;
      if (lte) whereClause.date.lte = lte;
    }

    const ledgerEntries = await prisma.vendorLedger.findMany({
      where: whereClause,
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Enrich entries with line-item details
    const entriesWithItems = await Promise.all(ledgerEntries.map(async (entry) => {
      try {
        if (entry.referenceType === 'receiving_invoice' && entry.referenceId) {
          const invoice = await prisma.receivingInvoice.findUnique({
            where: { id: entry.referenceId },
            include: {
              items: {
                include: {
                  article: { select: { id: true, name: true, unit: true } },
                },
              },
              purchaseOrder: { select: { id: true, poNumber: true } },
            },
          });
          return {
            ...entry,
            lineItems: invoice?.items?.map(item => ({
              articleName: item.article?.name || 'Unknown',
              unit: item.article?.unit || '',
              quantity: item.quantity,
              pricePerUnit: item.pricePerUnit,
              taxPercent: item.taxPercent,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal,
            })) || [],
            invoiceDetails: invoice ? { poNumber: invoice.purchaseOrder?.poNumber, billNo: invoice.billNo } : null,
          };
        }
        if (entry.referenceType === 'grn' && entry.referenceId) {
          const grn = await prisma.gRN.findUnique({
            where: { id: entry.referenceId },
            include: {
              items: {
                include: {
                  article: { select: { id: true, name: true, unit: true } },
                },
              },
            },
          });
          // Fetch PO separately using poId
          let poNumber = null;
          if (grn?.poId) {
            const po = await prisma.purchaseOrder.findUnique({
              where: { id: grn.poId },
              select: { poNumber: true },
            });
            poNumber = po?.poNumber || null;
          }
          return {
            ...entry,
            lineItems: grn?.items?.map(item => ({
              articleName: item.article?.name || 'Unknown',
              unit: item.article?.unit || '',
              quantity: item.receivedQuantity,
              pricePerUnit: null,
              taxPercent: null,
              taxAmount: null,
              lineTotal: null,
            })) || [],
            invoiceDetails: { poNumber, billNo: null },
          };
        }
      } catch (enrichError) {
        console.error(`Failed to enrich ledger entry ${entry.id}:`, enrichError);
      }
      return { ...entry, lineItems: [], invoiceDetails: null };
    }));

    // Calculate totals (Credit = goods/invoices owed; Debit = payments made)
    const totalCredits = ledgerEntries
      .filter(e => e.entryType === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalDebits = ledgerEntries
      .filter(e => e.entryType === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);

    const currentBalance = totalCredits - totalDebits;

    return sendSuccess(res, {
      supplier,
      entries: entriesWithItems,
      summary: {
        totalDebits,
        totalCredits,
        currentBalance,
      },
    }, 'Ledger entries retrieved successfully');
  } catch (error) {
    console.error('Get vendor ledger error:', error);
    return sendError(res, 'Failed to retrieve ledger entries', 500);
  }
});

// @route   POST /api/vendor-ledger
// @desc    Create a new ledger entry
// @access  Private
router.post('/', authorize(['owner', 'purchase_officer', 'finance']), validateLedgerEntry, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const {
      supplierId,
      entryType,
      amount,
      referenceType,
      referenceId,
      referenceNumber,
      description,
      date,
    } = req.body;

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return sendError(res, 'Supplier not found', 404);
    }

    // Calculate running balance (Credit increases, Debit decreases)
    const runningBalance = await calculateRunningBalance(supplierId, date);
    const newBalance = runningBalance + (entryType === 'credit' ? amount : -amount);

    const ledgerEntry = await prisma.vendorLedger.create({
      data: {
        supplierId,
        entryType,
        amount,
        balance: newBalance,
        referenceType,
        referenceId,
        referenceNumber,
        description,
        date: new Date(date),
        createdBy: req.user?.id || 'System',
      },
    });

    return sendSuccess(res, ledgerEntry, 'Ledger entry created successfully', 201);
  } catch (error) {
    console.error('Create ledger entry error:', error);
    return sendError(res, 'Failed to create ledger entry', 500);
  }
});

// @route   POST /api/vendor-ledger/payment
// @desc    Record a payment (credit entry)
// @access  Private
router.post('/payment', authorize(['owner', 'purchase_officer', 'finance']), validatePaymentEntry, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const {
      supplierId,
      amount,
      paymentMethod,
      reference,
      date,
      notes,
    } = req.body;

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return sendError(res, 'Supplier not found', 404);
    }

    // Calculate running balance (payment is a debit — reduces the balance owed)
    const runningBalance = await calculateRunningBalance(supplierId, date);
    const newBalance = runningBalance - amount;

    // Generate payment reference number
    const paymentRef = reference || `PAY-${Date.now().toString().slice(-8)}`;

    const paymentEntry = await prisma.vendorLedger.create({
      data: {
        supplierId,
        entryType: 'debit',
        amount,
        balance: newBalance,
        referenceType: 'payment',
        referenceId: `PAY-${Date.now()}`,
        referenceNumber: paymentRef,
        description: `Payment - ${paymentMethod.replace('_', ' ').toUpperCase()}${notes ? `: ${notes}` : ''}`,
        date: new Date(date),
        createdBy: req.user?.id || 'System',
      },
    });

    return sendSuccess(res, paymentEntry, 'Payment recorded successfully', 201);
  } catch (error) {
    console.error('Record payment error:', error);
    return sendError(res, 'Failed to record payment', 500);
  }
});

// @route   PUT /api/vendor-ledger/:id
// @desc    Update a ledger entry
// @access  Private (Owner only)
router.put('/:id', authorize(['owner']), validateLedgerEntry, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { id } = req.params;
    const {
      entryType,
      amount,
      referenceType,
      referenceId,
      referenceNumber,
      description,
      date,
    } = req.body;

    // Check if entry exists
    const existingEntry = await prisma.vendorLedger.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return sendError(res, 'Ledger entry not found', 404);
    }

    // Recalculate balance for this entry and all subsequent entries
    const runningBalance = await calculateRunningBalance(existingEntry.supplierId, date, id);
    const newBalance = runningBalance + (entryType === 'credit' ? amount : -amount);

    const updatedEntry = await prisma.vendorLedger.update({
      where: { id },
      data: {
        entryType,
        amount,
        balance: newBalance,
        referenceType,
        referenceId,
        referenceNumber,
        description,
        date: new Date(date),
      },
    });

    // TODO: Recalculate balances for all subsequent entries
    // This would require a more complex operation to maintain data integrity

    return sendSuccess(res, updatedEntry, 'Ledger entry updated successfully');
  } catch (error) {
    console.error('Update ledger entry error:', error);
    return sendError(res, 'Failed to update ledger entry', 500);
  }
});

// @route   DELETE /api/vendor-ledger/:id
// @desc    Delete a ledger entry
// @access  Private (Owner only)
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if entry exists
    const existingEntry = await prisma.vendorLedger.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return sendError(res, 'Ledger entry not found', 404);
    }

    await prisma.vendorLedger.delete({
      where: { id },
    });

    // TODO: Recalculate balances for all subsequent entries
    // This would require a more complex operation to maintain data integrity

    return sendSuccess(res, null, 'Ledger entry deleted successfully');
  } catch (error) {
    console.error('Delete ledger entry error:', error);
    return sendError(res, 'Failed to delete ledger entry', 500);
  }
});

module.exports = router;