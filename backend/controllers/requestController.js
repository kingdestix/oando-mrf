// backend/controllers/requestController.js
// FIXED: SQL parameter bug in area filtering

const { query, transaction } = require('../config/database');
const { generateRequestNumber } = require('../utils/requestNumber');
const { validateRequest } = require('../utils/validation');
const { sendEmail } = require('../utils/email');
const path = require('path');
const fs = require('fs');
const { generateMRFPDF } = require('../utils/pdfGenerator');

const QUOTE_STATUS_MAP = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  not_submitted: 'Not Submitted',
  'not submitted': 'Not Submitted'
};

function normalizeQuotationStatusInput(value) {
  if (!value) return null;
  const key = value.toLowerCase().replace(/\s+/g, '_');
  return QUOTE_STATUS_MAP[key] || value;
}

async function createRequest(req, res) {
  try {
    const data = req.body;
    
    console.log('📥 Received request data:', JSON.stringify(data, null, 2));
    
    const validation = validateRequest(data);
    if (!validation.valid) {
      return res.status(400).json({
        error: true,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Generate MRF number based on area
    let mrf_number = data.mrf_number;
    if (!mrf_number) {
      const area = data.area || 'Land Area';
      let siteCode = 'LAR';
      
      if (area.toUpperCase().includes('LAND')) {
        siteCode = 'LAR';
      } else if (area.toUpperCase().includes('SWAMP')) {
        siteCode = 'SAR';
      } else if (area.toUpperCase().includes('PHC')) {
        siteCode = 'PHC';
      }
      
      mrf_number = await generateRequestNumber(siteCode);
    }

    console.log('✅ Generated MRF Number:', mrf_number);

    const result = await transaction(async (client) => {
      const assetValue = data.location || data.asset;
      
      console.log('💾 Inserting into database with asset:', assetValue);
      
      // Insert main request (without year - it's auto-generated)
      const requestResult = await client.query(
        `INSERT INTO material_requests (
          mrf_number, request_date, user_id, first_name, last_name, user_code, 
          designation, office_extension, asset, unit_tag, discipline, material_category, 
          criticality, work_order_no, work_order_type, reason, service_material, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          mrf_number,
          data.request_date || new Date(),
          req.user.id,
          data.first_name,
          data.last_name,
          data.user_code,
          data.designation,
          data.office_extension || '',
          assetValue,
          data.unit_tag || '',
          data.discipline,
          data.material_category || '',
          data.criticality || 'Medium',
          data.work_order_no || '',
          data.work_order_type || '',
          data.reason,
          data.service_material || 'Material',
          req.user.id
        ]
      );

      const request = requestResult.rows[0];
      console.log('✅ Request created with ID:', request.id);

      // Insert line items
      if (data.lines && data.lines.length > 0) {
        for (let i = 0; i < data.lines.length; i++) {
          const line = data.lines[i];
          await client.query(
            `INSERT INTO material_request_lines (
              request_id, line_no, material_description, oem_model, part_number, 
              quantity, quantity_unit, received_quantity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              request.id, 
              i + 1, 
              line.material_description, 
              line.oem_model || '',
              line.part_number || '', 
              line.quantity || 1,
              line.quantity_unit || 'pcs',
              line.received_quantity || 0
            ]
          );
        }
      }

      // Log activity
      await client.query(
        'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'REQUEST_CREATED', 'material_request', request.id, `Created request ${mrf_number}`]
      );

      return request;
    });

    // Send email notification to managers
    try {
      const managers = await query('SELECT email, first_name, last_name FROM users WHERE role = $1', ['admin']);
      
      for (const manager of managers.rows) {
        await sendEmail({
          to: manager.email,
          subject: `New Material Request: ${mrf_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #00205B; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">New Material Request</h1>
              </div>
              <div style="padding: 20px; background: #f5f5f5;">
                <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #F58220;">
                  <h2 style="color: #00205B; margin-top: 0;">Request Details</h2>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">MRF Number:</td>
                      <td style="padding: 8px 0; color: #00205B; font-weight: bold;">${mrf_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Requestor:</td>
                      <td style="padding: 8px 0;">${data.first_name} ${data.last_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Designation:</td>
                      <td style="padding: 8px 0;">${data.designation}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Asset:</td>
                      <td style="padding: 8px 0;">${data.location || data.asset}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Discipline:</td>
                      <td style="padding: 8px 0;">${data.discipline}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Reason:</td>
                      <td style="padding: 8px 0;">${data.reason}</td>
                    </tr>
                  </table>
                  <div style="margin-top: 20px; text-align: center;">
                    <a href="${process.env.APP_URL || 'http://localhost:5000'}/admin-dashboard.html" 
                       style="display: inline-block; background: #F58220; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                      View Request
                    </a>
                  </div>
                </div>
              </div>
              <div style="padding: 20px; text-align: center; color: #737373; font-size: 12px;">
                <p>This is an automated notification from Oando Material Request System</p>
              </div>
            </div>
          `
        });
      }
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    console.log('🎉 Request created successfully!');
    res.status(201).json({ 
      success: true, 
      message: 'Request created successfully', 
      request: result 
    });
    
  } catch (error) {
    console.error('❌ Create request error:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ error: true, message: 'MRF number already exists' });
    }
    res.status(500).json({ error: true, message: 'Failed to create request: ' + error.message });
  }
}

async function getRequests(req, res) {
  try {
    const { 
      page = 1, 
      limit = 25, 
      sort = 'date_desc', 
      from, 
      to, 
      material, 
      status, 
      location, 
      user_id, 
      vendor, 
      discipline,
      area,
      mrf,
      quotation_status
    } = req.query;

    console.log('🔍 getRequests called with:', { page, limit, area, location, status, discipline });

    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = [];
    let paramIndex = 1;

    // Date filters
    if (from) {
      whereClause.push(`r.request_date >= $${paramIndex}`);
      params.push(from);
      paramIndex++;
    }
    if (to) {
      whereClause.push(`r.request_date <= $${paramIndex}`);
      params.push(to);
      paramIndex++;
    }
    
    // Status filter
    if (status) {
      whereClause.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    // ✅ FIXED: Area-based filtering via MRF prefix (added missing $ sign)
    if (area && area !== 'all') {
      whereClause.push(`r.mrf_number LIKE $${paramIndex}`);
      params.push(`${area}-%`);
      paramIndex++;
    } else if (location) {
      // Only use location filter if no area specified
      whereClause.push(`r.asset ILIKE $${paramIndex}`);
      params.push(`%${location}%`);
      paramIndex++;
    }
    
    // Discipline filter (case-insensitive)
    if (discipline) {
      whereClause.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }
    
    // Vendor filter
    if (vendor) {
      whereClause.push(`r.vendor_name ILIKE $${paramIndex}`);
      params.push(`%${vendor}%`);
      paramIndex++;
    }

    if (mrf) {
      whereClause.push(`r.mrf_number ILIKE $${paramIndex}`);
      params.push(`%${mrf}%`);
      paramIndex++;
    }

    if (quotation_status) {
      whereClause.push(`r.quotation_status = $${paramIndex}`);
      params.push(normalizeQuotationStatusInput(quotation_status));
      paramIndex++;
    }
    
    // Material search (searches in line items)
    if (material) {
      whereClause.push(`EXISTS (
        SELECT 1 FROM material_request_lines l 
        WHERE l.request_id = r.id 
        AND l.material_description ILIKE $${paramIndex}
      )`);
      params.push(`%${material}%`);
      paramIndex++;
    }

    // User-based filtering
    if (req.user.role === 'worker') {
      whereClause.push(`r.user_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    } else if (user_id) {
      whereClause.push(`r.user_code = $${paramIndex}`);
      params.push(user_id);
      paramIndex++;
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    // Sorting
    let orderBy = 'r.request_date DESC';
    switch (sort) {
      case 'date_asc': 
        orderBy = 'r.request_date ASC'; 
        break;
      case 'mrf_number': 
        orderBy = 'r.mrf_number ASC'; 
        break;
      case 'criticality': 
        orderBy = "CASE r.criticality WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, r.request_date DESC"; 
        break;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM material_requests r ${whereSQL}`, 
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    params.push(limit, offset);
    const result = await query(
      `SELECT 
        r.*,
        r.asset as location,
        u.email as requester_email, 
        COUNT(l.id) as line_items_count, 
        SUM(l.quantity) as total_quantity
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN material_request_lines l ON r.id = l.request_id
       ${whereSQL}
       GROUP BY r.id, u.email
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total, 
        totalPages: Math.ceil(total / limit) 
      }
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch requests' });
  }
}

async function getRequestById(req, res) {
  try {
    const { id } = req.params;

    // Get main request
    const requestResult = await query(
      `SELECT 
        r.*, 
        r.asset as location,
        u.email as requester_email 
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id 
       WHERE r.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Check access permissions
    if (req.user.role === 'worker' && request.user_id !== req.user.id) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    // Get line items
    const linesResult = await query(
      'SELECT * FROM material_request_lines WHERE request_id = $1 ORDER BY line_no',
      [id]
    );

    // Get attachments
    const attachmentsResult = await query(
      `SELECT a.*, u.first_name, u.last_name, approver.first_name AS approver_first_name, approver.last_name AS approver_last_name
       FROM attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id 
       LEFT JOIN users approver ON a.approved_by = approver.id
       WHERE a.request_id = $1 
       ORDER BY a.uploaded_at DESC`,
      [id]
    );

    const attachments = attachmentsResult.rows;
    const generalAttachments = attachments.filter(att => att.category !== 'quotation');
    const quotations = attachments.filter(att => att.category === 'quotation');

    res.json({
      success: true,
      request: { 
        ...request, 
        lines: linesResult.rows, 
        attachments: generalAttachments,
        quotations
      }
    });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch request' });
  }
}

async function updateRequest(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get existing request
    const existingRequest = await query(
      'SELECT * FROM material_requests WHERE id = $1', 
      [id]
    );
    
    if (existingRequest.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = existingRequest.rows[0];
    const oldStatus = request.status;

    // Check permissions
    if (req.user.role === 'worker' && request.user_id !== req.user.id) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    // Manager/Admin fields
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      if (updates.quotation_status) {
        updates.quotation_status = normalizeQuotationStatusInput(updates.quotation_status);
      }
      const adminFields = {
        status: updates.status,
        status_notes: updates.status_notes,
        internal_reference: updates.internal_reference,
        follow_up_by: updates.internal_reference,
        action_pending: updates.action_pending,
        vendor_name: updates.vendor_name,
        contractor_name: updates.vendor_name,
        blanket_order_number: updates.blanket_order_number,
        call_off_number: updates.call_off_number,
        purchase_order_no: updates.purchase_order_no,
        quotation_reference: updates.quotation_reference,
        quotation_approval_date: updates.quotation_approval_date,
        quotation_amount_usd: updates.quotation_amount_usd,
        quotation_amount_eur: updates.quotation_amount_eur,
        quotation_amount_ngn: updates.quotation_amount_ngn,
        quotation_status: updates.quotation_status,
        estimated_delivery_date: updates.estimated_delivery_date,
        actual_delivery_date: updates.actual_delivery_date,
        notes: updates.notes,
        other: updates.other,
        approved_by: updates.approved_by,
        manager_name: updates.approved_by,
        checked_by: updates.checked_by,
        issued_by: updates.issued_by
      };

      Object.entries(adminFields).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      });

      // Set approved_date if approved_by is set
      if (updates.approved_by && !request.approved_date) {
        updateFields.push(`approved_date = $${paramIndex}`);
        params.push(new Date());
        paramIndex++;
      }
    }

    // Remarks can be updated by anyone
    if (updates.remarks !== undefined) {
      updateFields.push(`remarks = $${paramIndex}`);
      params.push(updates.remarks);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: true, message: 'No valid fields to update' });
    }

    // Execute update
    params.push(id);
    params.push(req.user.id);
    const result = await query(
      `UPDATE material_requests 
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP, updated_by = $${paramIndex + 1}
       WHERE id = $${paramIndex} 
       RETURNING *`,
      params
    );

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'REQUEST_UPDATED', 'material_request', id, `Updated request ${request.mrf_number}`]
    );

    // Send email to requestor if status changed
    const newStatus = updates.status;
    if (newStatus && newStatus !== oldStatus && request.requester_email) {
      try {
        const statusMessages = {
          'Approved': { color: '#10b981', message: 'Your request has been approved.' },
          'Rejected': { color: '#ef4444', message: 'Your request has been rejected.' },
          'Ordered': { color: '#3b82f6', message: 'Your request has been ordered.' },
          'Delivered': { color: '#6366f1', message: 'Your materials have been delivered.' },
          'Completed': { color: '#8b5cf6', message: 'Your request has been completed.' }
        };

        const statusInfo = statusMessages[newStatus] || { color: '#F58220', message: `Status updated to ${newStatus}` };

        await sendEmail({
          to: request.requester_email,
          subject: `MRF ${request.mrf_number} - Status Update: ${newStatus}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #00205B; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Request Status Update</h1>
              </div>
              <div style="padding: 20px; background: #f5f5f5;">
                <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid ${statusInfo.color};">
                  <h2 style="color: ${statusInfo.color}; margin-top: 0;">${newStatus}</h2>
                  <p style="font-size: 16px; color: #171717;">${statusInfo.message}</p>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">MRF Number:</td>
                      <td style="padding: 8px 0; color: #00205B; font-weight: bold;">${request.mrf_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Request Date:</td>
                      <td style="padding: 8px 0;">${new Date(request.request_date).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Discipline:</td>
                      <td style="padding: 8px 0;">${request.discipline}</td>
                    </tr>
                    ${updates.status_notes ? `
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Notes:</td>
                      <td style="padding: 8px 0;">${updates.status_notes}</td>
                    </tr>
                    ` : ''}
                    ${updates.approved_by ? `
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #737373;">Approved By:</td>
                      <td style="padding: 8px 0;">${updates.approved_by}</td>
                    </tr>
                    ` : ''}
                  </table>
                  <div style="margin-top: 20px; text-align: center;">
                    <a href="${process.env.APP_URL || 'http://localhost:5000'}/worker-dashboard.html" 
                       style="display: inline-block; background: #F58220; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                      View Request
                    </a>
                  </div>
                </div>
              </div>
              <div style="padding: 20px; text-align: center; color: #737373; font-size: 12px;">
                <p>This is an automated notification from Oando Material Request System</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send status update email:', emailError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Request updated successfully', 
      request: result.rows[0] 
    });
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ error: true, message: 'Failed to update request' });
  }
}

async function deleteRequest(req, res) {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM material_requests WHERE id = $1 RETURNING mrf_number', 
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    await query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'REQUEST_DELETED', 'material_request', id, `Deleted request ${result.rows[0].mrf_number}`]
    );

    res.json({ success: true, message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: true, message: 'Failed to delete request' });
  }
}

async function uploadAttachment(req, res) {
  try {
    const { id } = req.params;
    const categoryInput = (req.body.category || 'general').toLowerCase();
    const attachmentCategory = categoryInput === 'quotation' ? 'quotation' : 'general';
    const notes = req.body.notes || null;
    let attachmentStatus = (req.body.status || (attachmentCategory === 'quotation' ? 'pending' : 'uploaded')).toLowerCase();
    const allowedStatuses = ['pending', 'approved', 'rejected', 'uploaded'];
    
    if (!allowedStatuses.includes(attachmentStatus)) {
      attachmentStatus = attachmentCategory === 'quotation' ? 'pending' : 'uploaded';
    }

    if (attachmentCategory === 'quotation' && req.file && req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: true, message: 'Quotations must be uploaded as PDF files.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }

    const requestResult = await query(
      'SELECT id FROM material_requests WHERE id = $1', 
      [id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const approvedBy = attachmentCategory === 'quotation' && attachmentStatus === 'approved' ? req.user.id : null;
    const approvedAt = attachmentCategory === 'quotation' && attachmentStatus === 'approved' ? new Date() : null;

    const result = await query(
      `INSERT INTO attachments (
         request_id, file_name, file_path, file_type, file_size, uploaded_by, category, status, approved_by, approved_at, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        id, 
        req.file.originalname, 
        req.file.path, 
        req.file.mimetype, 
        req.file.size, 
        req.user.id,
        attachmentCategory,
        attachmentStatus,
        approvedBy,
        approvedAt,
        notes
      ]
    );

    if (attachmentCategory === 'quotation') {
      const statusForRequest = attachmentStatus === 'approved' ? 'Approved' : 'Pending';
      const requestUpdates = ['quotation_status = $1'];
      const requestParams = [statusForRequest];
      let reqParamIndex = 2;

      if (attachmentStatus === 'approved') {
        requestUpdates.push(`quotation_reference = $${reqParamIndex++}`);
        requestParams.push(req.body.quotation_reference || req.file.originalname);
        requestUpdates.push(`quotation_approval_date = $${reqParamIndex++}`);
        requestParams.push(new Date());
      }

      requestUpdates.push('updated_at = CURRENT_TIMESTAMP');
      requestUpdates.push(`updated_by = $${reqParamIndex}`);
      requestParams.push(req.user.id);

      requestParams.push(id);

      await query(
        `UPDATE material_requests 
         SET ${requestUpdates.join(', ')}
         WHERE id = $${reqParamIndex + 1}`,
        requestParams
      );
    }

    res.status(201).json({ 
      success: true, 
      message: 'Attachment uploaded successfully', 
      attachment: result.rows[0] 
    });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: true, message: 'Failed to upload attachment' });
  }
}

async function getLookups(req, res) {
  try {
    // Fixed disciplines list (8 disciplines)
    const fixedDisciplines = [
      { group_name: 'MECHANICAL' },
      { group_name: 'ELECTRICAL' },
      { group_name: 'INSTRUMENT' },
      { group_name: 'GMC' },
      { group_name: 'ASSET INTEGRITY' },
      { group_name: 'SERVICE' },
      { group_name: 'ROT EQUIPMENT' },
      { group_name: 'others' }
    ];

    // Try to get categories and sites, but don't fail if tables don't exist
    let categoriesResult = { rows: [] };
    let sitesResult = { rows: [] };
    
    try {
      categoriesResult = await query('SELECT category_name FROM material_categories WHERE is_active = true ORDER BY category_name');
    } catch (err) {
      console.log('⚠️ material_categories table not found, using empty array');
    }
    
    try {
      sitesResult = await query('SELECT site_name FROM sites WHERE is_active = true ORDER BY site_name');
    } catch (err) {
      console.log('⚠️ sites table not found, using empty array');
    }

    res.json({
      success: true,
      lookups: {
        materialGroups: fixedDisciplines,
        materialCategories: categoriesResult.rows,
        sites: sitesResult.rows,
        priorities: ['Low', 'Medium', 'High', 'Critical'],
        statuses: ['Pending', 'Approved', 'Rejected', 'Ordered', 'Delivered', 'Completed'],
        landAreaLocations: ['OBOB', 'KWALE', 'IRRI', 'OSHIE', 'EBOCHA', 'IDU', 'AKRI'],
        swampAreaLocations: ['OGBOINBIRI', 'BRASS', 'OBAMA', 'CLOUGH CREEK', 'BRASS TERMINAL'],
        phcPodLocations: ['IDU', 'PHC', 'AKRI', 'EBOCHA', 'SAMABIRI', 'TEBIDABA', 'OGBOINBIRI']
      }
    });
  } catch (error) {
    console.error('Get lookups error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch lookup data' });
  }
}


/**
 * Generate and download PDF for a request
 * GET /api/requests/:id/pdf
 */
async function downloadRequestPDF(req, res) {
  try {
    const { id } = req.params;

    // Get full request data
    const requestResult = await query(
      `SELECT r.*, u.email as requester_email 
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id 
       WHERE r.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Check access
    if (req.user.role === 'worker' && request.user_id !== req.user.id) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    // Get line items
    const linesResult = await query(
      'SELECT * FROM material_request_lines WHERE request_id = $1 ORDER BY line_no',
      [id]
    );

    request.lines = linesResult.rows;

    // Generate PDF
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const fileName = `MRF_${request.mrf_number.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    await generateMRFPDF(request, filePath);

    // Send PDF
    res.download(filePath, `${request.mrf_number}.pdf`, (err) => {
      if (err) {
        console.error('PDF download error:', err);
      }
      // Delete temp file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Failed to delete temp PDF:', unlinkErr);
      });
    });

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'PDF_DOWNLOADED', 'material_request', id, `Downloaded PDF for ${request.mrf_number}`]
    );

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: true, message: 'Failed to generate PDF' });
  }
}

// Debug: Check if all functions are defined
console.log('🔍 Function check:');
console.log('createRequest:', typeof createRequest);
console.log('getRequests:', typeof getRequests);
console.log('getRequestById:', typeof getRequestById);
console.log('updateRequest:', typeof updateRequest);
console.log('deleteRequest:', typeof deleteRequest);
console.log('uploadAttachment:', typeof uploadAttachment);
console.log('getLookups:', typeof getLookups);
console.log('downloadRequestPDF:', typeof downloadRequestPDF);

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
  uploadAttachment,
  getLookups,
  downloadRequestPDF
};

