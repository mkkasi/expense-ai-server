const mongoose = require('mongoose');
const { INCOME_CATEGORIES, PAYMENT_METHODS, CURRENCIES, RECURRING_FREQUENCIES } = require('../config/constants');

const incomeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 100,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: INCOME_CATEGORIES,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'Cash',
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringFrequency: {
      type: String,
      enum: RECURRING_FREQUENCIES,
      default: 'none',
    },
    currency: {
      type: String,
      enum: CURRENCIES,
      default: 'INR',
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

incomeSchema.index({ user: 1, date: -1 });
incomeSchema.index({ user: 1, category: 1 });
incomeSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Income', incomeSchema);
