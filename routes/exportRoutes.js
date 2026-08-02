const express = require('express');
const exportController = require('../controllers/exportController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { exportRules } = require('../middleware/exportValidators');

const router = express.Router();

router.use(protect);
router.get('/transactions', exportRules, validate, exportController.exportTransactions);

module.exports = router;
