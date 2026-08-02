const express = require('express');
const goalController = require('../controllers/goalController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { goalCreateRules, goalUpdateRules, contributeRules } = require('../middleware/goalValidators');

const router = express.Router();

router.use(protect);

router.get('/', goalController.listGoals);
router.get('/:id', goalController.getGoal);
router.post('/', goalCreateRules, validate, goalController.createGoal);
router.put('/:id', goalUpdateRules, validate, goalController.updateGoal);
router.patch('/:id/contribute', contributeRules, validate, goalController.contributeToGoal);
router.delete('/:id', goalController.deleteGoal);

module.exports = router;
