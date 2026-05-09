const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const vendorRoutes = require('./routes/vendors');
const vendorLedgerRoutes = require('./routes/vendor-ledger');
const articleRoutes = require('./routes/articles');
const locationRoutes = require('./routes/locations');
const configRoutes = require('./routes/config');
const stockRoutes = require('./routes/stock');
const saleOrderRoutes = require('./routes/sales-orders');
const purchaseOrderRoutes = require('./routes/purchase-orders');
const productionOrderRoutes = require('./routes/production-orders');
const grnRoutes = require('./routes/grns');
const receivingInvoiceRoutes = require('./routes/receiving-invoices');
const uploadRoutes = require('./routes/upload');
const dyeingFlowRoutes = require('./routes/dyeing-flow');

const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
// Trust Nginx reverse proxy - required for express-rate-limit to work correctly
app.set('trust proxy', 1);
// Security middleware
app.use(helmet());
// CORS middleware: allow frontend origin
const envOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = [
  ...envOrigins,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://13.53.172.130:8080'
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    const normalizedOrigin = String(origin).replace(/\/$/, '').toLowerCase();
    const isAllowedExact = allowedOrigins.some((allowedOrigin) =>
      String(allowedOrigin).replace(/\/$/, '').toLowerCase() === normalizedOrigin
    );

    // Accept rahmtech production subdomains even if Origin formatting varies slightly.
    let isRahmtechDomain = false;
    try {
      const parsed = new URL(origin);
      isRahmtechDomain = /(^|\.)rahmtech\.io$/i.test(parsed.hostname);
    } catch (_) {
      isRahmtechDomain = false;
    }

    if (isAllowedExact || isRahmtechDomain || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'idempotency-key'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 5000 : 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', authMiddleware, customerRoutes);
app.use('/api/vendors', authMiddleware, vendorRoutes);
app.use('/api/vendor-ledger', authMiddleware, vendorLedgerRoutes);
app.use('/api/articles', authMiddleware, articleRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);
app.use('/api/config', authMiddleware, configRoutes);
app.use('/api/stock', authMiddleware, stockRoutes);
app.use('/api/sales-orders', authMiddleware, saleOrderRoutes);
app.use('/api/purchase-orders', authMiddleware, purchaseOrderRoutes);
app.use('/api/production-orders', authMiddleware, productionOrderRoutes);
app.use('/api/grns', authMiddleware, grnRoutes);
app.use('/api/receiving-invoices', authMiddleware, receivingInvoiceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dyeing-flow', authMiddleware, dyeingFlowRoutes);

// Static routing for document uploads (with CORS headers)
app.use('/doc', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  console.log(`[Static] Serving: ${req.path}`);
  next();
}, express.static(path.join(__dirname, '../doc')));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});