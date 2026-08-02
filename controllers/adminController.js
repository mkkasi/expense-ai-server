const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const adminService = require('../services/adminService');

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();
  new ApiResponse(200, 'Admin dashboard stats fetched', stats).send(res);
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await adminService.listUsers(req.query);
  new ApiResponse(200, 'Users fetched', result).send(res);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await adminService.updateUser(req.params.id, req.body);
  new ApiResponse(200, 'User updated', { user }).send(res);
});

const deleteUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.params.id);
  new ApiResponse(200, 'User deleted').send(res);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await adminService.createDefaultCategory(req.body);
  new ApiResponse(201, 'Default category created', { category }).send(res, 201);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await adminService.updateCategory(req.params.id, req.body);
  new ApiResponse(200, 'Category updated', { category }).send(res);
});

const deleteCategory = asyncHandler(async (req, res) => {
  await adminService.deleteAnyCategory(req.params.id);
  new ApiResponse(200, 'Category deleted').send(res);
});

const listLogs = asyncHandler(async (req, res) => {
  const result = await adminService.listSystemLogs(req.query);
  new ApiResponse(200, 'System logs fetched', result).send(res);
});

const analytics = asyncHandler(async (req, res) => {
  const result = await adminService.getPlatformAnalytics();
  new ApiResponse(200, 'Platform analytics fetched', result).send(res);
});

const reportsOverview = asyncHandler(async (req, res) => {
  const result = await adminService.getPlatformReportsOverview();
  new ApiResponse(200, 'Platform reports fetched', result).send(res);
});

module.exports = {
  getDashboard,
  listUsers,
  updateUser,
  deleteUser,
  createCategory,
  updateCategory,
  deleteCategory,
  listLogs,
  analytics,
  reportsOverview,
};
