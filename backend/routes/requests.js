// backend/routes/requests.js
const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { authenticate } = require('../middleware/auth');  // ⭐ CHANGED FROM authMiddleware
const { attachmentUpload } = require('../middleware/upload');  // ⭐ CHANGED FROM upload

// Get lookups (must be first - no params)
router.get('/lookups', authenticate, requestController.getLookups);

// CRUD operations
router.post('/', authenticate, requestController.createRequest);
router.get('/', authenticate, requestController.getRequests);

// PDF Download - specific route before dynamic :id
router.get('/:id/pdf', authenticate, requestController.downloadRequestPDF);

// Attachments - specific route before dynamic :id
router.post('/:id/attachments', authenticate, attachmentUpload.single('file'), requestController.uploadAttachment);

// Dynamic :id routes (LAST)
router.get('/:id', authenticate, requestController.getRequestById);
router.put('/:id', authenticate, requestController.updateRequest);
router.delete('/:id', authenticate, requestController.deleteRequest);

module.exports = router;