const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updatePreferencesRules } = require('../middleware/notificationValidators');

const router = express.Router();

router.use(protect);

// Registered before the /:id routes so 'preferences' is never mistaken for an id.
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', updatePreferencesRules, validate, notificationController.updatePreferences);

router.get('/', notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
