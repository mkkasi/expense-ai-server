const express = require('express');
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { monthlyReportRules, yearlyReportRules } = require('../middleware/reportValidators');

const router = express.Router();

router.use(protect);
router.get('/monthly', monthlyReportRules, validate, reportController.monthlyReport);
router.get('/yearly', yearlyReportRules, validate, reportController.yearlyReport);

module.exports = router;
