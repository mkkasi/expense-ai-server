const { body, query } = require('express-validator');
const { EXPENSE_CATEGORIES, PAYMENT_METHODS, CURRENCIES, RECURRING_FREQUENCIES } = require('../config/constants');

// multipart/form-data (used when a receipt image is attached) always sends
// `tags` as a string (JSON-encoded or comma-separated), while a plain JSON
// body sends a real array. Accept either shape here; normalization into a
// real array happens in the controller.
const tagsValidator = body('tags')
  .optional()
  .custom((value) => Array.isArray(value) || typeof value === 'string')
  .withMessage('tags must be an array or a comma-separated string');

const expenseCreateRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
  body('category').isIn(EXPENSE_CATEGORIES).withMessage('Invalid category'),
  body('paymentMethod').optional().isIn(PAYMENT_METHODS).withMessage('Invalid payment method'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('time').optional().isString(),
  body('location').optional().isString().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('isRecurring').optional().isBoolean(),
  body('recurringFrequency').optional().isIn(RECURRING_FREQUENCIES),
  body('currency').optional().isIn(CURRENCIES),
  tagsValidator,
];

const expenseUpdateRules = [
  body('title').optional().trim().notEmpty().isLength({ max: 100 }),
  body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
  body('category').optional().isIn(EXPENSE_CATEGORIES).withMessage('Invalid category'),
  body('paymentMethod').optional().isIn(PAYMENT_METHODS),
  body('date').optional().isISO8601(),
  body('description').optional().isString().isLength({ max: 500 }),
  tagsValidator,
];

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
];

module.exports = { expenseCreateRules, expenseUpdateRules, listQueryRules };
