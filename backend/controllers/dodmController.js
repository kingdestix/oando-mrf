// DODM Dashboard Controller
// Handles DODM-specific dashboard data and statistics

const { query } = require('../config/database');

/**
 * Get DODM Dashboard Statistics
 * GET /api/dodm/stats
 */
async function getDODMStats(req, res) {
  try {
    const user = req.user;
    
    if (user.role !== 'dodm') {
      return res.status(403).json({ error: true, message: 'Only DODM can access this endpoint' });
    }

    // Get pending commercial reviews
    const pendingResult = await query(
      `SELECT COUNT(*) as count FROM material_requests 
       WHERE workflow_stage = 'COMMERCIAL_REVIEW' 
       AND quotation_reference IS NOT NULL 
       AND quotation_reference != ''`
    );
    const pendingCount = parseInt(pendingResult.rows[0].count);

    // Get approved commercial requests (by this DODM)
    const approvedResult = await query(
      `SELECT COUNT(*) as count FROM material_requests 
       WHERE workflow_stage = 'COMMERCIAL_APPROVED' 
       AND commercial_approved_by = $1`,
      [user.id]
    );
    const approvedCount = parseInt(approvedResult.rows[0].count);

    // Get total approved quotation amounts
    const amountsResult = await query(
      `SELECT 
         COUNT(*) as total_approved,
         COALESCE(SUM(quotation_amount_usd), 0) as total_usd,
         COALESCE(SUM(quotation_amount_eur), 0) as total_eur,
         COALESCE(SUM(quotation_amount_ngn), 0) as total_ngn
       FROM material_requests 
       WHERE workflow_stage = 'COMMERCIAL_APPROVED' 
       AND commercial_approved_by = $1
       AND quotation_amount_usd IS NOT NULL`,
      [user.id]
    );

    const stats = amountsResult.rows[0];

    res.json({
      success: true,
      stats: {
        pending_reviews: pendingCount,
        approved_quotations: approvedCount,
        total_approved: parseInt(stats.total_approved),
        total_amount_usd: parseFloat(stats.total_usd),
        total_amount_eur: parseFloat(stats.total_eur),
        total_amount_ngn: parseFloat(stats.total_ngn)
      }
    });
  } catch (error) {
    console.error('Get DODM stats error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch DODM statistics' });
  }
}

/**
 * Get DODM Approved Requests (for tracking)
 * GET /api/dodm/approved
 */
async function getDODMApproved(req, res) {
  try {
    const user = req.user;
    const { page = 1, limit = 25 } = req.query;
    
    if (user.role !== 'dodm') {
      return res.status(403).json({ error: true, message: 'Only DODM can access this endpoint' });
    }

    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT r.*, 
              u.first_name || ' ' || u.last_name as requester_name,
              COUNT(l.id) as line_items_count,
              SUM(l.quantity) as total_quantity
       FROM material_requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN material_request_lines l ON r.id = l.request_id
       WHERE r.workflow_stage = 'COMMERCIAL_APPROVED' 
       AND r.commercial_approved_by = $1
       GROUP BY r.id, u.first_name, u.last_name
       ORDER BY r.commercial_approved_date DESC, r.request_date DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM material_requests 
       WHERE workflow_stage = 'COMMERCIAL_APPROVED' 
       AND commercial_approved_by = $1`,
      [user.id]
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
    console.error('Get DODM approved error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch approved requests' });
  }
}

module.exports = {
  getDODMStats,
  getDODMApproved
};

