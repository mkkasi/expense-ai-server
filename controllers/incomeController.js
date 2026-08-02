const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const incomeService = require('../services/incomeService');

const listIncome = asyncHandler(async (req, res) => {
  const result = await incomeService.listIncome(req.user._id, req.query);
  new ApiResponse(200, 'Income fetched', result).send(res);
});

const getSummary = asyncHandler(async (req, res) => {
  const summary = await incomeService.getSummary(req.user._id, req.query);
  new ApiResponse(200, 'Income summary fetched', summary).send(res);
});

const getIncome = asyncHandler(async (req, res) => {
  const income = await incomeService.getIncomeById(req.user._id, req.params.id);
  new ApiResponse(200, 'Income fetched', { income }).send(res);
});

const createIncome = asyncHandler(async (req, res) => {
  const income = await incomeService.createIncome(req.user._id, req.body);
  new ApiResponse(201, 'Income created', { income }).send(res, 201);
});

const updateIncome = asyncHandler(async (req, res) => {
  const income = await incomeService.updateIncome(req.user._id, req.params.id, req.body);
  new ApiResponse(200, 'Income updated', { income }).send(res);
});

const deleteIncome = asyncHandler(async (req, res) => {
  await incomeService.deleteIncome(req.user._id, req.params.id);
  new ApiResponse(200, 'Income deleted').send(res);
});

module.exports = { listIncome, getSummary, getIncome, createIncome, updateIncome, deleteIncome };
