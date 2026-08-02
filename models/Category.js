const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    // null user = a system default category, visible to everyone
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: 50,
    },
    type: {
      type: String,
      enum: ['expense', 'income'],
      required: true,
    },
    icon: {
      type: String,
      default: 'category',
    },
    color: {
      type: String,
      default: '#6C63FF',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// A user cannot create two custom categories with the same name+type;
// system defaults (user: null) are likewise unique by name+type.
categorySchema.index({ user: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
