// backend/routes/profile.js
// Profile management routes

const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');

router.post('/signature', authenticate, profileController.uploadSignature);
router.post('/signature/remove', authenticate, profileController.removeSignature);
router.post('/password', authenticate, profileController.changePassword);

module.exports = router;

