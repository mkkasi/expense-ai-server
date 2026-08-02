const express = require('express');
const expenseController = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { expenseCreateRules, expenseUpdateRules, listQueryRules } = require('../middleware/expenseValidators');

const router = express.Router();

router.use(protect);

router.get('/', listQueryRules, validate, expenseController.listExpenses);
router.get('/summary', expenseController.getSummary);
router.get('/:id', expenseController.getExpense);
router.post('/', upload.single('receipt'), expenseCreateRules, validate, expenseController.createExpense);
router.put('/:id', upload.single('receipt'), expenseUpdateRules, validate, expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
