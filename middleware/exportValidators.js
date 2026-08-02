const { query } = require('express-validator');

const exportRules = [
  query('format').optional().isIn(['csv', 'excel', 'pdf']).withMessage('format must be csv, excel, or pdf'),
  query('type').optional().isIn(['all', 'expense', 'income']).withMessage('type must be all, expense, or income'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

module.exports = { exportRules };
