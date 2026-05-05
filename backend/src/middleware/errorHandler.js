const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', err);

  // Prisma errors
  if (err.code === 'P2002') {
    return sendError(res, 'Duplicate entry found', 500, err.meta);
  }

  if (err.code === 'P2025') {
    return sendError(res, 'Record not found', 500, err.meta);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, 'Validation error', 500, err.details);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 500);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 500);
  }

  // Custom application errors
  if (err.statusCode) {
    return sendError(res, err.message, err.statusCode, err.details);
  }

  // Default server error
  return sendError(res, 'Internal server error', 500, err.message);
};

module.exports = errorHandler;