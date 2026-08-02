const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const parsePagination = require('../utils/parsePagination');

const PREFERENCE_KEYS = [
  'budgetAlerts',
  'billReminders',
  'expenseReminders',
  'goalReminders',
  'aiSuggestions',
  'emailNotifications',
  'pushNotifications',
];

const listNotifications = async (userId, query) => {
  const filter = { user: userId };
  if (query.unreadOnly === 'true') filter.isRead = false;
  if (query.type) filter.type = query.type;

  const { skip, limit, sort, buildMeta } = parsePagination(query, '-createdAt');

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);

  return { items, meta: buildMeta(total), unreadCount };
};

/**
 * Creates a notification for a user. This is the single entry point used by
 * the budget-alert, bill-reminder, goal-reminder, and AI-suggestion producers
 * (built in later modules) so the shape stays consistent everywhere.
 */
const createNotification = async (userId, { type, title, message, relatedTo }) => {
  return Notification.create({ user: userId, type, title, message, relatedTo });
};

const markAsRead = async (userId, id) => {
  const notification = await Notification.findOne({ _id: id, user: userId });
  if (!notification) throw ApiError.notFound('Notification not found');
  notification.isRead = true;
  await notification.save();
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });
};

const deleteNotification = async (userId, id) => {
  const notification = await Notification.findOne({ _id: id, user: userId });
  if (!notification) throw ApiError.notFound('Notification not found');
  await notification.deleteOne();
};

/**
 * Returns the user's notification preferences, falling back to the schema
 * defaults if the user document predates this field.
 */
const getPreferences = async (userId) => {
  const user = await User.findById(userId).select('notificationPreferences');
  if (!user) throw ApiError.notFound('User not found');
  return user.notificationPreferences;
};

/**
 * Updates only the preference keys that were provided, leaving the rest
 * untouched, and returns the resulting preferences object.
 */
const updatePreferences = async (userId, updates = {}) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  PREFERENCE_KEYS.forEach((key) => {
    if (typeof updates[key] === 'boolean') {
      user.notificationPreferences[key] = updates[key];
    }
  });

  await user.save();
  return user.notificationPreferences;
};

/**
 * Checks whether the user currently allows creation of the given
 * notification type, so producers can skip creating notifications the
 * user has turned off. Falls back to true (send it) if unset.
 */
const isTypeEnabled = async (userId, type) => {
  const prefs = await getPreferences(userId);
  const map = {
    budget_alert: 'budgetAlerts',
    bill_reminder: 'billReminders',
    expense_reminder: 'expenseReminders',
    goal_reminder: 'goalReminders',
    ai_suggestion: 'aiSuggestions',
  };
  const key = map[type];
  if (!key) return true;
  return prefs?.[key] !== false;
};

module.exports = {
  listNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
  isTypeEnabled,
  PREFERENCE_KEYS,
};
