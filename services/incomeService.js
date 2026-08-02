const Income = require('../models/Income');
const ApiError = require('../utils/ApiError');
const parsePagination = require('../utils/parsePagination');

const buildFilter = (userId, query) => {
  const filter = { user: userId };

  if (query.category) filter.category = query.category;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;

  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
  }

  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    ];
  }

  return filter;
};

const listIncome = async (userId, query) => {
  const filter = buildFilter(userId, query);
  const { skip, limit, sort, buildMeta } = parsePagination(query, '-date');

  const [items, total, totalAmountAgg] = await Promise.all([
    Income.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Income.countDocuments(filter),
    Income.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);

  return { items, meta: buildMeta(total), totalAmount: totalAmountAgg[0]?.sum || 0 };
};

const getIncomeById = async (userId, id) => {
  const income = await Income.findOne({ _id: id, user: userId });
  if (!income) throw ApiError.notFound('Income not found');
  return income;
};

const createIncome = async (userId, payload) => Income.create({ ...payload, user: userId });

const updateIncome = async (userId, id, payload) => {
  const income = await getIncomeById(userId, id);
  Object.assign(income, payload);
  await income.save();
  return income;
};

const deleteIncome = async (userId, id) => {
  const income = await getIncomeById(userId, id);
  await income.deleteOne();
};

const getSummary = async (userId, { startDate, endDate } = {}) => {
  const match = { user: userId };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }

  const [byCategory, total] = await Promise.all([
    Income.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Income.aggregate([{ $match: match }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
  ]);

  return {
    totalIncome: total[0]?.sum || 0,
    byCategory: byCategory.map((c) => ({ category: c._id, total: c.total, count: c.count })),
  };
};

module.exports = { listIncome, getIncomeById, createIncome, updateIncome, deleteIncome, getSummary, buildFilter };
