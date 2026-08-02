/**
 * Seed script.
 *
 * Usage:
 *   npm run seed
 *
 * Creates (or promotes, if it already exists) an admin account, and seeds
 * the system default categories so a fresh database is immediately usable.
 *
 * Configure via environment variables (all optional, sensible defaults below):
 *   ADMIN_EMAIL             - defaults to mdkasimbash2004@gmail.com
 *   ADMIN_PASSWORD          - defaults to 'Kasim@Admin2026' (CHANGE THIS AFTER FIRST LOGIN)
 *   ADMIN_NAME              - defaults to 'Kasim Bash'
 *   ADMIN_RESET_PASSWORD    - set to 'true' to overwrite the password on an
 *                             already-existing account (default: false, so
 *                             re-running this script is safe and won't lock
 *                             you out by silently changing a password
 *                             you've since changed in the app)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { seedDefaultCategories } = require('../services/categoryService');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'mdkasimbash2004@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Kasim@Admin2026';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Kasim Bash';
const RESET_PASSWORD = process.env.ADMIN_RESET_PASSWORD === 'true';

const seedAdmin = async () => {
  let user = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

  if (!user) {
    user = new User({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD, // hashed by the pre('save') hook on User model
      role: 'admin',
      authProvider: 'local',
      isEmailVerified: true,
    });
    await user.save();
    console.log(`[Seed] Created new admin account: ${ADMIN_EMAIL}`);
    console.log(`[Seed] Password: ${ADMIN_PASSWORD}`);
    console.log('[Seed] IMPORTANT: log in and change this password immediately (Settings -> Change Password).');
    return;
  }

  // Account already exists - promote to admin, and only touch the password
  // if explicitly asked to, so this script is safe to re-run.
  let changed = false;
  if (user.role !== 'admin') {
    user.role = 'admin';
    changed = true;
  }
  if (RESET_PASSWORD) {
    user.password = ADMIN_PASSWORD;
    changed = true;
  }

  if (changed) {
    await user.save();
    console.log(`[Seed] Updated existing account ${ADMIN_EMAIL}: role=admin${RESET_PASSWORD ? ', password reset' : ''}`);
    if (RESET_PASSWORD) {
      console.log(`[Seed] Password: ${ADMIN_PASSWORD}`);
    }
  } else {
    console.log(`[Seed] ${ADMIN_EMAIL} already exists and is already an admin. No changes made.`);
    console.log('[Seed] (Re-run with ADMIN_RESET_PASSWORD=true if you need to reset the password.)');
  }
};

const run = async () => {
  await connectDB();
  await seedAdmin();
  await seedDefaultCategories();
  console.log('[Seed] Default categories seeded (idempotent).');
  await mongoose.connection.close();
  console.log('[Seed] Done.');
  process.exit(0);
};

run().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
