const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules - Updated for new schema
const validateArticle = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('category')
    .isIn(['grey_material', 'packaging_material', 'finished_goods', 'service_item'])
    .withMessage('Category is required and must be valid (grey_material, packaging_material, finished_goods, service_item)'),
  body('fabricType')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 2 })
    .withMessage('Fabric type must be at least 2 characters long'),
  body('unit')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Unit is required'),
  // Optional fields - validation only if provided
  body('color')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 1 })
    .withMessage('Color must be at least 1 character if provided'),
  body('grade')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['A', 'B', 'C'])
    .withMessage('Grade must be A, B, or C if provided'),
  body('lotNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('cost')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Cost must be a positive number if provided'),
  body('salePrice')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Sale price must be a positive number if provided'),
  body('yarnCount')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('composition')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('constraction')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('width')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'discontinued'])
    .withMessage('Status must be active, inactive, or discontinued'),
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

// @route   GET /api/articles
// @desc    Get all articles
// @access  Private
router.get('/', authorize(['owner', 'warehouse', 'sales', 'purchase_officer', 'inventory_controller']), async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: [
        { name: 'asc' },
        { grade: 'asc' },
      ],
    });

    return sendSuccess(res, articles, 'Articles retrieved successfully');
  } catch (error) {
    console.error('Get articles error:', error);
    return sendError(res, 'Failed to retrieve articles', 500);
  }
});

// @route   GET /api/articles/:id
// @desc    Get article by ID
// @access  Private
router.get('/:id', authorize(['owner', 'warehouse', 'sales', 'purchase_officer', 'inventory_controller']), async (req, res) => {
  try {
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        stockItems: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!article) {
      return sendError(res, 'Article not found', 404);
    }

    return sendSuccess(res, article, 'Article retrieved successfully');
  } catch (error) {
    console.error('Get article error:', error);
    return sendError(res, 'Failed to retrieve article', 500);
  }
});

// @route   POST /api/articles
// @desc    Create new article
// @access  Private
router.post('/', authorize(['owner', 'warehouse', 'purchase_officer']), validateArticle, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const {
      name, category, fabricType, unit,
      color, grade, lotNumber, cost, salePrice,
      yarnCount, composition, constraction, width, status, remarks
    } = req.body;

    // Get createdBy from authenticated user
    const createdBy = req.user?.id || null;

    const article = await prisma.article.create({
      data: {
        name: name.trim(),
        category,
        status: status || 'active',
        fabricType: fabricType?.trim() || null,
        unit: unit.trim(),
        color: color?.trim() || null,
        grade: grade || null,
        lotNumber: lotNumber?.trim() || null,
        cost: cost ? parseFloat(cost) : null,
        salePrice: salePrice ? parseFloat(salePrice) : null,
        yarnCount: yarnCount?.trim() || null,
        composition: composition?.trim() || null,
        constraction: constraction?.trim() || null,
        width: width?.trim() || null,
        remarks: remarks?.trim() || null,
        createdBy,
      },
    });

    return sendSuccess(res, article, 'Article created successfully', 201);
  } catch (error) {
    console.error('Create article error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Article with this name already exists', 400);
    }
    return sendError(res, 'Failed to create article', 500);
  }
});

// @route   PUT /api/articles/:id
// @desc    Update article
// @access  Private
router.put('/:id', authorize(['owner', 'warehouse', 'purchase_officer']), validateArticle, async (req, res) => {
  try {
    const validationError = checkValidation(req, res);
    if (validationError) return;

    const { id } = req.params;
    const {
      name, category, fabricType, unit,
      color, grade, lotNumber, cost, salePrice,
      yarnCount, composition, constraction, width,
      status, remarks
    } = req.body;

    // Check if article exists
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return sendError(res, 'Article not found', 404);
    }

    const article = await prisma.article.update({
      where: { id },
      data: {
        name: name.trim(),
        category,
        status: status || existingArticle.status,
        fabricType: fabricType?.trim() || null,
        unit: unit.trim(),
        color: color?.trim() || null,
        grade: grade || null,
        lotNumber: lotNumber?.trim() || null,
        cost: cost ? parseFloat(cost) : null,
        salePrice: salePrice ? parseFloat(salePrice) : null,
        yarnCount: yarnCount?.trim() || null,
        composition: composition?.trim() || null,
        constraction: constraction?.trim() || null,
        width: width?.trim() || null,
        remarks: remarks?.trim() || null,
      },
    });

    return sendSuccess(res, article, 'Article updated successfully');
  } catch (error) {
    console.error('Update article error:', error);
    if (error.code === 'P2002') {
      return sendError(res, 'Article with this name already exists', 400);
    }
    return sendError(res, 'Failed to update article', 500);
  }
});

// @route   DELETE /api/articles/:id
// @desc    Delete article
// @access  Private (Owner only)
router.delete('/:id', authorize(['owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if article exists
    const existingArticle = await prisma.article.findUnique({
      where: { id },
      include: {
        stockItems: true,
        saleOrderItems: true,
        purchaseOrderItems: true,
      },
    });

    if (!existingArticle) {
      return sendError(res, 'Article not found', 404);
    }

    // Check for related records
    if (existingArticle.stockItems.length > 0 ||
      existingArticle.saleOrderItems.length > 0 ||
      existingArticle.purchaseOrderItems.length > 0) {
      return sendError(res, 'Cannot delete article with existing stock or orders', 400);
    }

    await prisma.article.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Article deleted successfully');
  } catch (error) {
    console.error('Delete article error:', error);
    return sendError(res, 'Failed to delete article', 500);
  }
});

module.exports = router;