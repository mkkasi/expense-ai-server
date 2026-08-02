const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      // Not required when the account was created via Google OAuth
      required: function () {
        return this.authProvider === 'local';
      },
      minlength: 8,
      select: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    language: {
      type: String,
      default: 'en',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    monthlyBudget: {
      type: Number,
      default: 0,
    },
    notificationPreferences: {
      budgetAlerts: { type: Boolean, default: true },
      billReminders: { type: Boolean, default: true },
      expenseReminders: { type: Boolean, default: true },
      goalReminders: { type: Boolean, default: true },
      aiSuggestions: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
    },
    financialHealthScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before saving, only if it was modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Store only a hash of the refresh token (never the raw token) so a DB leak
// doesn't let an attacker mint sessions.
userSchema.methods.setRefreshToken = function (token) {
  this.refreshTokenHash = crypto.createHash('sha256').update(token).digest('hex');
};

userSchema.methods.matchesRefreshToken = function (token) {
  if (!this.refreshTokenHash) return false;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return hash === this.refreshTokenHash;
};

userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return rawToken; // raw token is emailed to the user; only the hash is stored
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    role: this.role,
    currency: this.currency,
    language: this.language,
    monthlyBudget: this.monthlyBudget,
    financialHealthScore: this.financialHealthScore,
    notificationPreferences: this.notificationPreferences,
    isEmailVerified: this.isEmailVerified,
    authProvider: this.authProvider,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
