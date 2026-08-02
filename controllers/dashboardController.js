const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const dashboardService = require('../services/dashboardService');
const User = require('../models/User');

// GET /api/dashboard?month=YYYY-MM (defaults to current month)
const getDashboard = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getDashboardSummary(req.user._id, req.query.month);

  // Persist the latest score onto the user doc so it's available cheaply
  // elsewhere (e.g. profile) without recomputing.
  await User.findByIdAndUpdate(req.user._id, { financialHealthScore: summary.financialHealthScore });

  new ApiResponse(200, 'Dashboard summary fetched', summary).send(res);
});

module.exports = { getDashboard };
