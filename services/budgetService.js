const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');

/**
 * Computes actual spend per category (and overall) for the given month,
 * then merges it against the budget limits to produce a progress report.
 */
const getBudgetProgress = async (userId, budget) => {
  const [year, month] = budget.month.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1)); // first day of next month (exclusive)

  const spendByCategory = await Expense.aggregate([
    {
      $match: {
        user: budget.user,
        date: { $gte: startDate, $lt: endDate },
      },
    },
    { $group: { _id: '$category', spent: { $sum: '$amount' } } },
  ]);

  const spendMap = Object.fromEntries(spendByCategory.map((s) => [s._id, s.spent]));
  const totalSpent = spendByCategory.reduce((sum, s) => sum + s.spent, 0);

  const categoryProgress = budget.categoryBudgets.map((cb) => {
    const spent = spendMap[cb.category] || 0;
    const percentUsed = cb.limit > 0 ? Math.round((spent / cb.limit) * 100) : 0;
    return {
      category: cb.category,
      limit: cb.limit,
      spent,
      remaining: Math.max(0, cb.limit - spent),
      percentUsed,
      isOverBudget: spent > cb.limit,
      isNearLimit: percentUsed >= budget.alertThresholdPercent && spent <= cb.limit,
    };
  });

  const overallPercentUsed = budget.totalBudget > 0 ? Math.round((totalSpent / budget.totalBudget) * 100) : 0;

  return {
    budget,
    totalBudget: budget.totalBudget,
    totalSpent,
    remaining: Math.max(0, budget.totalBudget - totalSpent),
    percentUsed: overallPercentUsed,
    isOverBudget: totalSpent > budget.totalBudget,
    isNearLimit: overallPercentUsed >= budget.alertThresholdPercent && totalSpent <= budget.totalBudget,
    categoryProgress,
  };
};

const listBudgets = async (userId) => {
  return Budget.find({ user: userId }).sort('-month');
};

const getBudgetByMonth = async (userId, month) => {
  const budget = await Budget.findOne({ user: userId, month });
  if (!budget) throw ApiError.notFound(`No budget found for ${month}`);
  return budget;
};

const createBudget = async (userId, payload) => {
  const existing = await Budget.findOne({ user: userId, month: payload.month });
  if (existing) throw ApiError.conflict(`A budget for ${payload.month} already exists. Use update instead.`);

  return Budget.create({ ...payload, user: userId });
};

const updateBudget = async (userId, id, payload) => {
  const budget = await Budget.findOne({ _id: id, user: userId });
  if (!budget) throw ApiError.notFound('Budget not found');

  Object.assign(budget, payload);
  await budget.save();
  return budget;
};

const deleteBudget = async (userId, id) => {
  const budget = await Budget.findOne({ _id: id, user: userId });
  if (!budget) throw ApiError.notFound('Budget not found');
  await budget.deleteOne();
};

module.exports = {
  listBudgets,
  getBudgetByMonth,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetProgress,
};
