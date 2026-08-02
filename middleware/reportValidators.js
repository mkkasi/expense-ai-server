const { query } = require('express-validator');

const monthlyReportRules = [
  query('month')
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('month query param is required in YYYY-MM format'),
];

const yearlyReportRules = [
  query('year').isInt({ min: 2000, max: 2100 }).withMessage('year query param is required (4-digit year)'),
];

module.exports = { monthlyReportRules, yearlyReportRules };
