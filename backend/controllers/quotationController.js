const { query } = require('../config/database');

const QUOTATION_STATUSES = ['pending', 'approved', 'rejected'];

function normalizeStatus(value) {
  if (!value) return null;
  const key = value.toLowerCase();
  if (QUOTATION_STATUSES.includes(key)) return key;
  if (key === 'all') return 'all';
  return null;
}

async function listQuotations(req, res) {
  try {
    const {
      status = 'pending',
      area,
      search,
      from,
      to,
      page = 1,
      limit = 25
    } = req.query;

    const normalizedStatus = normalizeStatus(status) || 'pending';
    const offset = (page - 1) * limit;

    const whereClause = [`a.category = 'quotation'`];
    const params = [];
    let paramIndex = 1;

    if (normalizedStatus !== 'all') {
      whereClause.push(`a.status = $${paramIndex}`);
      params.push(normalizedStatus);
      paramIndex++;
    }

    if (area && area !== 'all') {
      whereClause.push(`r.mrf_number LIKE $${paramIndex}`);
      params.push(`${area}-%`);
      paramIndex++;
    }

    if (search) {
      whereClause.push(`(r.mrf_number ILIKE $${paramIndex} OR a.file_name ILIKE $${paramIndex} OR r.vendor_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from) {
      whereClause.push(`a.uploaded_at >= $${paramIndex}`);
      params.push(from);
      paramIndex++;
    }

    if (to) {
      whereClause.push(`a.uploaded_at <= $${paramIndex}`);
      params.push(to);
      paramIndex++;
    }

    const whereSQL = `WHERE ${whereClause.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM attachments a
       INNER JOIN material_requests r ON a.request_id = r.id
       ${whereSQL}`,
      params
    );

    const total = parseInt(countResult.rows[0].total, 10);

    params.push(limit, offset);

    const rowsResult = await query(
      `SELECT 
         a.*,
         r.mrf_number,
         r.asset,
         r.discipline,
         r.status AS request_status,
         r.quotation_status,
         r.vendor_name,
         r.request_date,
         uploader.first_name AS uploader_first_name,
         uploader.last_name AS uploader_last_name,
         approver.first_name AS approver_first_name,
         approver.last_name AS approver_last_name
       FROM attachments a
       INNER JOIN material_requests r ON a.request_id = r.id
       LEFT JOIN users uploader ON a.uploaded_by = uploader.id
       LEFT JOIN users approver ON a.approved_by = approver.id
       ${whereSQL}
       ORDER BY a.uploaded_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      success: true,
      data: rowsResult.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List quotations error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch quotations' });
  }
}

async function updateQuotationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const normalizedStatus = normalizeStatus(status);

    if (!normalizedStatus || normalizedStatus === 'all') {
      return res.status(400).json({ error: true, message: 'Invalid status value' });
    }

    const attachmentResult = await query(
      `SELECT * FROM attachments WHERE id = $1 AND category = 'quotation'`,
      [id]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Quotation not found' });
    }

    const attachment = attachmentResult.rows[0];
    const approvedBy = normalizedStatus === 'approved' ? req.user.id : (normalizedStatus === 'rejected' ? req.user.id : null);
    const approvedAt = normalizedStatus === 'approved' || normalizedStatus === 'rejected' ? new Date() : null;

    const updatedAttachment = await query(
      `UPDATE attachments
       SET status = $1,
           notes = $2,
           approved_by = $3,
           approved_at = $4
       WHERE id = $5
       RETURNING *`,
      [normalizedStatus, notes || attachment.notes, approvedBy, approvedAt, id]
    );

    let requestQuotationStatus = normalizedStatus === 'approved'
      ? 'Approved'
      : normalizedStatus === 'rejected'
        ? 'Rejected'
        : 'Pending';

    if (requestQuotationStatus !== 'Approved') {
      const approvedCount = await query(
        `SELECT COUNT(*) AS count
         FROM attachments
         WHERE request_id = $1
           AND category = 'quotation'
           AND status = 'approved'`,
        [attachment.request_id]
      );

      if (parseInt(approvedCount.rows[0].count, 10) > 0) {
        requestQuotationStatus = 'Approved';
      }
    }

    const requestUpdates = ['quotation_status = $1'];
    const requestParams = [requestQuotationStatus];
    let reqIdx = 2;

    if (normalizedStatus === 'approved') {
      requestUpdates.push(`quotation_reference = $${reqIdx++}`);
      requestParams.push(attachment.file_name);
      requestUpdates.push(`quotation_approval_date = $${reqIdx++}`);
      requestParams.push(new Date());
    } else if (requestQuotationStatus !== 'Approved') {
      requestUpdates.push('quotation_reference = NULL');
      requestUpdates.push('quotation_approval_date = NULL');
    }

    requestUpdates.push('updated_at = CURRENT_TIMESTAMP');
    requestUpdates.push(`updated_by = $${reqIdx}`);
    requestParams.push(req.user.id);
    requestParams.push(attachment.request_id);

    const updatedRequest = await query(
      `UPDATE material_requests
       SET ${requestUpdates.join(', ')}
       WHERE id = $${reqIdx + 1}
       RETURNING *`,
      requestParams
    );

    res.json({
      success: true,
      message: 'Quotation updated successfully',
      quotation: updatedAttachment.rows[0],
      request: updatedRequest.rows[0]
    });
  } catch (error) {
    console.error('Update quotation status error:', error);
    res.status(500).json({ error: true, message: 'Failed to update quotation' });
  }
}

module.exports = {
  listQuotations,
  updateQuotationStatus
};

