const ApiError = require('../utils/ApiError');
const { logEvent } = require('../utils/systemLogger');

/**
 * Converts unknown errors (Mongoose, JWT, etc.) into ApiError so the
 * response shape is always consistent.
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest('Validation failed', details);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`${field} already exists`);
  }

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for ${err.path}: ${err.value}`);
  }

  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Token expired');
  }

  return new ApiError(500, err.message || 'Internal server error');
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const apiError = normalizeError(err);

  if (!apiError.isOperational || apiError.statusCode >= 500) {
    console.error('[ERROR]', err);
    logEvent('error', apiError.message, {
      meta: { path: req.originalUrl, method: req.method, statusCode: apiError.statusCode },
      userId: req.user?._id || null,
    });
  }

  res.status(apiError.statusCode || 500).json({
    success: false,
    message: apiError.message,
    details: apiError.details || undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = { errorHandler, notFound };
