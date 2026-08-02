const { body } = require('express-validator');
const { INCOME_CATEGORIES, PAYMENT_METHODS, CURRENCIES } = require('../config/constants');

const incomeCreateRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
  body('category').isIn(INCOME_CATEGORIES).withMessage('Invalid category'),
  body('paymentMethod').optional().isIn(PAYMENT_METHODS),
  body('date').optional().isISO8601(),
  body('description').optional().isString().isLength({ max: 500 }),
  body('currency').optional().isIn(CURRENCIES),
];

const incomeUpdateRules = [
  body('title').optional().trim().notEmpty().isLength({ max: 100 }),
  body('amount').optional().isFloat({ gt: 0 }),
  body('category').optional().isIn(INCOME_CATEGORIES),
  body('paymentMethod').optional().isIn(PAYMENT_METHODS),
  body('date').optional().isISO8601(),
  body('description').optional().isString().isLength({ max: 500 }),
];

module.exports = { incomeCreateRules, incomeUpdateRules };
