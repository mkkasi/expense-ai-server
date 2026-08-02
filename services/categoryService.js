const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require('../config/constants');

/**
 * Seeds the system default categories (idempotent - safe to call on every boot).
 * Custom user categories live alongside these with `user` set to their id.
 */
const seedDefaultCategories = async () => {
  const defaults = [
    ...EXPENSE_CATEGORIES.map((name) => ({ name, type: 'expense', isDefault: true })),
    ...INCOME_CATEGORIES.map((name) => ({ name, type: 'income', isDefault: true })),
  ];

  await Promise.all(
    defaults.map((cat) =>
      Category.findOneAndUpdate(
        { user: null, name: cat.name, type: cat.type },
        { $setOnInsert: cat },
        { upsert: true, new: true }
      )
    )
  );
};

/**
 * Returns system defaults + this user's custom categories, optionally
 * filtered by type ('expense' | 'income').
 */
const listCategories = async (userId, type) => {
  const filter = { $or: [{ user: null }, { user: userId }] };
  if (type) filter.type = type;
  return Category.find(filter).sort({ isDefault: -1, name: 1 });
};

const createCategory = async (userId, { name, type, icon, color }) => {
  const existing = await Category.findOne({ user: userId, name, type });
  if (existing) throw ApiError.conflict(`A ${type} category named "${name}" already exists`);

  return Category.create({ user: userId, name, type, icon, color, isDefault: false });
};

const deleteCategory = async (userId, id) => {
  const category = await Category.findOne({ _id: id, user: userId });
  if (!category) {
    throw ApiError.notFound('Category not found or you do not have permission to delete it');
  }
  if (category.isDefault) throw ApiError.forbidden('Default categories cannot be deleted');
  await category.deleteOne();
};

module.exports = { seedDefaultCategories, listCategories, createCategory, deleteCategory };
