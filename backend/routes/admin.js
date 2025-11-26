// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { getUsers, createUser, updateUser, updateUserStatus, resetUserPassword, getActivityLogs, getDashboardStats } = require('../controllers/adminController');

// All admin routes require admin role
router.use(requireAdmin);

// User management
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.put('/users/:id/status', updateUserStatus);
router.put('/users/:id/password', resetUserPassword);

// Activity logs
router.get('/activity-logs', getActivityLogs);

// Dashboard statistics
router.get('/dashboard-stats', getDashboardStats);

router.delete('/delete-all-data', adminController.deleteAllData);

module.exports = router;