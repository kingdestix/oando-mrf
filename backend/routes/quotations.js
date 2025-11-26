const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listQuotations, updateQuotationStatus } = require('../controllers/quotationController');

router.get('/', authenticate, requireAdmin, listQuotations);
router.put('/:id', authenticate, requireAdmin, updateQuotationStatus);

module.exports = router;

