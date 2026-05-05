const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const validateCustomer = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('status')
    .optional()
    .isIn(['active', 'on_hold', 'inactive'])
    .withMessage('Status must be active, on_hold, or inactive'),
  // Contact & Address Details
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('billingAddress')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('billingCity')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('billingState')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('billingPostalCode')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('shippingAddress')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('shippingCity')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('shippingState')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('shippingPostalCode')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  // Credit & Payment Management
  body('creditLimit')
    .isFloat({ min: 0 })
    .withMessage('Credit limit must be a positive number'),
  body('creditDays')
    .isInt({ min: 0 })
    .withMessage('Credit days must be a positive integer'),
  body('isCashOnly')
    .optional()
    .isBoolean()
    .withMessage('isCashOnly must be a boolean'),
  body('currentBalance')
    .optional()
    .isFloat()
    .withMessage('Current balance must be a number'),
  body('acceptsCheque')
    .optional()
    .isBoolean()
    .withMessage('acceptsCheque must be a boolean'),
  body('acceptsPDC')
    .optional()
    .isBoolean()
    .withMessage('acceptsPDC must be a boolean'),
  body('pdcDueDays')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('PDC due days must be a positive integer'),
  body('advancePayment')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Advance payment must be a positive number'),
  body('advanceRequired')
    .optional()
    .isBoolean()
    .withMessage('advanceRequired must be a boolean'),
  body('deliveryDays')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Delivery days must be a positive integer'),
  // Associations
  body('salespersonId')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('warehouseId')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  // Notes
  body('remarks')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  // Legacy field
  body('city')
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

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private
router.get('/', authorize(['owner', 'sales', 'finance', 'accounts_officer']), async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        salesperson: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return sendSuccess(res, customers, 'Customers retrieved successfully');
  } catch (error) {
    console.error('Get customers error:', error);
    return sendError(res, 'Failed to retrieve customers', 500);
  }
});

// @route   GET /api/customers/:id
// @desc    Get customer by ID
// @access  Private
router.get('/:id', authorize(['owner', 'sales', 'finance', 'accounts_officer']), async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        salesperson: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        saleOrders: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            balanceAmount: true,
            status: true,
            dueDate: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!customer) {
      return sendError(res, 'Customer not found', 404);
    }

    return sendSuccess(res, customer, 'Customer retrieved successfully');
  } catch (error) {
    console.error('Get customer error:', error);
    return sendError(res, 'Failed to retrieve customer', 500);
  }
});

// @route   POST /api/customers
// @desc    Create new customer
// @access  Private
router.post('/', authorize(['owner', 'sales']), validateCustomer, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const {
      name, status, phone,
      billingAddress, billingCity, billingState, billingPostalCode,
      shippingAddress, shippingCity, shippingState, shippingPostalCode,
      creditLimit, creditDays, isCashOnly, currentBalance,
      acceptsCheque, acceptsPDC, pdcDueDays, advancePayment, advanceRequired,
      deliveryDays, salespersonId, warehouseId, remarks, city
    } = req.body;

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        status: status || 'active',
        // Contact & Address Details
        phone: phone?.trim() || null,
        billingAddress: billingAddress?.trim() || null,
        billingCity: billingCity?.trim() || null,
        billingState: billingState?.trim() || null,
        billingPostalCode: billingPostalCode?.trim() || null,
        shippingAddress: shippingAddress?.trim() || null,
        shippingCity: shippingCity?.trim() || null,
        shippingState: shippingState?.trim() || null,
        shippingPostalCode: shippingPostalCode?.trim() || null,
        // Credit & Payment Management
        creditLimit: parseFloat(creditLimit),
        creditDays: parseInt(creditDays),
        isCashOnly: isCashOnly || false,
        currentBalance: parseFloat(currentBalance) || 0,
        acceptsCheque: acceptsCheque || false,
        acceptsPDC: acceptsPDC || false,
        pdcDueDays: pdcDueDays ? parseInt(pdcDueDays) : null,
        advancePayment: advancePayment ? parseFloat(advancePayment) : null,
        advanceRequired: advanceRequired || false,
        deliveryDays: deliveryDays ? parseInt(deliveryDays) : null,
        // Associations
        salespersonId: salespersonId || null,
        warehouseId: warehouseId || null,
        // Notes
        remarks: remarks?.trim() || null,
        // Legacy field
        city: city?.trim() || billingCity?.trim() || null,
      },
    });

    return sendSuccess(res, customer, 'Customer created successfully', 201);
  } catch (error) {
    console.error('Create customer error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Customer with this name already exists', 400);
    }
    return sendError(res, 'Failed to create customer', 500);
  }
});

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private
router.put('/:id', authorize(['owner', 'sales']), validateCustomer, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { id } = req.params;
    const {
      name, status, phone,
      billingAddress, billingCity, billingState, billingPostalCode,
      shippingAddress, shippingCity, shippingState, shippingPostalCode,
      creditLimit, creditDays, isCashOnly, currentBalance,
      acceptsCheque, acceptsPDC, pdcDueDays, advancePayment, advanceRequired,
      deliveryDays, salespersonId, warehouseId, remarks, city
    } = req.body;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return sendError(res, 'Customer not found', 404);
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        status: status || existingCustomer.status,
        // Contact & Address Details
        phone: phone?.trim() || null,
        billingAddress: billingAddress?.trim() || null,
        billingCity: billingCity?.trim() || null,
        billingState: billingState?.trim() || null,
        billingPostalCode: billingPostalCode?.trim() || null,
        shippingAddress: shippingAddress?.trim() || null,
        shippingCity: shippingCity?.trim() || null,
        shippingState: shippingState?.trim() || null,
        shippingPostalCode: shippingPostalCode?.trim() || null,
        // Credit & Payment Management
        creditLimit: parseFloat(creditLimit),
        creditDays: parseInt(creditDays),
        isCashOnly: isCashOnly !== undefined ? isCashOnly : existingCustomer.isCashOnly,
        currentBalance: currentBalance !== undefined ? parseFloat(currentBalance) : existingCustomer.currentBalance,
        acceptsCheque: acceptsCheque !== undefined ? acceptsCheque : existingCustomer.acceptsCheque,
        acceptsPDC: acceptsPDC !== undefined ? acceptsPDC : existingCustomer.acceptsPDC,
        pdcDueDays: pdcDueDays !== undefined ? (pdcDueDays ? parseInt(pdcDueDays) : null) : existingCustomer.pdcDueDays,
        advancePayment: advancePayment !== undefined ? (advancePayment ? parseFloat(advancePayment) : null) : existingCustomer.advancePayment,
        advanceRequired: advanceRequired !== undefined ? advanceRequired : existingCustomer.advanceRequired,
        deliveryDays: deliveryDays !== undefined ? (deliveryDays ? parseInt(deliveryDays) : null) : existingCustomer.deliveryDays,
        // Associations
        salespersonId: salespersonId !== undefined ? (salespersonId || null) : existingCustomer.salespersonId,
        warehouseId: warehouseId !== undefined ? (warehouseId || null) : existingCustomer.warehouseId,
        // Notes
        remarks: remarks !== undefined ? (remarks?.trim() || null) : existingCustomer.remarks,
        // Legacy field
        city: city?.trim() || billingCity?.trim() || existingCustomer.city,
      },
    });

    return sendSuccess(res, customer, 'Customer updated successfully');
  } catch (error) {
    console.error('Update customer error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Customer with this name already exists', 400);
    }
    return sendError(res, 'Failed to update customer', 500);
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private (Owner only)
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
      include: {
        saleOrders: true,
        invoices: true,
      },
    });

    if (!existingCustomer) {
      return sendError(res, 'Customer not found', 404);
    }

    // Check for related orders or invoices
    if (existingCustomer.saleOrders.length > 0 || existingCustomer.invoices.length > 0) {
      return sendError(res, 'Cannot delete customer with existing orders or invoices', 400);
    }

    await prisma.customer.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Customer deleted successfully');
  } catch (error) {
    console.error('Delete customer error:', error);
    return sendError(res, 'Failed to delete customer', 500);
  }
});

module.exports = router;