const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const expenseService = require('../services/expenseService');
const uploadBufferToCloudinary = require('../utils/uploadBufferToCloudinary');

// GET /api/expense
const listExpenses = asyncHandler(async (req, res) => {
  const result = await expenseService.listExpenses(req.user._id, req.query);
  new ApiResponse(200, 'Expenses fetched', result).send(res);
});

// GET /api/expense/summary
const getSummary = asyncHandler(async (req, res) => {
  const summary = await expenseService.getSummary(req.user._id, req.query);
  new ApiResponse(200, 'Expense summary fetched', summary).send(res);
});

// GET /api/expense/:id
const getExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.user._id, req.params.id);
  new ApiResponse(200, 'Expense fetched', { expense }).send(res);
});

// POST /api/expense
const createExpense = asyncHandler(async (req, res) => {
  let receiptImage;
  if (req.file) {
    receiptImage = await uploadBufferToCloudinary(req.file.buffer);
  }

  const expense = await expenseService.createExpense(req.user._id, {
    ...req.body,
    tags: normalizeTags(req.body.tags),
    ...(receiptImage && { receiptImage }),
  });

  new ApiResponse(201, 'Expense created', { expense }).send(res, 201);
});

// PUT /api/expense/:id
const updateExpense = asyncHandler(async (req, res) => {
  let updates = { ...req.body };
  if (req.body.tags) updates.tags = normalizeTags(req.body.tags);

  if (req.file) {
    updates.receiptImage = await uploadBufferToCloudinary(req.file.buffer);
  }

  const expense = await expenseService.updateExpense(req.user._id, req.params.id, updates);
  new ApiResponse(200, 'Expense updated', { expense }).send(res);
});

// DELETE /api/expense/:id
const deleteExpense = asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(req.user._id, req.params.id);
  new ApiResponse(200, 'Expense deleted').send(res);
});

// multipart 'tags' arrives as a JSON string or comma-separated list; normalize either way.
function normalizeTags(tags) {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not JSON — fall through to comma-split
  }
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  throw ApiError.badRequest('tags must be an array or comma-separated string');
}

module.exports = { listExpenses, getSummary, getExpense, createExpense, updateExpense, deleteExpense };
