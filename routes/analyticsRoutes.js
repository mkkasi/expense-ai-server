const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/weekly-spending', analyticsController.weeklySpending);
router.get('/monthly-spending', analyticsController.monthlySpending);
router.get('/category-distribution', analyticsController.categoryDistribution);
router.get('/cash-flow', analyticsController.cashFlow);

module.exports = router;
