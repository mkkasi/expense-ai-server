const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES, PAYMENT_METHODS, CURRENCIES, RECURRING_FREQUENCIES } = require('../config/constants');

const expenseSchema = new mongoose.Schema(
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
      enum: EXPENSE_CATEGORIES,
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
    time: {
      type: String, // stored as 'HH:mm', date+time combined client-side for display
      default: null,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    receiptImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }, // Cloudinary public_id, for deletion
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
    isAiGenerated: {
      type: Boolean,
      default: false, // true when created via receipt scanner / AI categorization
    },
    isAnomaly: {
      type: Boolean,
      default: false, // flagged by the anomaly-detection AI feature
    },
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1 });
expenseSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Expense', expenseSchema);
