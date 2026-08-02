const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES } = require('../config/constants');

const categoryBudgetSchema = new mongoose.Schema(
  {
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    limit: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Stored as 'YYYY-MM' so a user has at most one budget document per month.
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format'],
    },
    totalBudget: {
      type: Number,
      required: [true, 'Total monthly budget is required'],
      min: 0,
    },
    categoryBudgets: {
      type: [categoryBudgetSchema],
      default: [],
    },
    alertThresholdPercent: {
      type: Number,
      default: 80, // notify when spending crosses this % of the budget
      min: 1,
      max: 100,
    },
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
