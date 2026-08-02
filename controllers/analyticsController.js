const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const analyticsService = require('../services/analyticsService');

// GET /api/analytics/weekly-spending?weeks=8
const weeklySpending = asyncHandler(async (req, res) => {
  const weeks = Math.min(52, Math.max(1, parseInt(req.query.weeks, 10) || 8));
  const data = await analyticsService.getWeeklySpending(req.user._id, weeks);
  new ApiResponse(200, 'Weekly spending fetched', { data }).send(res);
});

// GET /api/analytics/monthly-spending?months=12
const monthlySpending = asyncHandler(async (req, res) => {
  const months = Math.min(60, Math.max(1, parseInt(req.query.months, 10) || 12));
  const data = await analyticsService.getMonthlySpending(req.user._id, months);
  new ApiResponse(200, 'Monthly spending fetched', { data }).send(res);
});

// GET /api/analytics/category-distribution?month=YYYY-MM
const categoryDistribution = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCategoryDistribution(req.user._id, req.query.month);
  new ApiResponse(200, 'Category distribution fetched', { data }).send(res);
});

// GET /api/analytics/cash-flow?months=12
const cashFlow = asyncHandler(async (req, res) => {
  const months = Math.min(60, Math.max(1, parseInt(req.query.months, 10) || 12));
  const data = await analyticsService.getCashFlow(req.user._id, months);
  new ApiResponse(200, 'Cash flow fetched', { data }).send(res);
});

module.exports = { weeklySpending, monthlySpending, categoryDistribution, cashFlow };
