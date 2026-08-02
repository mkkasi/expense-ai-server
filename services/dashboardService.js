const Expense = require('../models/Expense');
const Income = require('../models/Income');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');

const currentMonthKey = (date = new Date()) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const sumAmount = async (Model, match) => {
  const result = await Model.aggregate([{ $match: match }, { $group: { _id: null, sum: { $sum: '$amount' } } }]);
  return result[0]?.sum || 0;
};

/**
 * Rule-based financial health score (0-100), used until the AI module
 * (Module 5) replaces/augments it with an LLM-generated narrative score.
 * Weighs: savings rate (40%), budget adherence (35%), goal progress (25%).
 */
const computeFinancialHealthScore = ({ monthIncome, monthExpense, budgetPercentUsed, avgGoalProgress }) => {
  let savingsRateScore = 50; // neutral default when there's no income yet
  if (monthIncome > 0) {
    const savingsRate = (monthIncome - monthExpense) / monthIncome;
    savingsRateScore = Math.max(0, Math.min(100, Math.round(50 + savingsRate * 100)));
  }

  let budgetScore = 70; // neutral default when no budget is set
  if (budgetPercentUsed !== null) {
    budgetScore = budgetPercentUsed <= 100 ? Math.round(100 - budgetPercentUsed * 0.5) : Math.max(0, 50 - (budgetPercentUsed - 100));
  }

  const goalScore = avgGoalProgress; // already 0-100

  const score = Math.round(savingsRateScore * 0.4 + budgetScore * 0.35 + goalScore * 0.25);
  return Math.max(0, Math.min(100, score));
};

const getDashboardSummary = async (userId, monthKey = currentMonthKey()) => {
  const [year, month] = monthKey.split('-').map(Number);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startOfNextMonth = new Date(Date.UTC(year, month, 1));
  const monthMatch = { user: userId, date: { $gte: startOfMonth, $lt: startOfNextMonth } };

  const [
    monthIncome,
    monthExpense,
    totalIncomeAllTime,
    totalExpenseAllTime,
    budget,
    recentExpenses,
    recentIncome,
    goals,
  ] = await Promise.all([
    sumAmount(Income, monthMatch),
    sumAmount(Expense, monthMatch),
    sumAmount(Income, { user: userId }),
    sumAmount(Expense, { user: userId }),
    Budget.findOne({ user: userId, month: monthKey }),
    Expense.find({ user: userId }).sort('-date').limit(5).lean(),
    Income.find({ user: userId }).sort('-date').limit(5).lean(),
    Goal.find({ user: userId, isCompleted: false }),
  ]);

  const currentBalance = totalIncomeAllTime - totalExpenseAllTime;
  const savings = monthIncome - monthExpense;
  const monthlyBudget = budget?.totalBudget || 0;
  const budgetRemaining = budget ? Math.max(0, monthlyBudget - monthExpense) : null;
  const budgetPercentUsed = budget && monthlyBudget > 0 ? Math.round((monthExpense / monthlyBudget) * 100) : null;

  const recentTransactions = [
    ...recentExpenses.map((e) => ({ ...e, type: 'expense' })),
    ...recentIncome.map((i) => ({ ...i, type: 'income' })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const avgGoalProgress = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + Math.min(100, (g.currentAmount / g.targetAmount) * 100), 0) / goals.length)
    : 50;

  const financialHealthScore = computeFinancialHealthScore({
    monthIncome,
    monthExpense,
    budgetPercentUsed,
    avgGoalProgress,
  });

  return {
    month: monthKey,
    currentBalance,
    income: monthIncome,
    expense: monthExpense,
    savings,
    monthlyBudget,
    budgetRemaining,
    budgetPercentUsed,
    recentTransactions,
    financialHealthScore,
    activeGoalsCount: goals.length,
  };
};

module.exports = { getDashboardSummary, currentMonthKey, computeFinancialHealthScore };
