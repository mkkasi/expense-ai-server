const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { generateTokenPair, verifyRefreshToken } = require('../utils/generateTokens');
const sendEmail = require('../utils/sendEmail');
const { logEvent } = require('../utils/systemLogger');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerUser = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name, email, password, authProvider: 'local' });

  const { accessToken, refreshToken } = generateTokenPair(user._id, user.role);
  user.setRefreshToken(refreshToken);
  user.lastLoginAt = new Date();
  await user.save();

  logEvent('info', 'New user registered', { userId: user._id, meta: { email: user.email } });

  return { user, accessToken, refreshToken };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || user.authProvider !== 'local') {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const { accessToken, refreshToken } = generateTokenPair(user._id, user.role);
  user.setRefreshToken(refreshToken);
  user.lastLoginAt = new Date();
  await user.save();

  logEvent('info', 'User logged in', { userId: user._id, meta: { email: user.email, method: 'local' } });

  return { user, accessToken, refreshToken };
};

const loginWithGoogle = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw ApiError.unauthorized('Invalid Google token');
  }

  let user = await User.findOne({ email: payload.email });

  if (!user) {
    user = await User.create({
      name: payload.name || payload.email.split('@')[0],
      email: payload.email,
      googleId: payload.sub,
      avatar: payload.picture || '',
      authProvider: 'google',
      isEmailVerified: true,
    });
  } else if (user.authProvider !== 'google') {
    // Link the Google identity to an existing local account
    user.googleId = payload.sub;
    user.authProvider = 'google';
    user.isEmailVerified = true;
    if (!user.avatar) user.avatar = payload.picture || '';
  }

  const { accessToken, refreshToken } = generateTokenPair(user._id, user.role);
  user.setRefreshToken(refreshToken);
  user.lastLoginAt = new Date();
  await user.save();

  return { user, accessToken, refreshToken };
};

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token required');

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || !user.matchesRefreshToken(refreshToken)) {
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  const tokens = generateTokenPair(user._id, user.role);
  user.setRefreshToken(tokens.refreshToken);
  await user.save();

  return tokens;
};

const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
};

const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email });
  // Always respond success-shaped even if user not found, to avoid email enumeration.
  if (!user) return;

  const rawToken = user.createPasswordResetToken();
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your Expense AI password',
    html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 15 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    text: `Reset your password: ${resetUrl} (expires in 15 minutes)`,
  });
};

const resetPassword = async (rawToken, newPassword) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetTokenHash +passwordResetExpires');

  if (!user) throw ApiError.badRequest('Password reset token is invalid or has expired');

  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = undefined; // force re-login on all devices
  await user.save();
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  if (!user || user.authProvider !== 'local') {
    throw ApiError.badRequest('Password change is not available for this account');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect');

  user.password = newPassword;
  await user.save();
};

const deleteAccount = async (userId) => {
  await User.findByIdAndDelete(userId);
  // Note: cascading deletion of expenses/income/budgets/goals for this user
  // is handled in the Expense/Income/Budget/Goal modules (next build step).
};

module.exports = {
  registerUser,
  loginUser,
  loginWithGoogle,
  refreshAccessToken,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  changePassword,
  deleteAccount,
};
