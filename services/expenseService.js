const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');
const parsePagination = require('../utils/parsePagination');
const cloudinary = require('../config/cloudinary');

/**
 * Builds a Mongoose filter object from list-query params, scoped to a user.
 * Supports: category, paymentMethod, date range, min/max amount, free-text search.
 */
const buildFilter = (userId, query) => {
  const filter = { user: userId };

  if (query.category) filter.category = query.category;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;

  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
  }

  if (query.minAmount || query.maxAmount) {
    filter.amount = {};
    if (query.minAmount) filter.amount.$gte = Number(query.minAmount);
    if (query.maxAmount) filter.amount.$lte = Number(query.maxAmount);
  }

  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
      { location: { $regex: query.search, $options: 'i' } },
    ];
  }

  if (query.tag) filter.tags = query.tag;

  return filter;
};

const listExpenses = async (userId, query) => {
  const filter = buildFilter(userId, query);
  const { skip, limit, sort, buildMeta } = parsePagination(query, '-date');

  const [items, total, totalAmountAgg] = await Promise.all([
    Expense.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);

  return {
    items,
    meta: buildMeta(total),
    totalAmount: totalAmountAgg[0]?.sum || 0,
  };
};

const getExpenseById = async (userId, id) => {
  const expense = await Expense.findOne({ _id: id, user: userId });
  if (!expense) throw ApiError.notFound('Expense not found');
  return expense;
};

const createExpense = async (userId, payload) => {
  return Expense.create({ ...payload, user: userId });
};

const updateExpense = async (userId, id, payload) => {
  const expense = await getExpenseById(userId, id);
  Object.assign(expense, payload);
  await expense.save();
  return expense;
};

const deleteExpense = async (userId, id) => {
  const expense = await getExpenseById(userId, id);

  if (expense.receiptImage?.publicId) {
    try {
      await cloudinary.uploader.destroy(expense.receiptImage.publicId);
    } catch (err) {
      // Non-fatal: the DB record deletion should still proceed even if the
      // remote asset cleanup fails (e.g. already deleted, network blip).
      console.error('[Cloudinary] Failed to delete receipt image:', err.message);
    }
  }

  await expense.deleteOne();
};

/**
 * Aggregated numbers used across the dashboard/analytics/AI modules.
 * Kept here (not duplicated) so every consumer sees the same math.
 */
const getSummary = async (userId, { startDate, endDate } = {}) => {
  const match = { user: userId };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }

  const [byCategory, total] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([{ $match: match }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);

  return {
    totalExpense: total[0]?.sum || 0,
    byCategory: byCategory.map((c) => ({ category: c._id, total: c.total, count: c.count })),
  };
};

module.exports = {
  listExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getSummary,
  buildFilter,
};
