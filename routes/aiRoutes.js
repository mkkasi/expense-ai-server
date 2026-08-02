const express = require('express');
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { categorizeRules, chatRules } = require('../middleware/aiValidators');

const router = express.Router();

router.use(protect);

router.post('/categorize', categorizeRules, validate, aiController.categorize);
router.post('/receipt', upload.single('image'), aiController.scanReceipt);
router.post('/suggestions', aiController.suggestions);
router.get('/analysis', aiController.analysis);
router.get('/budget-recommendation', aiController.budgetRecommendation);
router.post('/predict', aiController.predict);
router.get('/anomalies', aiController.anomalies);
router.post('/chat', chatRules, validate, aiController.chat);
router.get('/chat/history', aiController.chatHistory);
router.delete('/chat/history', aiController.clearChat);

module.exports = router;
