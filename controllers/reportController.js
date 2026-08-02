const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const reportService = require('../services/reportService');

// GET /api/reports/monthly?month=YYYY-MM
const monthlyReport = asyncHandler(async (req, res) => {
  const report = await reportService.getMonthlyReport(req.user._id, req.query.month);
  new ApiResponse(200, 'Monthly report generated', report).send(res);
});

// GET /api/reports/yearly?year=YYYY
const yearlyReport = asyncHandler(async (req, res) => {
  const report = await reportService.getYearlyReport(req.user._id, req.query.year);
  new ApiResponse(200, 'Yearly report generated', report).send(res);
});

module.exports = { monthlyReport, yearlyReport };
