// DODM Routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const dodmController = require('../controllers/dodmController');

// Get DODM dashboard statistics
router.get('/stats', authenticate, dodmController.getDODMStats);

// Get DODM approved requests (for tracking)
router.get('/approved', authenticate, dodmController.getDODMApproved);

module.exports = router;

