// Standardized API response utility functions

const successResponse = (data = null, message = 'Success') => {
  return {
    success: true,
    data,
    message
  };
};

const errorResponse = (error = 'An error occurred', details = null) => {
  return {
    success: false,
    error,
    details
  };
};

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json(successResponse(data, message));
};

const sendError = (res, error = 'An error occurred', statusCode = 500, details = null) => {
  return res.status(statusCode).json(errorResponse(error, details));
};

module.exports = {
  successResponse,
  errorResponse,
  sendSuccess,
  sendError
};