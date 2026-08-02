const { body, param } = require('express-validator');
const { EXPENSE_CATEGORIES } = require('../config/constants');

const monthParamRule = param('month')
  .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  .withMessage('month must be in YYYY-MM format');

const budgetCreateRules = [
  body('month')
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('month must be in YYYY-MM format'),
  body('totalBudget').isFloat({ min: 0 }).withMessage('totalBudget must be a non-negative number'),
  body('categoryBudgets').optional().isArray().withMessage('categoryBudgets must be an array'),
  body('categoryBudgets.*.category').optional().isIn(EXPENSE_CATEGORIES).withMessage('Invalid category in categoryBudgets'),
  body('categoryBudgets.*.limit').optional().isFloat({ min: 0 }).withMessage('categoryBudgets limit must be non-negative'),
  body('alertThresholdPercent').optional().isInt({ min: 1, max: 100 }),
];

const budgetUpdateRules = [
  body('totalBudget').optional().isFloat({ min: 0 }),
  body('categoryBudgets').optional().isArray(),
  body('categoryBudgets.*.category').optional().isIn(EXPENSE_CATEGORIES),
  body('categoryBudgets.*.limit').optional().isFloat({ min: 0 }),
  body('alertThresholdPercent').optional().isInt({ min: 1, max: 100 }),
];

module.exports = { monthParamRule, budgetCreateRules, budgetUpdateRules };
