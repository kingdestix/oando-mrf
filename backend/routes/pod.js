// POD Routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const podReportController = require('../controllers/podReportController');

// Generate POD report (Word document)
router.get('/report', authenticate, podReportController.generatePODReport);

module.exports = router;

