const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateUserRules, createCategoryRules, updateCategoryRules } = require('../middleware/adminValidators');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/dashboard', adminController.getDashboard);

router.get('/users', adminController.listUsers);
router.put('/users/:id', updateUserRules, validate, adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

router.post('/categories', createCategoryRules, validate, adminController.createCategory);
router.put('/categories/:id', updateCategoryRules, validate, adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

router.get('/logs', adminController.listLogs);
router.get('/analytics', adminController.analytics);
router.get('/reports', adminController.reportsOverview);

module.exports = router;
