// backend/routes/exports.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { exportRequests, downloadTemplate } = require('../controllers/exportController');

router.use(authenticate);
router.use(requireAdmin);

router.get('/', exportRequests);
router.get('/template', downloadTemplate);

module.exports = router;
