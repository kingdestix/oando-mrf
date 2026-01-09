// backend/controllers/approvalController.js
/**
 * COMPREHENSIVE APPROVAL WORKFLOW CONTROLLER
 * Handles MRF approval stages with location-specific workflows
 */

const { query, transaction } = require('../config/database');
const { sendEmail } = require('../utils/email');

// ===================================
// WORKFLOW STAGE MAPPING
// ===================================
const WORKFLOW_STAGES = {
  REQUESTOR_SUBMITTED: 'Request Submitted',
  TECHNICAL_COORDINATOR_REVIEW: 'Technical Coordinator Review',
  ASSISTANT_MANAGER_REVIEW: 'Assistant Manager Review',
  AREA_MANAGER_REVIEW: 'Area Manager Review',
  POD_PLANNER_REVIEW: 'POD Planner Review',
  DISCIPLINE_UNIT_REVIEW: 'Discipline Unit Review',
  DISCIPLINE_MANAGER_APPROVAL: 'Discipline Manager Approval',
  COMMERCIAL_REVIEW: 'Commercial Review',
  COMMERCIAL_APPROVED: 'Commercial Approved',
  MATERIAL_DELIVERY: 'Material Delivery',
  MATERIAL_RECEIVED: 'Material Received',
  CLOSED: 'Closed',
  REJECTED: 'Rejected'
};

// Role to stage mapping
const ROLE_STAGE_MAP = {
  'technical_coordinator': 'TECHNICAL_COORDINATOR_REVIEW',
  'assistant_manager': 'ASSISTANT_MANAGER_REVIEW',
  'area_manager_land': 'AREA_MANAGER_REVIEW',
  'area_manager_swamp': 'AREA_MANAGER_REVIEW',
  'area_manager_phc': 'AREA_MANAGER_REVIEW',
  'pod_planner': 'POD_PLANNER_REVIEW',
  'discipline_unit': 'DISCIPLINE_UNIT_REVIEW',
  'discipline_manager': 'DISCIPLINE_MANAGER_APPROVAL',
  'dodm': 'COMMERCIAL_REVIEW', // Divisional Operations & Development Manager
  'maintenance_manager': 'COMMERCIAL_REVIEW', // View-only
  'assistant_discipline_manager': 'COMMERCIAL_REVIEW' // View-only
};

// ===================================
// GET WORKFLOW SEQUENCE FOR LOCATION
// ===================================
async function getWorkflowSequence(location) {
  try {
    // Get location-specific workflow or default
    const result = await query(
      `SELECT workflow_sequence 
       FROM location_workflow_rules 
       WHERE location = $1 AND is_active = true
       UNION ALL
       SELECT workflow_sequence 
       FROM location_workflow_rules 
       WHERE location = 'DEFAULT' AND is_active = true
       LIMIT 1`,
      [location]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].workflow_sequence;
    }
    
    // Default workflow if no rules found
    return [
      'REQUESTOR_SUBMITTED',
      'TECHNICAL_COORDINATOR_REVIEW',
      'ASSISTANT_MANAGER_REVIEW',
      'AREA_MANAGER_REVIEW',
      'POD_PLANNER_REVIEW',
      'DISCIPLINE_UNIT_REVIEW',
      'DISCIPLINE_MANAGER_APPROVAL',
      'COMMERCIAL_REVIEW',
      'COMMERCIAL_APPROVED',
      'MATERIAL_DELIVERY',
      'MATERIAL_RECEIVED',
      'CLOSED'
    ];
  } catch (error) {
    console.error('Get workflow sequence error:', error);
    // Return default workflow on error
    return [
      'REQUESTOR_SUBMITTED',
      'TECHNICAL_COORDINATOR_REVIEW',
      'ASSISTANT_MANAGER_REVIEW',
      'AREA_MANAGER_REVIEW',
      'POD_PLANNER_REVIEW',
      'DISCIPLINE_UNIT_REVIEW',
      'DISCIPLINE_MANAGER_APPROVAL',
      'COMMERCIAL_REVIEW',
      'COMMERCIAL_APPROVED',
      'MATERIAL_DELIVERY',
      'MATERIAL_RECEIVED',
      'CLOSED'
    ];
  }
}

// ===================================
// GET NEXT STAGE IN WORKFLOW
// ===================================
async function getNextStage(currentStage, location) {
  const sequence = await getWorkflowSequence(location);
  const currentIndex = sequence.indexOf(currentStage);
  
  if (currentIndex === -1 || currentIndex === sequence.length - 1) {
    return null; // Already at last stage or invalid stage
  }
  
  return sequence[currentIndex + 1];
}

// ===================================
// GET REQUESTS PENDING MY APPROVAL
// ===================================
async function getPendingApprovals(req, res) {
  try {
    const user = req.user;
    const { area, discipline, page = 1, limit = 25, month, showAll = false, workflow_stage } = req.query;
    
    // If workflow_stage is provided (for POD Planner status views), use it directly
    if (workflow_stage) {
      const offset = (page - 1) * limit;
      const conditions = [`r.workflow_stage = $1`];
      const params = [workflow_stage];
      let paramIndex = 2;
      
      // Add discipline filter if user has discipline_assignment
      if (user.discipline_assignment && (user.role === 'discipline_unit' || user.role === 'discipline_manager')) {
        conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
        params.push(user.discipline_assignment);
        paramIndex++;
      }

      // POD status tabs should only show requests that have passed through POD routing
      // (approved_by_pod_planner will be set when POD routes to a discipline unit).
      if (user.role === 'pod_planner') {
        conditions.push(`r.approved_by_pod_planner IS NOT NULL`);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      const countResult = await query(
        `SELECT COUNT(*) as total FROM material_requests r ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);
      
      params.push(limit, offset);
      const result = await query(
        `SELECT r.*, 
                u.first_name || ' ' || u.last_name as requester_name,
                u.email as requester_email
         FROM material_requests r
         LEFT JOIN users u ON r.user_id = u.id
         ${whereClause}
         ORDER BY r.request_date DESC, r.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );
      
      return res.json({
        success: true,
        requests: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          totalPages: Math.ceil(total / limit)
        }
      });
    }
    
    // Determine which stage this user can approve
    const userStage = ROLE_STAGE_MAP[user.role];
    
    if (!userStage) {
      return res.json({ success: true, data: [], pagination: { total: 0 } });
    }
    
    // Allow all approvers to see both pending AND approved requests when showAll=true
    // For others, show only pending
    let conditions, params, paramIndex;
    
    // Build conditions based on role and showAll flag
    if (showAll === 'true' || showAll === true) {
      // Show all requests (pending + approved) for this approver
      if (user.role === 'technical_coordinator') {
        conditions = [`(r.workflow_stage = $1 OR r.approved_by_technical_coordinator = $2)`];
        params = [userStage, user.id];
        paramIndex = 3;
      } else if (user.role === 'assistant_manager') {
        conditions = [`(r.workflow_stage = $1 OR r.approved_by_assistant_manager = $2)`];
        params = [userStage, user.id];
        paramIndex = 3;
      } else if (user.role.startsWith('area_manager_')) {
        const areaType = user.role.replace('area_manager_', '').toUpperCase();
        let mrfPattern = '';
        if (areaType === 'LAND') mrfPattern = 'LAR-%';
        else if (areaType === 'SWAMP') mrfPattern = 'SAR-%';
        else if (areaType === 'PHC') mrfPattern = 'PHC-%';
        conditions = [`((r.workflow_stage = $1 OR r.approved_by_area_manager = $2) AND r.mrf_number LIKE '${mrfPattern}')`];
        params = [userStage, user.id];
        paramIndex = 3;
      } else if (user.role === 'pod_planner') {
        conditions = [`(r.workflow_stage = $1 OR r.approved_by_pod_planner = $2)`];
        params = [userStage, user.id];
        paramIndex = 3;
      } else {
        // Default: show pending + approved for this role
        conditions = [`(r.workflow_stage = $1 OR r.approved_by_${user.role} = $2)`];
        params = [userStage, user.id];
        paramIndex = 3;
      }
    } else {
      // Default: show only pending requests at user's stage
      conditions = [`r.workflow_stage = $1`];
      params = [userStage];
      paramIndex = 2;
      
      // For tech coordinator, add location filter if assigned
      if (user.role === 'technical_coordinator' && user.location_assignment) {
        conditions.push(`(UPPER(r.workflow_location) = UPPER($${paramIndex}) OR UPPER(r.asset) = UPPER($${paramIndex}))`);
        params.push(user.location_assignment);
        paramIndex++;
      }
    }
    
    // Area-based filtering for area managers - use MRF number pattern only
    if (user.role.startsWith('area_manager_')) {
      const areaType = user.role.replace('area_manager_', '').toUpperCase();
      if (areaType === 'LAND') {
        conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      } else if (areaType === 'SWAMP') {
        conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      } else if (areaType === 'PHC') {
        conditions.push(`r.mrf_number LIKE 'PHC-%'`);
      }
    }
    
    // Discipline filtering for discipline units
    // Discipline units should see ALL requests in their discipline across ALL stages
    if (user.role === 'discipline_unit') {
      console.log('🔍 DU Query Debug:');
      console.log('  - User ID:', user.id);
      console.log('  - Discipline Assignment:', user.discipline_assignment);
      
      // Reset conditions and params for discipline unit
      // Show ALL requests in their discipline regardless of stage
      conditions = [];
      params = [];
      paramIndex = 1;
      
      // IMPORTANT: Filter by discipline assignment FIRST
      if (user.discipline_assignment) {
        // Prefer POD routing target if present; fallback to request discipline for legacy data
        conditions.push(`UPPER(COALESCE(r.pod_routed_to_discipline, r.discipline)) = UPPER($${paramIndex})`);
        params.push(user.discipline_assignment);
        paramIndex++;
        console.log('  - Filtering by discipline:', user.discipline_assignment);
      } else {
        console.log('  - WARNING: No discipline_assignment found!');
      }
      
      // Exclude only REJECTED status
      // Show ALL stages including COMPLETED (which might need to be moved to COMMERCIAL_REVIEW)
      conditions.push(`r.status != 'Rejected'`);
      
      // Also show COMPLETED requests that were approved by DM but haven't gone through commercial
      // These should be visible so DU can process them
      console.log('  - DU Query: Showing all non-rejected requests in discipline');
      console.log('  - Conditions:', conditions);
      console.log('  - Params:', params);
    }
    
    // DODM: Show ONLY requests at COMMERCIAL_REVIEW with quotation details filled
    if (user.role === 'dodm') {
      // Reset conditions for DODM - only show COMMERCIAL_REVIEW with quotation_reference
      conditions = [`r.workflow_stage = $1`];
      params = [userStage]; // userStage is 'COMMERCIAL_REVIEW' for DODM
      paramIndex = 2;
      
      // CRITICAL: Only show requests that have quotation details submitted by DU
      // Must have quotation_reference (filled by DU when submitting commercial details)
      conditions.push(`r.quotation_reference IS NOT NULL`);
      conditions.push(`TRIM(r.quotation_reference) != ''`);
      
      // Must have quotation amount (USD) - indicates commercial details were filled
      conditions.push(`r.quotation_amount_usd IS NOT NULL`);
      
      // Must have contractor/vendor name - indicates DU has engaged contractor
      conditions.push(`(r.contractor_name IS NOT NULL OR r.vendor_name IS NOT NULL)`);
      conditions.push(`(TRIM(COALESCE(r.contractor_name, '')) != '' OR TRIM(COALESCE(r.vendor_name, '')) != '')`);
      
      // DODM sees all disciplines (no discipline filter)
      console.log('🔍 DODM Query: Only showing COMMERCIAL_REVIEW requests with complete quotation details');
      console.log('  - Conditions:', conditions);
      console.log('  - Params:', params);
    }
    
    // Discipline filtering for discipline managers
    // Show ALL requests by default (both pending and approved)
    if (user.role === 'discipline_manager') {
      // IMPORTANT: Don't modify conditions[0] if it doesn't exist yet (when showAll is false)
      // Instead, build the condition properly
      if (showAll === 'true' || showAll === true) {
        // Already handled in showAll block above, just add discipline filter
        if (user.discipline_assignment) {
          conditions.push(`UPPER(COALESCE(r.pod_routed_to_discipline, r.discipline)) = UPPER($${paramIndex})`);
          params.push(user.discipline_assignment);
          paramIndex++;
        }
      } else {
        // For non-showAll: modify conditions[0] to include approved requests
        conditions[0] = `(r.workflow_stage = $1 OR r.approved_by_discipline_manager = $${paramIndex})`;
        params.push(user.id);
        paramIndex++;
        
        // Add discipline filter if discipline_assignment is set
        if (user.discipline_assignment) {
          conditions.push(`UPPER(COALESCE(r.pod_routed_to_discipline, r.discipline)) = UPPER($${paramIndex})`);
          params.push(user.discipline_assignment);
          paramIndex++;
        }
      }
    }
    
    // Location filtering (skip for tech coordinators as we handle it above)
    if (user.location_assignment && user.role !== 'technical_coordinator') {
      conditions.push(`(UPPER(r.workflow_location) = UPPER($${paramIndex}) OR UPPER(r.asset) = UPPER($${paramIndex}))`);
      params.push(user.location_assignment);
      paramIndex++;
    }
    
    // Month filtering (for POD planners)
    if (month && user.role === 'pod_planner') {
      const [year, monthNum] = month.split('-');
      conditions.push(`EXTRACT(YEAR FROM r.request_date) = $${paramIndex}`);
      params.push(year);
      paramIndex++;
      conditions.push(`EXTRACT(MONTH FROM r.request_date) = $${paramIndex}`);
      params.push(monthNum);
      paramIndex++;
    }
    
    // Additional filters
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
    
    // Debug logging for discipline managers and discipline units
    if (user.role === 'discipline_manager') {
      console.log('🔍 Discipline Manager Query Debug:');
      console.log('  - User ID:', user.id);
      console.log('  - Discipline Assignment:', user.discipline_assignment || 'NOT SET');
      console.log('  - User Stage:', userStage);
      console.log('  - Show All:', showAll);
      console.log('  - Where Clause:', whereClause);
      console.log('  - Params:', params);
    }
    
    // Debug: Log what stages are being queried for DU
    if (user.role === 'discipline_unit') {
      console.log('🔍 DU Query - Final WHERE clause:', whereClause);
      console.log('🔍 DU Query - Final params:', params);
      console.log('🔍 DU Query - Conditions count:', conditions.length);
    }
    
    // Debug logging for DODM
    if (user.role === 'dodm') {
      console.log('🔍 DODM Query - Final WHERE clause:', whereClause);
      console.log('🔍 DODM Query - Final params:', params);
      console.log('🔍 DODM Query - Conditions count:', conditions.length);
    }
    
    const countResult = await query(
      `SELECT COUNT(*) as total FROM material_requests r WHERE ${whereClause}`,
      params
    );
    
    if (user.role === 'discipline_manager') {
      console.log('  - Total Count:', countResult.rows[0].total);
    }
    
    params.push(limit, offset);
    const result = await query(
      `SELECT r.*, 
              u.first_name,
              u.last_name,
              u.email,
              u.first_name || ' ' || u.last_name as requester_name,
              COUNT(l.id) as line_items_count,
              SUM(l.quantity) as total_quantity
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN material_request_lines l ON r.id = l.request_id
       WHERE ${whereClause}
       GROUP BY r.id, u.first_name, u.last_name, u.email
       ORDER BY ${user.role === 'discipline_unit' ? `CASE 
         WHEN r.workflow_stage = 'COMMERCIAL_REVIEW' THEN 1
         WHEN r.workflow_stage = 'DISCIPLINE_UNIT_REVIEW' THEN 2
         WHEN r.workflow_stage = 'COMPLETED' AND r.approved_by_discipline_manager IS NOT NULL THEN 3
         WHEN r.workflow_stage = 'COMMERCIAL_APPROVED' THEN 4
         WHEN r.workflow_stage = 'MATERIAL_DELIVERY' THEN 5
         ELSE 6
       END, ` : ''}r.request_date DESC, r.created_at DESC
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
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: true, message: 'Failed to fetch pending approvals: ' + error.message });
  }
}

// ===================================
// APPROVE REQUEST (Move to next stage)
// ===================================
async function approveRequest(req, res) {
  try {
    const { id } = req.params;
    const { comments, signature_path, contract_details } = req.body;
    const user = req.user;
    
    // If no signature_path provided, try to use user's profile signature
    let finalSignaturePath = signature_path;
    if (!finalSignaturePath) {
      const userResult = await query(
        'SELECT signature_path FROM users WHERE id = $1',
        [user.id]
      );
      if (userResult.rows[0] && userResult.rows[0].signature_path) {
        finalSignaturePath = userResult.rows[0].signature_path;
      }
    }
    
    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    const currentStage = request.workflow_stage;
    const userStage = ROLE_STAGE_MAP[user.role];
    
    // Check if already approved by this user
    if (user.role === 'discipline_manager' && request.approved_by_discipline_manager) {
      // Check if already approved and moved to next stage
      if (currentStage !== 'DISCIPLINE_MANAGER_APPROVAL' && currentStage !== 'COMPLETED' && currentStage !== 'CLOSED') {
        return res.status(400).json({ 
          error: true, 
          message: `This request has already been approved by you and moved to ${WORKFLOW_STAGES[currentStage] || currentStage} stage. Current stage: ${currentStage}`,
          alreadyApproved: true,
          currentStage: currentStage
        });
      }
    }
    
    // Verify user can approve this stage
    // Allow approval if at the correct stage, or if it's incorrectly at COMPLETED/CLOSED and should be at user's stage
    if (currentStage !== userStage) {
      // Special case: If request is at COMPLETED/CLOSED but should be at user's stage, allow correction
      if ((currentStage === 'COMPLETED' || currentStage === 'CLOSED') && userStage) {
        // Allow discipline manager to correct requests that were incorrectly marked as completed
        if (user.role === 'discipline_manager' && userStage === 'DISCIPLINE_MANAGER_APPROVAL') {
          // Continue with approval - will move to COMMERCIAL_REVIEW
        } else {
          return res.status(403).json({ 
            error: true, 
            message: `You cannot approve requests at ${WORKFLOW_STAGES[currentStage] || currentStage} stage. Expected stage: ${WORKFLOW_STAGES[userStage] || userStage}. Current stage: ${currentStage}`,
            currentStage: currentStage,
            expectedStage: userStage
          });
        }
      } else {
        return res.status(403).json({ 
          error: true, 
          message: `You cannot approve requests at ${WORKFLOW_STAGES[currentStage] || currentStage} stage. Expected stage: ${WORKFLOW_STAGES[userStage] || userStage}. Current stage: ${currentStage}`,
          currentStage: currentStage,
          expectedStage: userStage
        });
      }
    }
    
    // Get next stage based on location-specific workflow
    const nextStage = await getNextStage(currentStage, request.workflow_location || request.asset);
    
    if (!nextStage) {
      // Provide more detailed error message
      const sequence = await getWorkflowSequence(request.workflow_location || request.asset);
      const currentIndex = sequence.indexOf(currentStage);
      
      if (currentIndex === -1) {
        return res.status(400).json({ 
          error: true, 
          message: `Invalid workflow stage: ${currentStage}. This request may be in an invalid state.`,
          currentStage: currentStage,
          validStages: sequence
        });
      } else if (currentIndex === sequence.length - 1) {
        return res.status(400).json({ 
          error: true, 
          message: `Request is already at the final stage (${WORKFLOW_STAGES[currentStage] || currentStage}). No further approval is needed.`,
          currentStage: currentStage,
          isFinalStage: true
        });
      } else {
        return res.status(400).json({ 
          error: true, 
          message: `Cannot determine next stage for ${WORKFLOW_STAGES[currentStage] || currentStage}. Please contact system administrator.`,
          currentStage: currentStage
        });
      }
    }
    
    // Special handling for Ogboinbiri - ends at Area Manager (skip POD and Discipline stages)
    if (request.workflow_location === 'OGBOINBIRI' && nextStage === 'POD_PLANNER_REVIEW') {
      // For Ogboinbiri, after Area Manager approval, go directly to CLOSED (not COMPLETED)
      const finalStage = 'CLOSED';
      
      await transaction(async (client) => {
        await updateApprovalFields(client, request, user, currentStage, finalStage, comments, null, null);
        await recordApprovalHistory(client, id, currentStage, finalStage, 'APPROVED', user, comments);
      });
      
      return res.json({
        success: true,
        message: 'Request approved and closed (Ogboinbiri workflow)',
        nextStage: finalStage
      });
    }
    
    // Special handling for POD Planner: Route to Discipline Unit (not directly to Manager)
    // POD approves → Discipline Unit → Discipline Manager
    // This is handled by the normal workflow, no special routing needed
    
    await transaction(async (client) => {
      await updateApprovalFields(client, request, user, currentStage, nextStage, comments, finalSignaturePath, contract_details);
      await recordApprovalHistory(client, id, currentStage, nextStage, 'APPROVED', user, comments);
    });
    
    res.json({
      success: true,
      message: `Request approved and moved to ${WORKFLOW_STAGES[nextStage]}`,
      nextStage
    });
  } catch (error) {
    console.error('Approve request error:', error);
    console.error('Error details:', error.stack);
    res.status(500).json({ error: true, message: 'Failed to approve request: ' + error.message });
  }
}

// ===================================
// UPDATE APPROVAL FIELDS
// ===================================
async function updateApprovalFields(client, request, user, currentStage, nextStage, comments, signaturePath, contractDetails) {
  const updates = ['workflow_stage = $1', 'updated_at = CURRENT_TIMESTAMP'];
  const updateParams = [nextStage];
  let paramIndex = 2;
  
  // Record approver based on role
  if (user.role === 'technical_coordinator') {
    updates.push(`approved_by_technical_coordinator = $${paramIndex}`);
    updateParams.push(user.id);
    paramIndex++;
    updates.push(`approved_date_technical_coordinator = CURRENT_TIMESTAMP`);
    if (comments) {
      updates.push(`technical_coordinator_comments = $${paramIndex}`);
      updateParams.push(comments);
      paramIndex++;
    }
    if (signaturePath) {
      updates.push(`technical_coordinator_signature = $${paramIndex}`);
      updateParams.push(signaturePath);
      paramIndex++;
    }
  } else if (user.role === 'assistant_manager') {
    updates.push(`approved_by_assistant_manager = $${paramIndex}`);
    updateParams.push(user.id);
    paramIndex++;
    updates.push(`approved_date_assistant_manager = CURRENT_TIMESTAMP`);
    if (comments) {
      updates.push(`assistant_manager_comments = $${paramIndex}`);
      updateParams.push(comments);
      paramIndex++;
    }
    if (signaturePath) {
      updates.push(`assistant_manager_signature = $${paramIndex}`);
      updateParams.push(signaturePath);
      paramIndex++;
    }
  } else if (user.role.startsWith('area_manager_')) {
    updates.push(`approved_by_area_manager = $${paramIndex}`);
    updateParams.push(user.id);
    paramIndex++;
    updates.push(`approved_date_area_manager = CURRENT_TIMESTAMP`);
    if (comments) {
      updates.push(`area_manager_comments = $${paramIndex}`);
      updateParams.push(comments);
      paramIndex++;
    }
    if (signaturePath) {
      updates.push(`area_manager_signature = $${paramIndex}`);
      updateParams.push(signaturePath);
      paramIndex++;
    }
  } else if (user.role === 'pod_planner') {
    updates.push(`approved_by_pod_planner = $${paramIndex}`);
    updateParams.push(user.id);
    paramIndex++;
    updates.push(`approved_date_pod_planner = CURRENT_TIMESTAMP`);
    if (comments) {
      updates.push(`pod_planner_comments = $${paramIndex}`);
      updateParams.push(comments);
      paramIndex++;
    }
    if (signaturePath) {
      updates.push(`pod_planner_signature = $${paramIndex}`);
      updateParams.push(signaturePath);
      paramIndex++;
    }
  } else if (user.role === 'discipline_unit') {
    updates.push(`approved_by_discipline_unit = $${paramIndex}`);
    updateParams.push(user.id);
    paramIndex++;
    updates.push(`approved_date_discipline_unit = CURRENT_TIMESTAMP`);
    if (comments) {
      updates.push(`discipline_unit_comments = $${paramIndex}`);
      updateParams.push(comments);
      paramIndex++;
    }
    if (signaturePath) {
      updates.push(`discipline_unit_signature = $${paramIndex}`);
      updateParams.push(signaturePath);
      paramIndex++;
    }
    // Add contract details
    if (contractDetails) {
      if (contractDetails.contract_number) {
        updates.push(`contract_number = $${paramIndex}`);
        updateParams.push(contractDetails.contract_number);
        paramIndex++;
      }
      if (contractDetails.contract_validity) {
        updates.push(`contract_validity = $${paramIndex}`);
        updateParams.push(contractDetails.contract_validity);
        paramIndex++;
      }
      if (contractDetails.vendor_name) {
        updates.push(`vendor_name_discipline = $${paramIndex}`);
        updateParams.push(contractDetails.vendor_name);
        paramIndex++;
      }
      if (contractDetails.quotation_reference) {
        updates.push(`quotation_reference = $${paramIndex}`);
        updateParams.push(contractDetails.quotation_reference);
        paramIndex++;
      }
      if (contractDetails.contract_amount_usd !== null && contractDetails.contract_amount_usd !== undefined) {
        updates.push(`contract_amount_usd = $${paramIndex}`);
        updateParams.push(contractDetails.contract_amount_usd);
        paramIndex++;
      }
      if (contractDetails.contract_amount_eur !== null && contractDetails.contract_amount_eur !== undefined) {
        updates.push(`contract_amount_eur = $${paramIndex}`);
        updateParams.push(contractDetails.contract_amount_eur);
        paramIndex++;
      }
      if (contractDetails.contract_amount_ngn !== null && contractDetails.contract_amount_ngn !== undefined) {
        updates.push(`contract_amount_ngn = $${paramIndex}`);
        updateParams.push(contractDetails.contract_amount_ngn);
        paramIndex++;
      }
      if (contractDetails.quotation_amount_usd !== null && contractDetails.quotation_amount_usd !== undefined) {
        updates.push(`quotation_amount_usd = $${paramIndex}`);
        updateParams.push(contractDetails.quotation_amount_usd);
        paramIndex++;
      }
      if (contractDetails.estimated_delivery_date) {
        updates.push(`estimated_delivery_date = $${paramIndex}`);
        updateParams.push(contractDetails.estimated_delivery_date);
        paramIndex++;
      }
    }
  } else if (user.role === 'discipline_manager') {
    updates.push(`approved_by_discipline_manager = $${paramIndex}`);
    updateParams.push(user.id);
    paramIndex++;
    updates.push(`approved_date_discipline_manager = CURRENT_TIMESTAMP`);
    if (comments) {
      updates.push(`discipline_manager_comments = $${paramIndex}`);
      updateParams.push(comments);
      paramIndex++;
    }
    if (signaturePath) {
      updates.push(`discipline_manager_signature = $${paramIndex}`);
      updateParams.push(signaturePath);
      paramIndex++;
    }
    // CRITICAL: After discipline manager approval, MUST go to COMMERCIAL_REVIEW
    // Force nextStage to COMMERCIAL_REVIEW if it's not already set correctly
    if (nextStage !== 'COMMERCIAL_REVIEW') {
      console.warn(`⚠️ DM Approval: Expected COMMERCIAL_REVIEW but got ${nextStage}. Forcing to COMMERCIAL_REVIEW.`);
      // Override the workflow_stage update - use parameterized query
      const stageIndex = updates.findIndex(u => u.startsWith('workflow_stage'));
      if (stageIndex !== -1) {
        updates[stageIndex] = `workflow_stage = $1`; // Keep it parameterized
        updateParams[0] = 'COMMERCIAL_REVIEW'; // Update the first param which is workflow_stage
      }
    }
    updates.push(`status = 'Approved'`);
  }
  
  // Add request ID as the last parameter
  updateParams.push(request.id);
  const finalParamIndex = updateParams.length;
  
  const sql = `UPDATE material_requests SET ${updates.join(', ')} WHERE id = $${finalParamIndex}`;
  
  try {
    await client.query(sql, updateParams);
  } catch (dbError) {
    console.error('Database update error:', dbError);
    console.error('SQL:', sql);
    console.error('Params:', updateParams);
    console.error('Updates array:', updates);
    throw dbError;
  }
}

// ===================================
// RECORD APPROVAL HISTORY
// ===================================
async function recordApprovalHistory(client, requestId, fromStage, toStage, action, user, comments) {
  await client.query(
    `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      requestId,
      fromStage,
      toStage,
      action,
      user.id,
      `${user.first_name} ${user.last_name}`,
      user.role,
      comments || null
    ]
  );
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
    const userStage = ROLE_STAGE_MAP[user.role];
    
    // Verify user can reject this stage
    if (request.workflow_stage !== userStage) {
      return res.status(403).json({ 
        error: true, 
        message: `You cannot reject requests at ${request.workflow_stage} stage` 
      });
    }
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = 'REJECTED', 
             rejection_reason = $1,
             rejection_stage = $2,
             rejected_by = $3,
             rejected_date = CURRENT_TIMESTAMP,
             status = 'Rejected',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [reason, request.workflow_stage, user.id, id]
      );
      
      await recordApprovalHistory(client, id, request.workflow_stage, 'REJECTED', 'REJECTED', user, reason);
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
// POD PLANNER: ROUTE TO DISCIPLINE
// ===================================
async function routeToDiscipline(req, res) {
  try {
    const { id } = req.params;
    const { discipline, comments } = req.body;
    const user = req.user;
    
    if (user.role !== 'pod_planner') {
      return res.status(403).json({ error: true, message: 'Only POD planners can route requests' });
    }
    
    if (!discipline) {
      return res.status(400).json({ error: true, message: 'Discipline is required' });
    }
    
    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    
    if (request.workflow_stage !== 'POD_PLANNER_REVIEW') {
      return res.status(400).json({ error: true, message: 'Request is not at POD Planner stage' });
    }
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = 'DISCIPLINE_UNIT_REVIEW',
             pod_routed_to_discipline = $1,
             approved_by_pod_planner = $2,
             approved_date_pod_planner = CURRENT_TIMESTAMP,
             pod_planner_comments = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [discipline, user.id, comments || null, id]
      );
      
      await recordApprovalHistory(client, id, 'POD_PLANNER_REVIEW', 'DISCIPLINE_UNIT_REVIEW', 'ROUTED', user, 
        `Routed to ${discipline} discipline unit. ${comments || ''}`);
    });
    
    res.json({
      success: true,
      message: `Request routed to ${discipline} discipline unit`
    });
  } catch (error) {
    console.error('Route to discipline error:', error);
    res.status(500).json({ error: true, message: 'Failed to route request' });
  }
}

// ===================================
// DISCIPLINE UNIT: SUBMIT CONTRACT & QUOTATION
// ===================================
async function submitContractDetails(req, res) {
  try {
    const { id } = req.params;
    const { contract_number, contract_validity, vendor_name, comments } = req.body;
    const user = req.user;
    
    if (user.role !== 'discipline_unit') {
      return res.status(403).json({ error: true, message: 'Only discipline units can submit contract details' });
    }
    
    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    
    if (request.workflow_stage !== 'DISCIPLINE_UNIT_REVIEW') {
      return res.status(400).json({ error: true, message: 'Request is not at Discipline Unit stage' });
    }
    
    // Verify discipline matches
    const routedDiscipline = request.pod_routed_to_discipline || request.discipline;
    if (user.discipline_assignment && routedDiscipline !== user.discipline_assignment) {
      return res.status(403).json({ error: true, message: 'This request is not assigned to your discipline' });
    }
    
    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET contract_number = $1,
             contract_validity = $2,
             vendor_name_discipline = $3,
             approved_by_discipline_unit = $4,
             approved_date_discipline_unit = CURRENT_TIMESTAMP,
             discipline_unit_comments = $5,
             workflow_stage = 'DISCIPLINE_MANAGER_APPROVAL',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [contract_number, contract_validity, vendor_name, user.id, comments || null, id]
      );
      
      await recordApprovalHistory(client, id, 'DISCIPLINE_UNIT_REVIEW', 'DISCIPLINE_MANAGER_APPROVAL', 'APPROVED', user,
        `Contract: ${contract_number}, Vendor: ${vendor_name}. ${comments || ''}`);
    });
    
    res.json({
      success: true,
      message: 'Contract details submitted. Request moved to Discipline Manager for final approval.'
    });
  } catch (error) {
    console.error('Submit contract details error:', error);
    res.status(500).json({ error: true, message: 'Failed to submit contract details' });
  }
}

// ===================================
// DISCIPLINE MANAGER: APPROVE WITH QUANTITY ADJUSTMENTS
// ===================================
async function approveWithQuantityAdjustments(req, res) {
  try {
    const { id } = req.params;
    const { quantity_adjustments, comments } = req.body;
    const user = req.user;
    
    if (user.role !== 'discipline_manager') {
      return res.status(403).json({ error: true, message: 'Only discipline managers can adjust quantities' });
    }
    
    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    
    if (request.workflow_stage !== 'DISCIPLINE_MANAGER_APPROVAL') {
      return res.status(400).json({ error: true, message: 'Request is not at Discipline Manager stage' });
    }
    
    await transaction(async (client) => {
      // Update quantities if adjustments provided
      if (quantity_adjustments && Array.isArray(quantity_adjustments)) {
        for (const adjustment of quantity_adjustments) {
          const { line_id, approved_quantity, reason } = adjustment;
          
          await client.query(
            `UPDATE material_request_lines 
             SET quantity = $1,
                 line_notes = COALESCE(line_notes || E'\n', '') || $2
             WHERE id = $3 AND request_id = $4`,
            [approved_quantity, `Quantity adjusted by Discipline Manager: ${reason || 'No reason provided'}`, line_id, id]
          );
        }
      }
      
      // Store quantity adjustments in request
      const adjustmentsJson = quantity_adjustments ? JSON.stringify(quantity_adjustments) : null;
      
      // After discipline manager approval, move to COMMERCIAL_REVIEW (not COMPLETED)
      const nextStage = 'COMMERCIAL_REVIEW';
      
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = $1,
             approved_by_discipline_manager = $2,
             approved_date_discipline_manager = CURRENT_TIMESTAMP,
             discipline_manager_comments = $3,
             quantity_adjustments = $4,
             commercial_status = $1,
             status = 'Approved',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [nextStage, user.id, comments || null, adjustmentsJson, id]
      );
      
      await recordApprovalHistory(client, id, 'DISCIPLINE_MANAGER_APPROVAL', nextStage, 'APPROVED', user,
        `Discipline Manager approved. ${quantity_adjustments ? 'Quantities adjusted.' : ''} ${comments || ''}`);
    });
    
    res.json({
      success: true,
      message: 'Request approved and moved to Commercial Review',
      nextStage: 'COMMERCIAL_REVIEW'
    });
  } catch (error) {
    console.error('Approve with quantity adjustments error:', error);
    res.status(500).json({ error: true, message: 'Failed to approve request' });
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
// UPLOAD SIGNATURE
// ===================================
async function uploadSignature(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No signature file provided' });
    }

    const { request_id, role } = req.body;
    const user = req.user;

    // Verify user has permission
    if (!role || user.role !== role) {
      return res.status(403).json({ error: true, message: 'Invalid role for signature upload' });
    }

    // Generate signature path
    const signaturePath = `uploads/signatures/${req.file.filename}`;

    res.json({
      success: true,
      signature_path: signaturePath,
      message: 'Signature uploaded successfully'
    });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(500).json({ error: true, message: 'Failed to upload signature' });
  }
}

// ===================================
// GET APPROVED REQUESTS BY APPROVER
// ===================================
async function getApprovedRequests(req, res) {
  try {
    const user = req.user;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    // Build conditions based on role - include both approved AND rejected requests
    if (user.role === 'technical_coordinator') {
      conditions.push(`(r.approved_by_technical_coordinator = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'TECHNICAL_COORDINATOR_REVIEW'))`);
      params.push(user.id);
      paramIndex++;
    } else if (user.role === 'assistant_manager') {
      conditions.push(`(r.approved_by_assistant_manager = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'ASSISTANT_MANAGER_REVIEW'))`);
      params.push(user.id);
      paramIndex++;
    } else if (user.role === 'area_manager_land') {
      conditions.push(`((r.approved_by_area_manager = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'AREA_MANAGER_REVIEW')) AND r.mrf_number LIKE 'LAR-%')`);
      params.push(user.id);
      paramIndex++;
    } else if (user.role === 'area_manager_swamp') {
      conditions.push(`((r.approved_by_area_manager = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'AREA_MANAGER_REVIEW')) AND r.mrf_number LIKE 'SAR-%')`);
      params.push(user.id);
      paramIndex++;
    } else if (user.role === 'area_manager_phc') {
      conditions.push(`((r.approved_by_area_manager = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'AREA_MANAGER_REVIEW')) AND r.mrf_number LIKE 'PHC-%')`);
      params.push(user.id);
      paramIndex++;
    } else if (user.role === 'pod_planner') {
      conditions.push(`(r.approved_by_pod_planner = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'POD_PLANNER_REVIEW'))`);
      params.push(user.id);
      paramIndex++;
    } else if (user.role === 'discipline_unit') {
      conditions.push(`(r.approved_by_discipline_unit = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'DISCIPLINE_UNIT_REVIEW'))`);
      params.push(user.id);
      if (user.discipline_assignment) {
        conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex + 1})`);
        params.push(user.discipline_assignment);
        paramIndex += 2;
      } else {
        paramIndex++;
      }
    } else if (user.role === 'discipline_manager') {
      conditions.push(`(r.approved_by_discipline_manager = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'DISCIPLINE_MANAGER_APPROVAL'))`);
      params.push(user.id);
      if (user.discipline_assignment) {
        conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex + 1})`);
        params.push(user.discipline_assignment);
        paramIndex += 2;
      } else {
        paramIndex++;
      }
    } else {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    // Add status filter if provided
    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM material_requests r ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get requests - order by approval/rejection date, fallback to created_at
    const dateField = user.role === 'technical_coordinator' ? 'approved_date_technical_coordinator' :
      user.role === 'assistant_manager' ? 'approved_date_assistant_manager' :
      user.role.startsWith('area_manager') ? 'approved_date_area_manager' :
      user.role === 'pod_planner' ? 'approved_date_pod_planner' :
      user.role === 'discipline_unit' ? 'approved_date_discipline_unit' :
      'approved_date_discipline_manager';

    params.push(limit, offset);
    const result = await query(
      `SELECT r.*, 
              u.first_name || ' ' || u.last_name as requester_name,
              u.email as requester_email,
              COUNT(l.id) as line_items_count
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN material_request_lines l ON r.id = l.request_id
       ${whereClause}
       GROUP BY r.id, u.first_name, u.last_name, u.email
       ORDER BY COALESCE(r.${dateField}, r.rejected_date, r.created_at) DESC, r.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      success: true,
      requests: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get approved requests error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch approved requests: ' + error.message });
  }
}

// ===================================
// GET ALL REQUESTS FOR AREA MANAGERS (Past requests in their area)
// ===================================
async function getAreaRequests(req, res) {
  try {
    const user = req.user;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    if (!user.role.startsWith('area_manager_')) {
      return res.status(403).json({ error: true, message: 'Access denied. Area manager role required.' });
    }

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    // Determine area based on role
    // REPLACE WITH:
    if (user.role === 'area_manager_land') {
      conditions.push(`(r.approved_by_area_manager = $${paramIndex} OR (r.rejected_by = $${paramIndex} AND r.rejection_stage = 'AREA_MANAGER_REVIEW'))`);
      params.push(user.id);
      paramIndex++;
      conditions.push(`(r.area = $${paramIndex} OR r.mrf_number LIKE 'LAR-%')`);
      params.push('Land Area');
      paramIndex++;
    
    } else if (user.role === 'area_manager_swamp') {
      conditions.push(`(r.area = $${paramIndex} OR r.mrf_number LIKE 'SAR-%')`);
      params.push('Swamp Area');
      paramIndex++;
    } else if (user.role === 'area_manager_phc') {
      conditions.push(`(r.area = $${paramIndex} OR r.mrf_number LIKE 'PHC-%')`);
      params.push('PHC POD');
      paramIndex++;
    }

    // Add status filter if provided (but don't filter by default - show all requests)
    if (status && status !== 'all') {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count (use a copy of params to avoid modifying the original)
    const countParams = [...params];
    const countResult = await query(
      `SELECT COUNT(*) as total FROM material_requests r ${whereClause}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get requests - show ALL requests in the area regardless of status
    // Add limit and offset to params for the main query
    params.push(limit, offset);
    const result = await query(
      `SELECT r.*, 
              u.first_name || ' ' || u.last_name as requester_name,
              u.email as requester_email,
              COUNT(l.id) as line_items_count
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN material_request_lines l ON r.id = l.request_id
       ${whereClause}
       GROUP BY r.id, u.first_name, u.last_name, u.email
       ORDER BY r.request_date DESC, r.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      success: true,
      requests: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get area requests error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch area requests: ' + error.message });
  }
}

// ===================================
// COMMERCIAL WORKFLOW FUNCTIONS
// ===================================

// DU: Mark MRF as sent to contractor
async function markMRFSentToContractor(req, res) {
  try {
    const { id } = req.params;
    const { contractor_name, quotation_date } = req.body;
    const user = req.user;

    if (user.role !== 'discipline_unit') {
      return res.status(403).json({ error: true, message: 'Only Discipline Unit can mark MRF as sent to contractor' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Only allow if at COMMERCIAL_REVIEW stage (after DM approval)
    if (request.workflow_stage !== 'COMMERCIAL_REVIEW') {
      return res.status(400).json({ 
        error: true, 
        message: `Request must be at COMMERCIAL_REVIEW stage. Current stage: ${request.workflow_stage}` 
      });
    }

    await query(
      `UPDATE material_requests 
       SET contractor_name = $1,
           contractor_quotation_date = $2,
           mrf_sent_to_contractor_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [contractor_name, quotation_date, id]
    );

    res.json({
      success: true,
      message: 'MRF marked as sent to contractor'
    });
  } catch (error) {
    console.error('Mark MRF sent to contractor error:', error);
    res.status(500).json({ error: true, message: 'Failed to update: ' + error.message });
  }
}

// DU: Submit contractor quotation details
async function submitContractorQuotation(req, res) {
  try {
    const { id } = req.params;
    const { contract_details, quotation_received } = req.body;
    const user = req.user;

    if (user.role !== 'discipline_unit') {
      return res.status(403).json({ error: true, message: 'Only Discipline Unit can submit contractor quotation' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    if (request.workflow_stage !== 'COMMERCIAL_REVIEW') {
      return res.status(400).json({ 
        error: true, 
        message: `Request must be at COMMERCIAL_REVIEW stage. Current stage: ${request.workflow_stage}` 
      });
    }

    const updates = [];
    const updateParams = [];
    let paramIndex = 1;

    if (contract_details) {
      if (contract_details.contract_number) {
        updates.push(`contract_number = $${paramIndex}`);
        updateParams.push(contract_details.contract_number);
        paramIndex++;
      }
      if (contract_details.contract_validity) {
        updates.push(`contract_validity = $${paramIndex}`);
        updateParams.push(contract_details.contract_validity);
        paramIndex++;
      }
      if (contract_details.vendor_name) {
        updates.push(`vendor_name_discipline = $${paramIndex}`);
        updateParams.push(contract_details.vendor_name);
        paramIndex++;
        // Also save to contractor_name field (used in commercial section)
        updates.push(`contractor_name = $${paramIndex}`);
        updateParams.push(contract_details.vendor_name);
        paramIndex++;
      }
      if (contract_details.quotation_reference) {
        updates.push(`quotation_reference = $${paramIndex}`);
        updateParams.push(contract_details.quotation_reference);
        paramIndex++;
      }
      if (contract_details.quotation_amount_usd !== null && contract_details.quotation_amount_usd !== undefined) {
        updates.push(`quotation_amount_usd = $${paramIndex}`);
        updateParams.push(contract_details.quotation_amount_usd);
        paramIndex++;
      }
      if (contract_details.contract_amount_usd !== null && contract_details.contract_amount_usd !== undefined) {
        updates.push(`contract_amount_usd = $${paramIndex}`);
        updateParams.push(contract_details.contract_amount_usd);
        paramIndex++;
      }
      if (contract_details.contract_amount_eur !== null && contract_details.contract_amount_eur !== undefined) {
        updates.push(`contract_amount_eur = $${paramIndex}`);
        updateParams.push(contract_details.contract_amount_eur);
        paramIndex++;
      }
      if (contract_details.contract_amount_ngn !== null && contract_details.contract_amount_ngn !== undefined) {
        updates.push(`contract_amount_ngn = $${paramIndex}`);
        updateParams.push(contract_details.contract_amount_ngn);
        paramIndex++;
      }
      if (contract_details.estimated_delivery_date) {
        updates.push(`estimated_delivery_date = $${paramIndex}`);
        updateParams.push(contract_details.estimated_delivery_date);
        paramIndex++;
      }
    }
    
    // Mark quotation as received
    if (quotation_received !== undefined) {
      updates.push(`quotation_received = $${paramIndex}`);
      updateParams.push(quotation_received);
      paramIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);

    if (updates.length === 1) {
      // Only updated_at, no actual data to update
      return res.status(400).json({ 
        error: true, 
        message: 'No commercial details provided' 
      });
    }

    await query(
      `UPDATE material_requests SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      updateParams
    );

    // Log the submission
    // Use shorter action name to fit VARCHAR(20) if migration not run yet
    try {
      await query(
        `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          'COMMERCIAL_REVIEW',
          'COMMERCIAL_REVIEW',
          'COMMERCIAL_SUBMITTED', // Shorter: 20 chars max (fits VARCHAR(20))
          user.id,
          `${user.first_name} ${user.last_name}`,
          user.role,
          'Commercial details submitted, awaiting DODM approval'
        ]
      );
    } catch (historyError) {
      // If action field is still VARCHAR(20), use even shorter value
      if (historyError.message.includes('character varying(20)')) {
        await query(
          `INSERT INTO approval_history (request_id, from_stage, to_stage, action, approved_by, approver_name, approver_role, comments)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            'COMMERCIAL_REVIEW',
            'COMMERCIAL_REVIEW',
            'SUBMITTED', // Short fallback: 9 chars
            user.id,
            `${user.first_name} ${user.last_name}`,
            user.role,
            'Commercial details submitted, awaiting DODM approval'
          ]
        );
      } else {
        throw historyError;
      }
    }

    res.json({
      success: true,
      message: 'Commercial details submitted successfully. Awaiting DODM approval.',
      nextStage: 'COMMERCIAL_REVIEW' // Still at COMMERCIAL_REVIEW until DODM approves
    });
  } catch (error) {
    console.error('Submit contractor quotation error:', error);
    res.status(500).json({ error: true, message: 'Failed to submit quotation: ' + error.message });
  }
}

// DU: Mark quotation as received
async function markQuotationReceived(req, res) {
  try {
    const { id } = req.params;
    const { quotation_received } = req.body;
    const user = req.user;

    if (user.role !== 'discipline_unit') {
      return res.status(403).json({ error: true, message: 'Only Discipline Unit can mark quotation received' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    if (request.workflow_stage !== 'COMMERCIAL_REVIEW') {
      return res.status(400).json({ 
        error: true, 
        message: `Request must be at COMMERCIAL_REVIEW stage. Current stage: ${request.workflow_stage}` 
      });
    }

    await query(
      'UPDATE material_requests SET quotation_received = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [quotation_received || true, id]
    );

    res.json({
      success: true,
      message: 'Quotation received status updated successfully'
    });
  } catch (error) {
    console.error('Mark quotation received error:', error);
    res.status(500).json({ error: true, message: 'Failed to update quotation received status: ' + error.message });
  }
}

// DODM: Approve commercial
async function approveCommercial(req, res) {
  try {
    const { id } = req.params;
    const { comments, signature_path } = req.body;
    const user = req.user;

    if (user.role !== 'dodm') {
      return res.status(403).json({ error: true, message: 'Only DODM can approve commercial' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    if (request.workflow_stage !== 'COMMERCIAL_REVIEW') {
      return res.status(400).json({ 
        error: true, 
        message: `Request must be at COMMERCIAL_REVIEW stage. Current stage: ${request.workflow_stage}` 
      });
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = 'COMMERCIAL_APPROVED',
             commercial_status = 'COMMERCIAL_APPROVED',
             commercial_approved_by = $1,
             commercial_approved_date = CURRENT_TIMESTAMP,
             commercial_approver_signature = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [user.id, signature_path || null, id]
      );
      
      // Add comment to status_notes for DU visibility (if comments provided)
      if (comments) {
        await client.query(
          `UPDATE material_requests 
           SET status_notes = COALESCE(status_notes || E'\\n', '') || 'DODM Approval: ' || $1 
           WHERE id = $2`,
          [comments, id]
        );
      }

      await recordApprovalHistory(client, id, 'COMMERCIAL_REVIEW', 'COMMERCIAL_APPROVED', 'APPROVED', user, comments);
    });

    res.json({
      success: true,
      message: 'Commercial quotation approved successfully. DU has been notified.',
      nextStage: 'COMMERCIAL_APPROVED'
    });
  } catch (error) {
    console.error('Approve commercial error:', error);
    res.status(500).json({ error: true, message: 'Failed to approve commercial: ' + error.message });
  }
}

// DODM: Reject commercial quotation
async function rejectCommercial(req, res) {
  try {
    const { id } = req.params;
    const { comments, signature_path } = req.body;
    const user = req.user;

    if (user.role !== 'dodm') {
      return res.status(403).json({ error: true, message: 'Only DODM can reject commercial quotations' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    if (request.workflow_stage !== 'COMMERCIAL_REVIEW') {
      return res.status(400).json({ 
        error: true, 
        message: `Request must be at COMMERCIAL_REVIEW stage. Current stage: ${request.workflow_stage}` 
      });
    }

    if (!comments || comments.trim().length < 10) {
      return res.status(400).json({ 
        error: true, 
        message: 'Rejection reason is required (minimum 10 characters)' 
      });
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = 'COMMERCIAL_REVIEW',
             commercial_status = 'REJECTED',
             commercial_rejected_by = $1,
             commercial_rejected_date = CURRENT_TIMESTAMP,
             commercial_rejection_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [user.id, comments, id]
      );

      await recordApprovalHistory(client, id, 'COMMERCIAL_REVIEW', 'COMMERCIAL_REVIEW', 'REJECTED', user, comments);
      
      // Add rejection reason to status_notes for DU visibility
      await client.query(
        `UPDATE material_requests 
         SET status_notes = COALESCE(status_notes || E'\\n', '') || 'DODM Rejection: ' || $1 
         WHERE id = $2`,
        [comments, id]
      );
    });

    res.json({
      success: true,
      message: 'Commercial quotation rejected. DU has been notified to review and resubmit.',
      nextStage: 'COMMERCIAL_REVIEW'
    });
  } catch (error) {
    console.error('Reject commercial error:', error);
    res.status(500).json({ error: true, message: 'Failed to reject commercial: ' + error.message });
  }
}

// DU: Mark material as delivered by contractor
async function markMaterialDelivered(req, res) {
  try {
    const { id } = req.params;
    const { material_delivered } = req.body; // true or false
    const user = req.user;

    if (user.role !== 'discipline_unit') {
      return res.status(403).json({ error: true, message: 'Only Discipline Unit can mark material as delivered' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    if (request.workflow_stage !== 'COMMERCIAL_APPROVED' && request.workflow_stage !== 'MATERIAL_DELIVERY') {
      return res.status(400).json({ 
        error: true, 
        message: `Request must be at COMMERCIAL_APPROVED or MATERIAL_DELIVERY stage. Current stage: ${request.workflow_stage}` 
      });
    }

    await transaction(async (client) => {
      if (material_delivered === true) {
        await client.query(
          `UPDATE material_requests 
           SET material_delivered_to_du = true,
               material_delivered_date = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );

        await recordApprovalHistory(client, id, request.workflow_stage, request.workflow_stage, 'MATERIAL_DELIVERED_TO_DU', user, 'Material delivered to Discipline Unit by contractor');
      } else {
        await client.query(
          `UPDATE material_requests 
           SET material_delivered_to_du = false,
               material_delivered_date = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );

        await recordApprovalHistory(client, id, request.workflow_stage, request.workflow_stage, 'MATERIAL_DELIVERY_UNMARKED', user, 'Material delivery status unmarked');
      }
    });

    res.json({
      success: true,
      message: material_delivered 
        ? 'Material delivery from contractor marked successfully' 
        : 'Material delivery status updated',
      nextStage: request.workflow_stage
    });
  } catch (error) {
    console.error('Mark material delivered error:', error);
    res.status(500).json({ error: true, message: 'Failed to mark delivery: ' + error.message });
  }
}

// DU: Mark material as sent to requestor
async function markMaterialSentToRequestor(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== 'discipline_unit') {
      return res.status(403).json({ error: true, message: 'Only Discipline Unit can mark material as sent to requestor' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];
    const { material_sent } = req.body; // true or false

    if (material_sent === true && !request.material_delivered_to_du) {
      return res.status(400).json({ 
        error: true, 
        message: 'Material must be delivered to DU first before sending to requestor' 
      });
    }

    await transaction(async (client) => {
      if (material_sent === true) {
        await client.query(
          `UPDATE material_requests 
           SET workflow_stage = 'MATERIAL_DELIVERY',
               commercial_status = 'MATERIAL_DELIVERY',
               material_sent_to_requestor = true,
               material_sent_to_requestor_date = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );

        await recordApprovalHistory(client, id, request.workflow_stage, 'MATERIAL_DELIVERY', 'MATERIAL_SENT_TO_REQUESTOR', user, 'Material sent to requestor by Discipline Unit');
      } else {
        await client.query(
          `UPDATE material_requests 
           SET material_sent_to_requestor = false,
               material_sent_to_requestor_date = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );

        await recordApprovalHistory(client, id, request.workflow_stage, request.workflow_stage, 'MATERIAL_SENT_UNMARKED', user, 'Material sent to requestor status unmarked');
      }
    });

    res.json({
      success: true,
      message: material_sent 
        ? 'Material sent to requestor marked successfully' 
        : 'Material sent status updated',
      nextStage: material_sent ? 'MATERIAL_DELIVERY' : request.workflow_stage
    });
  } catch (error) {
    console.error('Mark material sent to requestor error:', error);
    res.status(500).json({ error: true, message: 'Failed to mark material sent: ' + error.message });
  }
}

// Requisitor: Approve or reject material delivery
async function approveMaterialDelivery(req, res) {
  try {
    const { id } = req.params;
    const { approved, comments } = req.body;
    const user = req.user;

    if (user.role !== 'worker') {
      return res.status(403).json({ error: true, message: 'Only Requisitor can approve/reject material delivery' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found or you are not the requisitor' });
    }

    const request = requestResult.rows[0];

    if (request.workflow_stage !== 'MATERIAL_DELIVERY') {
      return res.status(400).json({ 
        error: true, 
        message: `Request must be at MATERIAL_DELIVERY stage. Current stage: ${request.workflow_stage}` 
      });
    }

    const { line_items } = req.body; // Array of { line_id, received_quantity }
    const { has_complaint, complaint_details } = req.body;

    if (approved === true) {
      // All materials received - move to MATERIAL_RECEIVED
      await transaction(async (client) => {
        // Update request
        await client.query(
          `UPDATE material_requests 
           SET workflow_stage = 'MATERIAL_RECEIVED',
               commercial_status = 'MATERIAL_RECEIVED',
               material_received_by_requisitor = true,
               material_received_date = CURRENT_TIMESTAMP,
               requisitor_delivery_approval = true,
               requisitor_delivery_comments = $1,
               has_delivery_complaint = $2,
               delivery_complaint_details = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [comments || null, has_complaint || false, complaint_details || null, id]
        );

        // Update line items with received quantities
        if (line_items && Array.isArray(line_items)) {
          for (const item of line_items) {
            await client.query(
              `UPDATE material_request_lines 
               SET received_quantity = $1,
                   actual_delivery_date = CURRENT_TIMESTAMP
               WHERE id = $2 AND request_id = $3`,
              [item.received_quantity || 0, item.line_id, id]
            );
          }
        }

        await recordApprovalHistory(client, id, 'MATERIAL_DELIVERY', 'MATERIAL_RECEIVED', 'APPROVED', user, comments || 'All materials received');
      });

      res.json({
        success: true,
        message: has_complaint ? 'Material delivery acknowledged with complaint. Complaint will be reviewed by all levels.' : 'Material delivery approved. Request moved to MATERIAL_RECEIVED stage.',
        nextStage: 'MATERIAL_RECEIVED',
        has_complaint: has_complaint || false
      });
    } else {
      // Materials rejected - record complaint and route through all levels
      await transaction(async (client) => {
        // Update request with rejection and complaint
        await client.query(
          `UPDATE material_requests 
           SET requisitor_delivery_approval = false,
               requisitor_delivery_comments = $1,
               has_delivery_complaint = true,
               delivery_complaint_details = $2,
               workflow_stage = 'DISCIPLINE_UNIT_REVIEW',
               commercial_status = 'DELIVERY_COMPLAINT',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [comments, complaint_details || comments, id]
        );

        // Update line items with received quantities (if any)
        if (line_items && Array.isArray(line_items)) {
          for (const item of line_items) {
            await client.query(
              `UPDATE material_request_lines 
               SET received_quantity = $1,
                   actual_delivery_date = CURRENT_TIMESTAMP
               WHERE id = $2 AND request_id = $3`,
              [item.received_quantity || 0, item.line_id, id]
            );
          }
        }

        // Record complaint in history - goes through all levels
        await recordApprovalHistory(client, id, 'MATERIAL_DELIVERY', 'DISCIPLINE_UNIT_REVIEW', 'DELIVERY_COMPLAINT', user, `Delivery complaint: ${complaint_details || comments}`);
      });

      res.json({
        success: true,
        message: 'Material delivery complaint recorded. Complaint will be reviewed by all approval levels.',
        nextStage: 'DISCIPLINE_UNIT_REVIEW',
        has_complaint: true
      });
    }
  } catch (error) {
    console.error('Approve material delivery error:', error);
    res.status(500).json({ error: true, message: 'Failed to process: ' + error.message });
  }
}

// DU: Mark request as closed after requisitor confirms receipt
async function closeRequest(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== 'discipline_unit') {
      return res.status(403).json({ error: true, message: 'Only Discipline Unit can close requests' });
    }

    const requestResult = await query(
      'SELECT * FROM material_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    if (request.workflow_stage !== 'MATERIAL_RECEIVED' || !request.material_received_by_requisitor) {
      return res.status(400).json({ 
        error: true, 
        message: 'Request must be at MATERIAL_RECEIVED stage with requisitor approval' 
      });
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = 'CLOSED',
             status = 'Completed',
             commercial_status = 'CLOSED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      await recordApprovalHistory(client, id, 'MATERIAL_RECEIVED', 'CLOSED', 'CLOSED', user, 'Request closed - all materials received and confirmed');
    });

    res.json({
      success: true,
      message: 'Request closed successfully',
      nextStage: 'CLOSED'
    });
  } catch (error) {
    console.error('Close request error:', error);
    res.status(500).json({ error: true, message: 'Failed to close request: ' + error.message });
  }
}

// Discipline Manager: Reject request (allows requisitor to edit and resend)
async function rejectRequestWithEdit(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    if (user.role !== 'discipline_manager') {
      return res.status(403).json({ error: true, message: 'Only Discipline Manager can reject requests' });
    }

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
    const userStage = ROLE_STAGE_MAP[user.role];

    if (request.workflow_stage !== userStage) {
      return res.status(403).json({ 
        error: true, 
        message: `You cannot reject requests at ${request.workflow_stage} stage` 
      });
    }

    await transaction(async (client) => {
      // Reject and allow editing - move back to REQUESTOR_SUBMITTED so requisitor can edit
      await client.query(
        `UPDATE material_requests 
         SET workflow_stage = 'REQUESTOR_SUBMITTED',
             status = 'Pending',
             rejection_reason = $1,
             rejection_stage = $2,
             rejected_by = $3,
             rejected_date = CURRENT_TIMESTAMP,
             can_edit = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [reason, request.workflow_stage, user.id, id]
      );

      await recordApprovalHistory(client, id, request.workflow_stage, 'REQUESTOR_SUBMITTED', 'REJECTED', user, reason);
    });

    res.json({
      success: true,
      message: 'Request rejected. Requisitor can now edit and resubmit.',
      canEdit: true
    });
  } catch (error) {
    console.error('Reject request with edit error:', error);
    res.status(500).json({ error: true, message: 'Failed to reject request' });
  }
}

module.exports = {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  routeToDiscipline,
  submitContractDetails,
  approveWithQuantityAdjustments,
  getApprovalHistory,
  uploadSignature,
  getApprovedRequests,
  getAreaRequests,
  markMRFSentToContractor,
  submitContractorQuotation,
  markQuotationReceived,
  approveCommercial,
  rejectCommercial,
  markMaterialDelivered,
  markMaterialSentToRequestor,
  approveMaterialDelivery,
  closeRequest,
  rejectRequestWithEdit
};
