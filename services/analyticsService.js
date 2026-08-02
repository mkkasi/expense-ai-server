const Expense = require('../models/Expense');
const Income = require('../models/Income');

/**
 * Daily spending for the last N days, bucketed by ISO date (YYYY-MM-DD).
 * The Flutter client groups these into weeks for the "Weekly Spending" chart.
 */
const getWeeklySpending = async (userId, weeks = 8) => {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - weeks * 7);

  const rows = await Expense.aggregate([
    { $match: { user: userId, date: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({ date: r._id, total: r.total }));
};

/**
 * Monthly totals (income & expense side by side) for the last N months.
 * Powers both "Monthly Spending" and feeds into "Monthly Trend" for AI features.
 */
const getMonthlySpending = async (userId, months = 12) => {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months);
  since.setUTCDate(1);

  const [expenseRows, incomeRows] = await Promise.all([
    Expense.aggregate([
      { $match: { user: userId, date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
    ]),
    Income.aggregate([
      { $match: { user: userId, date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const expenseMap = Object.fromEntries(expenseRows.map((r) => [r._id, r.total]));
  const incomeMap = Object.fromEntries(incomeRows.map((r) => [r._id, r.total]));
  const allMonths = [...new Set([...Object.keys(expenseMap), ...Object.keys(incomeMap)])].sort();

  return allMonths.map((month) => ({
    month,
    income: incomeMap[month] || 0,
    expense: expenseMap[month] || 0,
  }));
};

/**
 * Category breakdown for a given month (or all-time if no month given),
 * with each category's share of the total for a pie chart.
 */
const getCategoryDistribution = async (userId, monthKey) => {
  const match = { user: userId };
  if (monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    match.date = {
      $gte: new Date(Date.UTC(year, month - 1, 1)),
      $lt: new Date(Date.UTC(year, month, 1)),
    };
  }

  const rows = await Expense.aggregate([
    { $match: match },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return rows.map((r) => ({
    category: r._id,
    total: r.total,
    count: r.count,
    percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 1000) / 10 : 0,
  }));
};

/**
 * Month-over-month cash flow: income, expense, and net (income - expense).
 * Same shape as monthly spending but with `net` precomputed for the chart.
 */
const getCashFlow = async (userId, months = 12) => {
  const monthly = await getMonthlySpending(userId, months);
  return monthly.map((m) => ({ ...m, net: m.income - m.expense }));
};

module.exports = { getWeeklySpending, getMonthlySpending, getCategoryDistribution, getCashFlow };
