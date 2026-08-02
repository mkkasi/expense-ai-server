const { body } = require('express-validator');

const categorizeRules = [
  body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
];

const chatRules = [
  body('message').trim().notEmpty().withMessage('message is required').isLength({ max: 1000 }),
];

module.exports = { categorizeRules, chatRules };
