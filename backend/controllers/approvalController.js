// backend/controllers/approvalController.js
/**
 * APPROVAL WORKFLOW CONTROLLER
 * Handles MRF approval stages, rejections, rescheduling
 */

const { query, transaction } = require('../config/database');
const { sendEmail } = require('../utils/email');

// ===================================
// WORKFLOW STAGE DEFINITIONS
// ===================================
const WORKFLOW_STAGES = {
  MRF_CREATED: 'MRF Created',
  MRF_APPROVED: 'MRF Approved',
  BLANKET_CHECK: 'Checking Blanket Order',
  QUOTATION_REQUESTED: 'Quotation Requested',
  QUOTATION_SUBMITTED: 'Quotation Submitted',
  QUOTATION_APPROVED: 'Quotation Approved',
  QUOTATION_ACCEPTED: 'Quotation Accepted',
  PROFORMA_SUBMITTED: 'Pro Forma Invoice Submitted',
  PROFORMA_APPROVED: 'Pro Forma Approved',
  SHIPPED: 'Materials Shipped',
  COMPLIANCE_CHECK: 'Quality Compliance Check',
  RECEIVED: 'Materials Received',
  CLOSED: 'MRF Closed',
  REJECTED: 'Rejected',
  RESCHEDULED: 'Rescheduled'
};

const NEXT_STAGE = {
  MRF_CREATED: 'MRF_APPROVED',
  MRF_APPROVED: 'BLANKET_CHECK',
  BLANKET_CHECK: 'QUOTATION_REQUESTED', // Or skip to PROFORMA if blanket exists
  QUOTATION_REQUESTED: 'QUOTATION_SUBMITTED',
  QUOTATION_SUBMITTED: 'QUOTATION_APPROVED',
  QUOTATION_APPROVED: 'QUOTATION_ACCEPTED',
  QUOTATION_ACCEPTED: 'PROFORMA_SUBMITTED',
  PROFORMA_SUBMITTED: 'PROFORMA_APPROVED',
  PROFORMA_APPROVED: 'SHIPPED',
  SHIPPED: 'COMPLIANCE_CHECK',
  COMPLIANCE_CHECK: 'RECEIVED',
  RECEIVED: 'CLOSED'
};

// ===================================
// GET REQUESTS PENDING MY APPROVAL
// ===================================
async function getPendingApprovals(req, res) {
  try {
    const user = req.user;
    const { area, discipline, page = 1, limit = 25 } = req.query;
    
    let stageFilter = [];
    
    // Determine which stages this user can approve based on approval_level
    if (user.approval_level === 1) {
      // Supervisor - can approve MRF_CREATED
      stageFilter = ['MRF_CREATED'];
    } else if (user.approval_level === 2) {
      // Manager - can approve MRF_APPROVED
      stageFilter = ['MRF_APPROVED'];
    } else if (user.approval_level === 3 || user.approval_level === 4) {
      // Area Manager/Admin - can approve BLANKET_CHECK
      stageFilter = ['BLANKET_CHECK', 'QUOTATION_APPROVED', 'PROFORMA_SUBMITTED', 'COMPLIANCE_CHECK'];
    } else {
      return res.json({ success: true, data: [], pagination: { total: 0 } });
    }
    
    const conditions = [`r.workflow_stage = ANY($1)`];
    const params = [stageFilter];
    let paramIndex = 2;
    
    if (area && area !== 'all') {
      conditions.push(`r.mrf_number LIKE $${paramIndex}`);
      params.push(`${area}-%`);
      paramIndex++;
    }
    
    if (discipline) {
      conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    
    const countResult = await query(
      `SELECT COUNT(*) as total FROM material_requests r WHERE ${whereClause}`,
      params
    );
    
    params.push(limit, offset);
    const result = await query(
      `SELECT r.*, 
              u.first_name || ' ' || u.last_name as requester_name,
              COUNT(l.id) as line_items_count
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN material_request_lines l ON r.id = l.request_id
       WHERE ${whereClause}
       GROUP BY r.id, u.first_name, u.last_name
       ORDER BY r.request_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch pending approvals' });
  }
}

// ===================================
// APPROVE REQUEST (Move to next stage)
// ===================================
async function approveRequest(req, res) {
  try {
    const { id } = req.params;
    const { comments, has_blanket_order, blanket_order_ref } = req.body;
    const user = req.user;
    
    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    const currentStage = request.workflow_stage;
    
    // Determine next stage
    let nextStage = NEXT_STAGE[currentStage];
    
    // Special case: If blanket order exists, skip quotation stages
    if (currentStage === 'BLANKET_CHECK' && has_blanket_order) {
      nextStage = 'PROFORMA_SUBMITTED';
    }
    
    if (!nextStage) {
      return res.status(400).json({ error: true, message: 'Cannot approve from current stage' });
    }
    
    await transaction(async (client) => {
      // Update request
      const updates = ['workflow_stage = $1', 'updated_at = CURRENT_TIMESTAMP'];
      const updateParams = [nextStage];
      let paramIndex = 2;
      
      // Record approver based on stage
      if (currentStage === 'MRF_CREATED') {
        updates.push(`approved_by_supervisor = $${paramIndex}`);
        updateParams.push(`${user.first_name} ${user.last_name}`);
        paramIndex++;
        updates.push(`approved_date_supervisor = CURRENT_TIMESTAMP`);
        if (comments) {
          updates.push(`supervisor_comments = $${paramIndex}`);
          updateParams.push(comments);
          paramIndex++;
        }
      } else if (currentStage === 'MRF_APPROVED') {
        updates.push(`approved_by_manager = $${paramIndex}`);
        updateParams.push(`${user.first_name} ${user.last_name}`);
        paramIndex++;
        updates.push(`approved_date_manager = CURRENT_TIMESTAMP`);
        if (comments) {
          updates.push(`manager_comments = $${paramIndex}`);
          updateParams.push(comments);
          paramIndex++;
        }
      } else if (currentStage === 'BLANKET_CHECK') {
        updates.push(`approved_by_area_manager = $${paramIndex}`);
        updateParams.push(`${user.first_name} ${user.last_name}`);
        paramIndex++;
        updates.push(`approved_date_area_manager = CURRENT_TIMESTAMP`);
        if (comments) {
          updates.push(`area_manager_comments = $${paramIndex}`);
          updateParams.push(comments);
          paramIndex++;
        }
        if (has_blanket_order) {
          updates.push(`has_blanket_order = true`);
          updates.push(`blanket_order_ref = $${paramIndex}`);
          updateParams.push(blanket_order_ref);
          paramIndex++;
        }
      }
      
      updateParams.push(id);
      await client.query(
        `UPDATE material_requests SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        updateParams
      );
      
      // Record in approval history
      await client.query(
        `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          currentStage,
          nextStage,
          'APPROVED',
          user.id,
          `${user.first_name} ${user.last_name}`,
          user.role,
          comments || null
        ]
      );
    });
    
    res.json({
      success: true,
      message: `Request approved and moved to ${WORKFLOW_STAGES[nextStage]}`,
      nextStage
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ error: true, message: 'Failed to approve request' });
  }
}

// ===================================
// REJECT REQUEST
// ===================================
async function rejectRequest(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;
    
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: true, message: 'Rejection reason required (min 10 characters)' });
    }
    
    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = 'REJECTED', 
             rejection_reason = $1,
             rejection_stage = $2,
             status = 'Rejected',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [reason, request.workflow_stage, id]
      );
      
      await client.query(
        `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
         VALUES ($1, $2, 'REJECTED', 'REJECTED', $3, $4, $5, $6)`,
        [
          id,
          request.workflow_stage,
          user.id,
          `${user.first_name} ${user.last_name}`,
          user.role,
          reason
        ]
      );
    });
    
    res.json({
      success: true,
      message: 'Request rejected successfully'
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: true, message: 'Failed to reject request' });
  }
}

// ===================================
// RESCHEDULE REQUEST
// ===================================
async function rescheduleRequest(req, res) {
  try {
    const { id } = req.params;
    const { reason, new_date } = req.body;
    const user = req.user;
    
    if (!reason || !new_date) {
      return res.status(400).json({ error: true, message: 'Reschedule reason and new date required' });
    }
    
    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET rescheduled_date = $1,
             reschedule_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [new_date, reason, id]
      );
      
      await client.query(
        `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
         VALUES ($1, $2, $3, 'RESCHEDULED', $4, $5, $6, $7)`,
        [
          id,
          request.workflow_stage,
          request.workflow_stage,
          user.id,
          `${user.first_name} ${user.last_name}`,
          user.role,
          `Rescheduled to ${new_date}: ${reason}`
        ]
      );
    });
    
    res.json({
      success: true,
      message: 'Request rescheduled successfully'
    });
  } catch (error) {
    console.error('Reschedule request error:', error);
    res.status(500).json({ error: true, message: 'Failed to reschedule request' });
  }
}

// ===================================
// GET APPROVAL HISTORY
// ===================================
async function getApprovalHistory(req, res) {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT ah.*, u.email as approver_email
       FROM approval_history ah
       LEFT JOIN users u ON ah.approved_by = u.id
       WHERE ah.request_id = $1
       ORDER BY ah.created_at ASC`,
      [id]
    );
    
    res.json({
      success: true,
      history: result.rows
    });
  } catch (error) {
    console.error('Get approval history error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch approval history' });
  }
}

// ===================================
// MARK BLANKET ORDER EXISTS
// ===================================
async function markBlanketOrder(req, res) {
  try {
    const { id } = req.params;
    const { blanket_order_ref } = req.body;
    const user = req.user;
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET has_blanket_order = true,
             blanket_order_ref = $1,
             workflow_stage = 'PROFORMA_SUBMITTED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [blanket_order_ref, id]
      );
      
      await client.query(
        `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
         VALUES ($1, 'BLANKET_CHECK', 'PROFORMA_SUBMITTED', 'APPROVED', $2, $3, $4, $5)`,
        [
          id,
          user.id,
          `${user.first_name} ${user.last_name}`,
          user.role,
          `Blanket Order Ref: ${blanket_order_ref} - Skipped quotation stage`
        ]
      );
    });
    
    res.json({
      success: true,
      message: 'Blanket order marked. Skipped to Pro Forma stage.'
    });
  } catch (error) {
    console.error('Mark blanket order error:', error);
    res.status(500).json({ error: true, message: 'Failed to mark blanket order' });
  }
}

// ===================================
// SUBMIT PRO FORMA INVOICE
// ===================================
async function submitProforma(req, res) {
  try {
    const { id } = req.params;
    const { proforma_ref, amount_usd, amount_ngn, submitted_date } = req.body;
    const user = req.user;
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET proforma_invoice_ref = $1,
             proforma_amount_usd = $2,
             proforma_amount_ngn = $3,
             proforma_submitted_date = $4,
             workflow_stage = 'PROFORMA_APPROVED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [proforma_ref, amount_usd, amount_ngn, submitted_date || new Date(), id]
      );
      
      await client.query(
        `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
         VALUES ($1, 'PROFORMA_SUBMITTED', 'PROFORMA_APPROVED', 'APPROVED', $2, $3, $4, $5)`,
        [
          id,
          user.id,
          `${user.first_name} ${user.last_name}`,
          user.role,
          `Pro Forma Invoice: ${proforma_ref} | USD: ${amount_usd} | NGN: ${amount_ngn}`
        ]
      );
    });
    
    res.json({
      success: true,
      message: 'Pro Forma invoice submitted and approved'
    });
  } catch (error) {
    console.error('Submit proforma error:', error);
    res.status(500).json({ error: true, message: 'Failed to submit pro forma invoice' });
  }
}

// ===================================
// COMPLIANCE CHECK (Pass/Fail)
// ===================================
async function performComplianceCheck(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // status: PASS | FAIL
    const user = req.user;
    
    if (!['PASS', 'FAIL'].includes(status)) {
      return res.status(400).json({ error: true, message: 'Status must be PASS or FAIL' });
    }
    
    const nextStage = status === 'PASS' ? 'RECEIVED' : 'REJECTED';
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET compliance_status = $1,
             compliance_notes = $2,
             workflow_stage = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, notes, nextStage, id]
      );
      
      await client.query(
        `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
         VALUES ($1, 'COMPLIANCE_CHECK', $2, $3, $4, $5, $6, $7)`,
        [
          id,
          nextStage,
          status === 'PASS' ? 'APPROVED' : 'REJECTED',
          user.id,
          `${user.first_name} ${user.last_name}`,
          user.role,
          `Compliance Check ${status}: ${notes || 'No notes'}`
        ]
      );
    });
    
    res.json({
      success: true,
      message: `Compliance check ${status}. ${status === 'PASS' ? 'Materials received.' : 'Materials rejected.'}`
    });
  } catch (error) {
    console.error('Compliance check error:', error);
    res.status(500).json({ error: true, message: 'Failed to perform compliance check' });
  }
}

module.exports = {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  rescheduleRequest,
  getApprovalHistory,
  markBlanketOrder,
  submitProforma,
  performComplianceCheck
};