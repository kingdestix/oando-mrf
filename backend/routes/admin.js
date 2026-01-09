// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getUsers, createUser, updateUser, updateUserStatus, resetUserPassword, getActivityLogs, getDashboardStats, deleteAllData } = require('../controllers/adminController');

// All admin routes require authentication and admin/POD planner role
router.use(authenticate);
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

// Delete all data (admin only)
router.delete('/delete-all-data', deleteAllData);

module.exports = router;