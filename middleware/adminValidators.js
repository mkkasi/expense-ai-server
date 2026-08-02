const { body } = require('express-validator');
const { USER_ROLES } = require('../config/constants');

const updateUserRules = [
  body('role').optional().isIn(USER_ROLES).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const createCategoryRules = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 50 }),
  body('type').isIn(['expense', 'income']).withMessage('type must be "expense" or "income"'),
  body('icon').optional().isString(),
  body('color')
    .optional()
    .matches(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/)
    .withMessage('color must be a valid hex code'),
];

const updateCategoryRules = [
  body('name').optional().trim().notEmpty().isLength({ max: 50 }),
  body('icon').optional().isString(),
  body('color')
    .optional()
    .matches(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/),
];

module.exports = { updateUserRules, createCategoryRules, updateCategoryRules };
