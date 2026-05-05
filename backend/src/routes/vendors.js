const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateVendor = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('category')
    .optional()
    .isIn(['supplier', 'dyeing', 'packaging', 'other'])
    .withMessage('Category must be supplier, dyeing, packaging, or other'),
  body('contactPerson')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Contact person must be at least 2 characters long'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phone')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Phone number must be at least 10 characters long'),
  body('address')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Address must be at least 5 characters long'),
  body('paymentTerms')
    .isInt({ min: 0 })
    .withMessage('Expected delivery days must be a positive integer'),
  body('paymentMethod')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['cash', 'credit', 'cheque', 'bank_transfer', 'online'])
    .withMessage('Payment method must be cash, credit, cheque, bank_transfer, or online'),
  body('bankName')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('accountNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('accountTitle')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('remarks')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
];

// Helper function to check validation errors
const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  return null;
};

// @route   GET /api/vendors
// @desc    Get all vendors
// @access  Private
router.get('/', authorize(['owner', 'purchase_officer', 'finance']), async (req, res) => {
  try {
    const vendors = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return sendSuccess(res, vendors, 'Vendors retrieved successfully');
  } catch (error) {
    console.error('Get vendors error:', error);
    return sendError(res, 'Failed to retrieve vendors', 500);
  }
});

// @route   GET /api/vendors/:id
// @desc    Get vendor by ID
// @access  Private
router.get('/:id', authorize(['owner', 'purchase_officer', 'finance']), async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        grns: {
          select: {
            id: true,
            grnNumber: true,
            status: true,
            receivedAt: true,
          },
          orderBy: {
            receivedAt: 'desc',
          },
        },
      },
    });

    if (!vendor) {
      return sendError(res, 'Vendor not found', 404);
    }

    return sendSuccess(res, vendor, 'Vendor retrieved successfully');
  } catch (error) {
    console.error('Get vendor error:', error);
    return sendError(res, 'Failed to retrieve vendor', 500);
  }
});

// @route   POST /api/vendors
// @desc    Create new vendor
// @access  Private
router.post('/', authorize(['owner', 'purchase_officer']), validateVendor, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { name, category, contactPerson, email, phone, address, paymentTerms, paymentMethod, bankName, accountNumber, accountTitle, remarks } = req.body;

    const vendor = await prisma.supplier.create({
      data: {
        name: name.trim(),
        category: category || 'supplier',
        contactPerson: contactPerson.trim(),
        email: email ? email.toLowerCase().trim() : null,
        phone: phone.trim(),
        address: address.trim(),
        paymentTerms: parseInt(paymentTerms),
        paymentMethod: paymentMethod || null,
        bankName: bankName?.trim() || null,
        accountNumber: accountNumber?.trim() || null,
        accountTitle: accountTitle?.trim() || null,
        remarks: remarks?.trim() || null,
      },
    });

    return sendSuccess(res, vendor, 'Vendor created successfully', 201);
  } catch (error) {
    console.error('Create vendor error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Vendor with this email already exists', 400);
    }
    return sendError(res, 'Failed to create vendor', 500);
  }
});

// @route   PUT /api/vendors/:id
// @desc    Update vendor
// @access  Private
router.put('/:id', authorize(['owner', 'purchase_officer']), validateVendor, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { id } = req.params;
    const { name, category, contactPerson, email, phone, address, paymentTerms, paymentMethod, bankName, accountNumber, accountTitle, remarks } = req.body;

    // Check if vendor exists
    const existingVendor = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingVendor) {
      return sendError(res, 'Vendor not found', 404);
    }

    const vendor = await prisma.supplier.update({
      where: { id },
      data: {
        name: name.trim(),
        category: category || existingVendor.category,
        contactPerson: contactPerson.trim(),
        email: email !== undefined ? (email ? email.toLowerCase().trim() : null) : existingVendor.email,
        phone: phone.trim(),
        address: address.trim(),
        paymentTerms: parseInt(paymentTerms),
        paymentMethod: paymentMethod !== undefined ? (paymentMethod || null) : existingVendor.paymentMethod,
        bankName: bankName !== undefined ? (bankName?.trim() || null) : existingVendor.bankName,
        accountNumber: accountNumber !== undefined ? (accountNumber?.trim() || null) : existingVendor.accountNumber,
        accountTitle: accountTitle !== undefined ? (accountTitle?.trim() || null) : existingVendor.accountTitle,
        remarks: remarks !== undefined ? (remarks?.trim() || null) : existingVendor.remarks,
      },
    });

    return sendSuccess(res, vendor, 'Vendor updated successfully');
  } catch (error) {
    console.error('Update vendor error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Vendor with this email already exists', 400);
    }
    return sendError(res, 'Failed to update vendor', 500);
  }
});

module.exports = router;