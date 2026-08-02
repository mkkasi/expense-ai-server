const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const budgetService = require('../services/budgetService');

// GET /api/budget
const listBudgets = asyncHandler(async (req, res) => {
  const budgets = await budgetService.listBudgets(req.user._id);
  new ApiResponse(200, 'Budgets fetched', { budgets }).send(res);
});

// GET /api/budget/:month  (month = 'YYYY-MM')
const getBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.getBudgetByMonth(req.user._id, req.params.month);
  new ApiResponse(200, 'Budget fetched', { budget }).send(res);
});

// GET /api/budget/:month/progress
const getBudgetProgress = asyncHandler(async (req, res) => {
  const budget = await budgetService.getBudgetByMonth(req.user._id, req.params.month);
  const progress = await budgetService.getBudgetProgress(req.user._id, budget);
  new ApiResponse(200, 'Budget progress fetched', progress).send(res);
});

// POST /api/budget
const createBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.createBudget(req.user._id, req.body);
  new ApiResponse(201, 'Budget created', { budget }).send(res, 201);
});

// PUT /api/budget/:id
const updateBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.updateBudget(req.user._id, req.params.id, req.body);
  new ApiResponse(200, 'Budget updated', { budget }).send(res);
});

// DELETE /api/budget/:id
const deleteBudget = asyncHandler(async (req, res) => {
  await budgetService.deleteBudget(req.user._id, req.params.id);
  new ApiResponse(200, 'Budget deleted').send(res);
});

module.exports = { listBudgets, getBudget, getBudgetProgress, createBudget, updateBudget, deleteBudget };
