const express = require('express');
const budgetController = require('../controllers/budgetController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { monthParamRule, budgetCreateRules, budgetUpdateRules } = require('../middleware/budgetValidators');

const router = express.Router();

router.use(protect);

router.get('/', budgetController.listBudgets);
router.post('/', budgetCreateRules, validate, budgetController.createBudget);
router.get('/:month', monthParamRule, validate, budgetController.getBudget);
router.get('/:month/progress', monthParamRule, validate, budgetController.getBudgetProgress);
router.put('/:id', budgetUpdateRules, validate, budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

module.exports = router;
