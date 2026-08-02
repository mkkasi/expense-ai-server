const Expense = require('../models/Expense');
const Income = require('../models/Income');
const ApiError = require('../utils/ApiError');

const monthBounds = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
};

const getMonthlyReport = async (userId, monthKey) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw ApiError.badRequest('month must be in YYYY-MM format');
  }
  const { start, end } = monthBounds(monthKey);
  const expenseMatch = { user: userId, date: { $gte: start, $lt: end } };

  const [expenseAgg, incomeAgg, byCategory, highestExpense, lowestExpense] = await Promise.all([
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Income.aggregate([
      { $match: { user: userId, date: { $gte: start, $lt: end } } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Expense.findOne(expenseMatch).sort('-amount').lean(),
    Expense.findOne(expenseMatch).sort('amount').lean(),
  ]);

  const totalExpense = expenseAgg[0]?.sum || 0;
  const expenseCount = expenseAgg[0]?.count || 0;
  const totalIncome = incomeAgg[0]?.sum || 0;

  return {
    month: monthKey,
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    expenseCount,
    averageExpense: expenseCount > 0 ? Math.round((totalExpense / expenseCount) * 100) / 100 : 0,
    topCategories: byCategory.slice(0, 5).map((c) => ({ category: c._id, total: c.total, count: c.count })),
    highestExpense: highestExpense || null,
    lowestExpense: lowestExpense || null,
  };
};

const getYearlyReport = async (userId, year) => {
  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
    throw ApiError.badRequest('year must be a valid 4-digit year');
  }

  const start = new Date(Date.UTC(yearNum, 0, 1));
  const end = new Date(Date.UTC(yearNum + 1, 0, 1));
  const matchExpense = { user: userId, date: { $gte: start, $lt: end } };

  const [monthlyExpense, monthlyIncome, byCategory, totalExpenseAgg, totalIncomeAgg] = await Promise.all([
    Expense.aggregate([
      { $match: matchExpense },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Income.aggregate([
      { $match: { user: userId, date: { $gte: start, $lt: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Expense.aggregate([
      { $match: matchExpense },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([{ $match: matchExpense }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
    Income.aggregate([
      { $match: { user: userId, date: { $gte: start, $lt: end } } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]),
  ]);

  const totalExpense = totalExpenseAgg[0]?.sum || 0;
  const totalIncome = totalIncomeAgg[0]?.sum || 0;

  return {
    year: yearNum,
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    monthlyBreakdown: monthlyExpense.map((m) => ({
      month: m._id,
      expense: m.total,
      income: monthlyIncome.find((i) => i._id === m._id)?.total || 0,
    })),
    topCategories: byCategory.slice(0, 5).map((c) => ({ category: c._id, total: c.total })),
  };
};

module.exports = { getMonthlyReport, getYearlyReport };
