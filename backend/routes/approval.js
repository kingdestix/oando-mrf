// backend/routes/approval.js
/**
 * APPROVAL WORKFLOW ROUTES
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const approvalController = require('../controllers/approvalController');

// Get requests pending my approval
router.get('/pending', authenticate, approvalController.getPendingApprovals);

// Approve request (move to next stage)
router.post('/:id/approve', authenticate, approvalController.approveRequest);

// Reject request
router.post('/:id/reject', authenticate, approvalController.rejectRequest);

// Reschedule request
router.post('/:id/reschedule', authenticate, approvalController.rescheduleRequest);

// Get approval history for a request
router.get('/:id/history', authenticate, approvalController.getApprovalHistory);

// Mark blanket order exists
router.post('/:id/blanket-order', authenticate, approvalController.markBlanketOrder);

// Submit pro forma invoice
router.post('/:id/proforma', authenticate, approvalController.submitProforma);

// Compliance check (pass/fail)
router.post('/:id/compliance', authenticate, approvalController.performComplianceCheck);

module.exports = router;