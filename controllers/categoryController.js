const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const categoryService = require('../services/categoryService');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories(req.user._id, req.query.type);
  new ApiResponse(200, 'Categories fetched', { categories }).send(res);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.user._id, req.body);
  new ApiResponse(201, 'Category created', { category }).send(res, 201);
});

const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.user._id, req.params.id);
  new ApiResponse(200, 'Category deleted').send(res);
});

module.exports = { listCategories, createCategory, deleteCategory };
