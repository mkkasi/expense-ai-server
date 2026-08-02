const { body } = require('express-validator');

const goalCreateRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('targetAmount').isFloat({ gt: 0 }).withMessage('targetAmount must be greater than zero'),
  body('currentAmount').optional().isFloat({ min: 0 }),
  body('targetDate').isISO8601().withMessage('targetDate must be a valid date'),
  body('icon').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
];

const goalUpdateRules = [
  body('title').optional().trim().notEmpty().isLength({ max: 100 }),
  body('targetAmount').optional().isFloat({ gt: 0 }),
  body('currentAmount').optional().isFloat({ min: 0 }),
  body('targetDate').optional().isISO8601(),
  body('icon').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
];

const contributeRules = [
  body('amount')
    .isFloat()
    .withMessage('amount must be a number')
    .custom((value) => Number(value) !== 0)
    .withMessage('amount must be a non-zero number'),
];

module.exports = { goalCreateRules, goalUpdateRules, contributeRules };
