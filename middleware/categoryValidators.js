const { body } = require('express-validator');

const categoryCreateRules = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 50 }),
  body('type').isIn(['expense', 'income']).withMessage('type must be "expense" or "income"'),
  body('icon').optional().isString(),
  body('color')
    .optional()
    .matches(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/)
    .withMessage('color must be a valid hex code'),
];

module.exports = { categoryCreateRules };
