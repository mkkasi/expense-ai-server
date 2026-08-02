const SystemLog = require('../models/SystemLog');

/**
 * Best-effort system logging for the admin panel's "System Logs" view.
 * Never throws and never awaited by callers on the hot path - a logging
 * failure must not break the request it's describing.
 */
const logEvent = (level, message, { meta = {}, userId = null } = {}) => {
  SystemLog.create({ level, message, meta, user: userId }).catch((err) => {
    console.error('[SystemLog] Failed to persist log entry:', err.message);
  });
};

module.exports = { logEvent };
