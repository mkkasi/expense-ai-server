const express = require('express');
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { categoryCreateRules } = require('../middleware/categoryValidators');

const router = express.Router();

router.use(protect);

router.get('/', categoryController.listCategories);
router.post('/', categoryCreateRules, validate, categoryController.createCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
