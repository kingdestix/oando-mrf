// backend/routes/approval.js
/**
 * APPROVAL WORKFLOW ROUTES
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { attachmentUpload, handleMulterError } = require('../middleware/upload');
const approvalController = require('../controllers/approvalController');

// Get requests pending my approval
router.get('/pending', authenticate, approvalController.getPendingApprovals);

// Upload signature
router.post('/upload-signature', authenticate, attachmentUpload.single('signature'), handleMulterError, approvalController.uploadSignature);

// Approve request (move to next stage)
router.post('/:id/approve', authenticate, approvalController.approveRequest);

// Reject request
router.post('/:id/reject', authenticate, approvalController.rejectRequest);

// Get approval history for a request
router.get('/:id/history', authenticate, approvalController.getApprovalHistory);

// Get approved requests by approver
router.get('/approved', authenticate, approvalController.getApprovedRequests);

// Get area requests (for area managers)
router.get('/area-requests', authenticate, approvalController.getAreaRequests);

// POD Planner: Route to discipline unit
router.post('/:id/route', authenticate, approvalController.routeToDiscipline);

// Discipline Unit: Submit contract details
router.post('/:id/contract', authenticate, approvalController.submitContractDetails);

// Discipline Manager: Approve with quantity adjustments
router.post('/:id/approve-quantities', authenticate, approvalController.approveWithQuantityAdjustments);

// Discipline Manager: Reject request (allows requisitor to edit)
router.post('/:id/reject-with-edit', authenticate, approvalController.rejectRequestWithEdit);

// Commercial Workflow Routes
// DU: Mark MRF as sent to contractor
router.post('/:id/mark-sent-to-contractor', authenticate, approvalController.markMRFSentToContractor);

// DU: Submit contractor quotation details
router.post('/:id/submit-contractor-quotation', authenticate, approvalController.submitContractorQuotation);

// DU: Mark quotation as received
router.post('/:id/mark-quotation-received', authenticate, approvalController.markQuotationReceived);

// DODM: Approve commercial
router.post('/:id/approve-commercial', authenticate, approvalController.approveCommercial);

// DODM: Reject commercial
router.post('/:id/reject-commercial', authenticate, approvalController.rejectCommercial);

// DU: Mark material as delivered by contractor
router.post('/:id/mark-material-delivered', authenticate, approvalController.markMaterialDelivered);

// DU: Mark material as sent to requestor
router.post('/:id/mark-material-sent-to-requestor', authenticate, approvalController.markMaterialSentToRequestor);

// Requisitor: Approve/reject material delivery
router.post('/:id/approve-material-delivery', authenticate, approvalController.approveMaterialDelivery);

// DU: Close request after requisitor confirms
router.post('/:id/close', authenticate, approvalController.closeRequest);

module.exports = router;