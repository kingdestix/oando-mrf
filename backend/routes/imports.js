// backend/routes/imports.js
// FIXED: Direct import without preview/mapping step

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { importUpload, handleMulterError } = require('../middleware/upload');
const { processImport, getImportStatus, getImportHistory } = require('../controllers/importController');

// All import routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

// Direct import - no preview step
router.post('/process', importUpload.single('file'), handleMulterError, processImport);

// Import status and history
router.get('/status/:jobId', getImportStatus);
router.get('/history', getImportHistory);

module.exports = router;