const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const goalService = require('../services/goalService');

const listGoals = asyncHandler(async (req, res) => {
  const goals = await goalService.listGoals(req.user._id, req.query);
  new ApiResponse(200, 'Savings goals fetched', { goals }).send(res);
});

const getGoal = asyncHandler(async (req, res) => {
  const goal = await goalService.getGoalById(req.user._id, req.params.id);
  new ApiResponse(200, 'Savings goal fetched', { goal }).send(res);
});

const createGoal = asyncHandler(async (req, res) => {
  const goal = await goalService.createGoal(req.user._id, req.body);
  new ApiResponse(201, 'Savings goal created', { goal }).send(res, 201);
});

const updateGoal = asyncHandler(async (req, res) => {
  const goal = await goalService.updateGoal(req.user._id, req.params.id, req.body);
  new ApiResponse(200, 'Savings goal updated', { goal }).send(res);
});

// PATCH /api/goal/:id/contribute  { amount }
const contributeToGoal = asyncHandler(async (req, res) => {
  const goal = await goalService.contributeToGoal(req.user._id, req.params.id, Number(req.body.amount));
  new ApiResponse(200, 'Contribution recorded', { goal }).send(res);
});

const deleteGoal = asyncHandler(async (req, res) => {
  await goalService.deleteGoal(req.user._id, req.params.id);
  new ApiResponse(200, 'Savings goal deleted').send(res);
});

module.exports = { listGoals, getGoal, createGoal, updateGoal, contributeToGoal, deleteGoal };
