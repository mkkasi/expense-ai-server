const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/authService');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/api/auth',
};

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.registerUser({ name, email, password });

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  new ApiResponse(201, 'Account created successfully', {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
  }).send(res, 201);
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.loginUser({ email, password });

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  new ApiResponse(200, 'Login successful', {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
  }).send(res);
});

// POST /api/auth/google
const googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const { user, accessToken, refreshToken } = await authService.loginWithGoogle(idToken);

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  new ApiResponse(200, 'Google login successful', {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
  }).send(res);
});

// POST /api/auth/refresh-token
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  const tokens = await authService.refreshAccessToken(token);

  res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
  new ApiResponse(200, 'Token refreshed', tokens).send(res);
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id);
  res.clearCookie('refreshToken', { path: '/api/auth' });
  new ApiResponse(200, 'Logged out successfully').send(res);
});

// POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  new ApiResponse(200, 'If that email exists, a reset link has been sent').send(res);
});

// POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  await authService.resetPassword(token, password);
  new ApiResponse(200, 'Password reset successfully. Please log in again.').send(res);
});

// PUT /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user._id, currentPassword, newPassword);
  new ApiResponse(200, 'Password changed successfully').send(res);
});

// GET /api/auth/profile
const getProfile = asyncHandler(async (req, res) => {
  new ApiResponse(200, 'Profile fetched', { user: req.user.toSafeObject() }).send(res);
});

// PUT /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'avatar', 'currency', 'language', 'monthlyBudget'];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  });
  await req.user.save();
  new ApiResponse(200, 'Profile updated', { user: req.user.toSafeObject() }).send(res);
});

// DELETE /api/auth/account
const deleteAccount = asyncHandler(async (req, res) => {
  await authService.deleteAccount(req.user._id);
  res.clearCookie('refreshToken', { path: '/api/auth' });
  new ApiResponse(200, 'Account deleted successfully').send(res);
});

module.exports = {
  register,
  login,
  googleLogin,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
  updateProfile,
  deleteAccount,
};
