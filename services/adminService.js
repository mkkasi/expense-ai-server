const User = require('../models/User');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const Category = require('../models/Category');
const SystemLog = require('../models/SystemLog');
const ApiError = require('../utils/ApiError');
const parsePagination = require('../utils/parsePagination');

// ---------- Dashboard ----------

const getDashboardStats = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const [totalUsers, totalExpenses, totalIncome, dailyExpenseTxns, dailyIncomeTxns, expenseVolumeAgg, incomeVolumeAgg] =
    await Promise.all([
      User.countDocuments(),
      Expense.countDocuments(),
      Income.countDocuments(),
      Expense.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Income.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Expense.aggregate([{ $group: { _id: null, sum: { $sum: '$amount' } } }]),
      Income.aggregate([{ $group: { _id: null, sum: { $sum: '$amount' } } }]),
    ]);

  const dailyMap = {};
  dailyExpenseTxns.forEach((d) => (dailyMap[d._id] = { date: d._id, expenseCount: d.count, incomeCount: 0 }));
  dailyIncomeTxns.forEach((d) => {
    dailyMap[d._id] = dailyMap[d._id] || { date: d._id, expenseCount: 0, incomeCount: 0 };
    dailyMap[d._id].incomeCount = d.count;
  });

  return {
    totalUsers,
    totalTransactions: totalExpenses + totalIncome,
    dailyTransactions: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    // "Revenue" here means total money volume tracked by the platform
    // (this app has no monetization/billing model of its own).
    platformVolumeStats: {
      totalExpenseVolume: expenseVolumeAgg[0]?.sum || 0,
      totalIncomeVolume: incomeVolumeAgg[0]?.sum || 0,
    },
  };
};

// ---------- User management ----------

const listUsers = async (query) => {
  const filter = {};
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

  const { skip, limit, sort, buildMeta } = parsePagination(query, '-createdAt');

  const [items, total] = await Promise.all([
    User.find(filter).select('-password -refreshTokenHash').sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total) };
};

const updateUser = async (id, { role, isActive }) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();

  return user.toSafeObject();
};

const deleteUser = async (id) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  await Promise.all([
    Expense.deleteMany({ user: id }),
    Income.deleteMany({ user: id }),
    user.deleteOne(),
  ]);
};

// ---------- Category management (admin can manage system defaults) ----------

const createDefaultCategory = async ({ name, type, icon, color }) => {
  const existing = await Category.findOne({ user: null, name, type });
  if (existing) throw ApiError.conflict(`A default ${type} category named "${name}" already exists`);
  return Category.create({ user: null, name, type, icon, color, isDefault: true });
};

const updateCategory = async (id, payload) => {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category not found');
  Object.assign(category, payload);
  await category.save();
  return category;
};

const deleteAnyCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category not found');
  await category.deleteOne();
};

// ---------- System logs ----------

const listSystemLogs = async (query) => {
  const filter = {};
  if (query.level) filter.level = query.level;

  const { skip, limit, sort, buildMeta } = parsePagination(query, '-createdAt');

  const [items, total] = await Promise.all([
    SystemLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    SystemLog.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total) };
};

// ---------- Platform-wide analytics & reports ----------

const getPlatformAnalytics = async () => {
  const [usersByMonth, categoryPopularity] = await Promise.all([
    User.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Expense.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const totalUsers = await User.countDocuments();
  const totalTransactions = (await Expense.countDocuments()) + (await Income.countDocuments());

  return {
    userGrowth: usersByMonth.map((u) => ({ month: u._id, newUsers: u.count })),
    categoryPopularity: categoryPopularity.map((c) => ({ category: c._id, transactionCount: c.count, totalAmount: c.total })),
    averageTransactionsPerUser: totalUsers > 0 ? Math.round((totalTransactions / totalUsers) * 10) / 10 : 0,
  };
};

const getPlatformReportsOverview = async () => {
  const [categoryTotals, monthlyTotals] = await Promise.all([
    Expense.aggregate([
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]),
  ]);

  return {
    categoryTotals: categoryTotals.map((c) => ({ category: c._id, total: c.total })),
    monthlyTotals: monthlyTotals.map((m) => ({ month: m._id, total: m.total })),
  };
};

module.exports = {
  getDashboardStats,
  listUsers,
  updateUser,
  deleteUser,
  createDefaultCategory,
  updateCategory,
  deleteAnyCategory,
  listSystemLogs,
  getPlatformAnalytics,
  getPlatformReportsOverview,
};
