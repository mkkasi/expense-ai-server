const express = require('express');
const incomeController = require('../controllers/incomeController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { incomeCreateRules, incomeUpdateRules } = require('../middleware/incomeValidators');

const router = express.Router();

router.use(protect);

router.get('/', incomeController.listIncome);
router.get('/summary', incomeController.getSummary);
router.get('/:id', incomeController.getIncome);
router.post('/', incomeCreateRules, validate, incomeController.createIncome);
router.put('/:id', incomeUpdateRules, validate, incomeController.updateIncome);
router.delete('/:id', incomeController.deleteIncome);

module.exports = router;
