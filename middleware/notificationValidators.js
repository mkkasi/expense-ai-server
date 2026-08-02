const { body } = require('express-validator');

const updatePreferencesRules = [
  body('budgetAlerts').optional().isBoolean().withMessage('budgetAlerts must be a boolean'),
  body('billReminders').optional().isBoolean().withMessage('billReminders must be a boolean'),
  body('expenseReminders').optional().isBoolean().withMessage('expenseReminders must be a boolean'),
  body('goalReminders').optional().isBoolean().withMessage('goalReminders must be a boolean'),
  body('aiSuggestions').optional().isBoolean().withMessage('aiSuggestions must be a boolean'),
  body('emailNotifications').optional().isBoolean().withMessage('emailNotifications must be a boolean'),
  body('pushNotifications').optional().isBoolean().withMessage('pushNotifications must be a boolean'),
];

module.exports = { updatePreferencesRules };
