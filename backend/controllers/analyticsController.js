// backend/controllers/analyticsController.js
// REPLACE ENTIRE FILE WITH THIS ENHANCED VERSION

const { query } = require('../config/database');

const WORKFLOW_BUCKETS = {
  awaitingApproval: ['MRF_CREATED', 'MRF_APPROVED', 'BLANKET_CHECK'],
  awaitingQuotation: ['QUOTATION_REQUESTED', 'QUOTATION_SUBMITTED', 'QUOTATION_APPROVED'],
  delivered: ['SHIPPED', 'COMPLIANCE_CHECK', 'RECEIVED'],
  closed: ['CLOSED']
};

// ===================================
// ENHANCED SUMMARY WITH MORE METRICS
// ===================================
async function getSummary(req, res) {
  try {
    const { from, to, location, discipline } = req.query;
    const params = [];
    let whereClause = '';
    let paramIndex = 1;

    const conditions = [];
    
    if (from && to) {
      conditions.push(`r.request_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(from, to);
      paramIndex += 2;
    }
    
    if (location) {
      if (location === 'Land Area' || location === 'LAR') {
        conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      } else if (location === 'Swamp Area' || location === 'SAR') {
        conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      } else if (location === 'PHC' || location === 'PHC POD') {
        conditions.push(`r.mrf_number LIKE 'PHC-%'`);
      } else {
        conditions.push(`r.asset ILIKE $${paramIndex}`);
        params.push(`%${location}%`);
        paramIndex++;
      }
    }
    
    if (discipline) {
      conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const totalRequestsResult = await query(
      `SELECT COUNT(*) as total FROM material_requests r ${whereClause}`,
      params
    );

    const statusResult = await query(
      `SELECT status, COUNT(*) as count FROM material_requests r ${whereClause} GROUP BY status`,
      params
    );

    const materialsResult = await query(
      `SELECT COUNT(DISTINCT l.material_description) as unique_materials
       FROM material_request_lines l
       JOIN material_requests r ON r.id = l.request_id ${whereClause}`,
      params
    );

    const quantityResult = await query(
      `SELECT SUM(l.quantity) as total_quantity FROM material_request_lines l
       JOIN material_requests r ON r.id = l.request_id ${whereClause}`,
      params
    );

    const valueResult = await query(
      `SELECT 
        SUM(l.quantity * COALESCE(l.unit_price_usd, 0)) as total_value_usd,
        SUM(l.quantity * COALESCE(l.unit_price_ngn, 0)) as total_value_ngn
       FROM material_request_lines l
       JOIN material_requests r ON r.id = l.request_id ${whereClause}`,
      params
    );
    
    // ✅ NEW: Average requests per month
    const avgPerMonthResult = await query(
      `SELECT 
        COUNT(*)::FLOAT / NULLIF(COUNT(DISTINCT DATE_TRUNC('month', request_date)), 0) as avg_per_month
       FROM material_requests r ${whereClause}`,
      params
    );
    
    // ✅ NEW: Most requested material
    const topMaterialResult = await query(
      `SELECT l.material_description, SUM(l.quantity) as total_qty
       FROM material_request_lines l
       JOIN material_requests r ON r.id = l.request_id ${whereClause}
       GROUP BY l.material_description
       ORDER BY total_qty DESC
       LIMIT 1`,
      params
    );

    const workflowStageResult = await query(
      `SELECT r.workflow_stage, COUNT(*) as count
       FROM material_requests r
       ${whereClause}
       GROUP BY r.workflow_stage`,
      params
    );
    
    const stageCounts = workflowStageResult.rows.reduce((acc, row) => {
      acc[row.workflow_stage] = parseInt(row.count) || 0;
      return acc;
    }, {});
    
    const bucketTotals = {
      awaitingApproval: WORKFLOW_BUCKETS.awaitingApproval.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0),
      awaitingQuotation: WORKFLOW_BUCKETS.awaitingQuotation.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0),
      delivered: WORKFLOW_BUCKETS.delivered.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0),
      closed: WORKFLOW_BUCKETS.closed.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0)
    };

    res.json({
      success: true,
      summary: {
        totalRequests: parseInt(totalRequestsResult.rows[0].total),
        uniqueMaterials: parseInt(materialsResult.rows[0].unique_materials || 0),
        totalQuantity: parseFloat(quantityResult.rows[0].total_quantity || 0),
        totalValueUSD: parseFloat(valueResult.rows[0].total_value_usd || 0),
        totalValueNGN: parseFloat(valueResult.rows[0].total_value_ngn || 0),
        avgRequestsPerMonth: parseFloat(avgPerMonthResult.rows[0].avg_per_month || 0).toFixed(1),
        topMaterial: topMaterialResult.rows[0] || null,
        byStatus: statusResult.rows,
        workflowStages: workflowStageResult.rows,
        workflowBuckets: bucketTotals
      }
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch summary' });
  }
}

// ===================================
// TOP MATERIALS (Same as before)
// ===================================
async function getTopMaterials(req, res) {
  try {
    const { limit = 10, from, to, location, discipline } = req.query;
    const params = [limit];
    let whereClause = '';
    let paramIndex = 2;

    const conditions = [];
    
    if (from && to) {
      conditions.push(`r.request_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(from, to);
      paramIndex += 2;
    }
    
    if (location) {
      if (location === 'Land Area' || location === 'LAR') {
        conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      } else if (location === 'Swamp Area' || location === 'SAR') {
        conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      } else if (location === 'PHC' || location === 'PHC POD') {
        conditions.push(`r.mrf_number LIKE 'PHC-%'`);
      } else {
        conditions.push(`r.asset ILIKE $${paramIndex}`);
        params.push(`%${location}%`);
        paramIndex++;
      }
    }
    
    if (discipline) {
      conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const result = await query(
      `SELECT 
        l.material_description,
        l.oem_model,
        COUNT(DISTINCT r.id) as request_count,
        SUM(l.quantity) as total_quantity,
        l.quantity_unit,
        ARRAY_AGG(DISTINCT r.asset) as locations,
        AVG(l.unit_price_usd) as avg_price_usd,
        AVG(l.unit_price_ngn) as avg_price_ngn
      FROM material_request_lines l
      JOIN material_requests r ON r.id = l.request_id
      ${whereClause}
      GROUP BY l.material_description, l.oem_model, l.quantity_unit
      ORDER BY total_quantity DESC
      LIMIT $1`,
      params
    );

    res.json({ success: true, materials: result.rows });
  } catch (error) {
    console.error('Get top materials error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch top materials' });
  }
}

// ===================================
// TIME SERIES (Same as before)
// ===================================
async function getTimeSeries(req, res) {
  try {
    const { interval = 'month', from, to, location, discipline } = req.query;
    const params = [];
    let whereClause = '';
    let paramIndex = 1;

    const conditions = [];
    
    if (from && to) {
      conditions.push(`r.request_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(from, to);
      paramIndex += 2;
    }
    
    if (location) {
      if (location === 'Land Area' || location === 'LAR') {
        conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      } else if (location === 'Swamp Area' || location === 'SAR') {
        conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      } else if (location === 'PHC' || location === 'PHC POD') {
        conditions.push(`r.mrf_number LIKE 'PHC-%'`);
      } else {
        conditions.push(`r.asset ILIKE $${paramIndex}`);
        params.push(`%${location}%`);
        paramIndex++;
      }
    }
    
    if (discipline) {
      conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const validIntervals = ['day', 'week', 'month', 'year'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ error: true, message: 'Invalid interval' });
    }

    const result = await query(
      `SELECT 
        date_trunc('${interval}', r.request_date) as period,
        COUNT(*) as request_count,
        SUM(l.quantity) as total_quantity,
        SUM(l.quantity * COALESCE(l.unit_price_usd, 0)) as total_value_usd
      FROM material_requests r
      LEFT JOIN material_request_lines l ON r.id = l.request_id
      ${whereClause}
      GROUP BY period
      ORDER BY period ASC`,
      params
    );

    res.json({ success: true, interval, data: result.rows });
  } catch (error) {
    console.error('Get time series error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch time series data' });
  }
}

// ===================================
// MATERIAL SEARCH (Same as before)
// ===================================
async function searchMaterial(req, res) {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ error: true, message: 'Search query is required' });
    }

    const summaryResult = await query(
      `SELECT 
        l.material_description,
        l.oem_model,
        COUNT(DISTINCT r.id) as total_requests,
        SUM(l.quantity) as total_quantity,
        l.quantity_unit,
        ROUND(AVG(l.unit_price_usd), 2) as avg_price_usd,
        ROUND(AVG(l.unit_price_ngn), 2) as avg_price_ngn,
        ROUND(SUM(l.quantity * COALESCE(l.unit_price_usd, 0)), 2) as total_value_usd,
        ROUND(SUM(l.quantity * COALESCE(l.unit_price_ngn, 0)), 2) as total_value_ngn
      FROM material_request_lines l
      JOIN material_requests r ON r.id = l.request_id
      WHERE 
        l.material_description ILIKE $1 OR
        l.oem_model ILIKE $1 OR
        l.part_number ILIKE $1
      GROUP BY l.material_description, l.oem_model, l.quantity_unit
      LIMIT 5`,
      [`%${q}%`]
    );

    const locationResult = await query(
      `SELECT 
        l.material_description,
        r.asset as location,
        COUNT(DISTINCT r.id) as request_count,
        SUM(l.quantity) as quantity_at_location,
        CASE 
          WHEN r.mrf_number LIKE 'LAR-%' THEN 'Land Area'
          WHEN r.mrf_number LIKE 'SAR-%' THEN 'Swamp Area'
          WHEN r.mrf_number LIKE 'PHC-%' THEN 'PHC POD'
          ELSE 'Other'
        END as area
      FROM material_request_lines l
      JOIN material_requests r ON r.id = l.request_id
      WHERE 
        l.material_description ILIKE $1 OR
        l.oem_model ILIKE $1 OR
        l.part_number ILIKE $1
      GROUP BY l.material_description, r.asset, area
      ORDER BY l.material_description, quantity_at_location DESC`,
      [`%${q}%`]
    );

    const recentRequestsResult = await query(
      `SELECT 
        r.mrf_number,
        r.request_date,
        r.asset as location,
        r.status,
        r.discipline,
        r.vendor_name,
        r.first_name || ' ' || r.last_name as requester,
        l.material_description,
        l.quantity,
        l.quantity_unit,
        l.unit_price_usd,
        l.oem_model,
        l.part_number
      FROM material_request_lines l
      JOIN material_requests r ON r.id = l.request_id
      WHERE 
        l.material_description ILIKE $1 OR
        l.oem_model ILIKE $1 OR
        l.part_number ILIKE $1
      ORDER BY r.request_date DESC
      LIMIT 20`,
      [`%${q}%`]
    );

    const materials = summaryResult.rows.map(material => {
      const locations = locationResult.rows.filter(
        loc => loc.material_description === material.material_description
      );
      return { ...material, locations };
    });

    res.json({ 
      success: true, 
      materials,
      recentRequests: recentRequestsResult.rows,
      totalFound: summaryResult.rows.length
    });
  } catch (error) {
    console.error('Search material error:', error);
    res.status(500).json({ error: true, message: 'Failed to search materials' });
  }
}

// ===================================
// BY LOCATION (Same as before)
// ===================================
async function getByLocation(req, res) {
  try {
    const { from, to, location, discipline } = req.query;
    const params = [];
    let whereClause = '';
    let paramIndex = 1;

    const conditions = [];
    
    if (from && to) {
      conditions.push(`r.request_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(from, to);
      paramIndex += 2;
    }
    
    if (location) {
      if (location === 'Land Area' || location === 'LAR') {
        conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      } else if (location === 'Swamp Area' || location === 'SAR') {
        conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      } else if (location === 'PHC' || location === 'PHC POD') {
        conditions.push(`r.mrf_number LIKE 'PHC-%'`);
      } else {
        conditions.push(`r.asset ILIKE $${paramIndex}`);
        params.push(`%${location}%`);
        paramIndex++;
      }
    }
    
    if (discipline) {
      conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const result = await query(
      `SELECT 
        r.asset as location,
        COUNT(*) as request_count,
        SUM(l.quantity) as total_quantity,
        COUNT(DISTINCT l.material_description) as unique_materials,
        SUM(l.quantity * COALESCE(l.unit_price_usd, 0)) as total_value_usd
      FROM material_requests r
      LEFT JOIN material_request_lines l ON r.id = l.request_id
      ${whereClause}
      GROUP BY r.asset
      ORDER BY request_count DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get by location error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch location analytics' });
  }
}

// ===================================
// ✅ NEW: SPECIFIC LOCATION DEEP DIVE
// ===================================
async function getLocationDetail(req, res) {
  try {
    const { location } = req.params;
    const { from, to } = req.query;
    
    const params = [location];
    let paramIndex = 2;
    const conditions = [`r.asset ILIKE $1`];
    
    if (from && to) {
      conditions.push(`r.request_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(from, to);
      paramIndex += 2;
    }
    
    const whereClause = 'WHERE ' + conditions.join(' AND ');
    
    // Summary stats
    const summaryResult = await query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT l.material_description) as unique_materials,
        SUM(l.quantity) as total_quantity,
        SUM(l.quantity * COALESCE(l.unit_price_usd, 0)) as total_value_usd,
        SUM(l.quantity * COALESCE(l.unit_price_ngn, 0)) as total_value_ngn
       FROM material_requests r
       LEFT JOIN material_request_lines l ON r.id = l.request_id
       ${whereClause}`,
      params
    );
    
    // Top materials at this location
    const topMaterialsResult = await query(
      `SELECT 
        l.material_description,
        SUM(l.quantity) as total_quantity,
        l.quantity_unit,
        COUNT(DISTINCT r.id) as request_count
       FROM material_request_lines l
       JOIN material_requests r ON r.id = l.request_id
       ${whereClause}
       GROUP BY l.material_description, l.quantity_unit
       ORDER BY total_quantity DESC
       LIMIT 10`,
      params
    );
    
    // Requests by discipline
    const byDisciplineResult = await query(
      `SELECT 
        r.discipline,
        COUNT(*) as request_count
       FROM material_requests r
       ${whereClause}
       GROUP BY r.discipline
       ORDER BY request_count DESC`,
      params
    );
    
    // Monthly trend for this location
    const trendResult = await query(
      `SELECT 
        DATE_TRUNC('month', r.request_date) as month,
        COUNT(*) as request_count
       FROM material_requests r
       ${whereClause}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      params
    );
    
    res.json({
      success: true,
      location,
      summary: summaryResult.rows[0],
      topMaterials: topMaterialsResult.rows,
      byDiscipline: byDisciplineResult.rows,
      monthlyTrend: trendResult.rows
    });
  } catch (error) {
    console.error('Get location detail error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch location details' });
  }
}

// ===================================
// BY GROUP (Same as before)
// ===================================
async function getByGroup(req, res) {
  try {
    const { from, to, location, discipline } = req.query;
    const params = [];
    let whereClause = '';
    let paramIndex = 1;

    const conditions = [];
    
    if (from && to) {
      conditions.push(`r.request_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(from, to);
      paramIndex += 2;
    }
    
    if (location) {
      if (location === 'Land Area' || location === 'LAR') {
        conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      } else if (location === 'Swamp Area' || location === 'SAR') {
        conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      } else if (location === 'PHC' || location === 'PHC POD') {
        conditions.push(`r.mrf_number LIKE 'PHC-%'`);
      } else {
        conditions.push(`r.asset ILIKE $${paramIndex}`);
        params.push(`%${location}%`);
        paramIndex++;
      }
    }
    
    if (discipline) {
      conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const result = await query(
      `SELECT 
        r.discipline,
        COUNT(*) as request_count,
        SUM(l.quantity) as total_quantity,
        SUM(l.quantity * COALESCE(l.unit_price_usd, 0)) as total_value_usd
      FROM material_requests r
      LEFT JOIN material_request_lines l ON r.id = l.request_id
      ${whereClause}
      GROUP BY r.discipline
      ORDER BY request_count DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get by group error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch group analytics' });
  }
}

// ===================================
// BY VENDOR (Same as before)
// ===================================
async function getByVendor(req, res) {
  try {
    const { from, to, location, discipline } = req.query;
    const params = [];
    let whereClause = '';
    let paramIndex = 1;

    const conditions = [];
    
    if (from && to) {
      conditions.push(`r.request_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(from, to);
      paramIndex += 2;
    }
    
    if (location) {
      if (location === 'Land Area' || location === 'LAR') {
        conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      } else if (location === 'Swamp Area' || location === 'SAR') {
        conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      } else if (location === 'PHC' || location === 'PHC POD') {
        conditions.push(`r.mrf_number LIKE 'PHC-%'`);
      } else {
        conditions.push(`r.asset ILIKE $${paramIndex}`);
        params.push(`%${location}%`);
        paramIndex++;
      }
    }
    
    if (discipline) {
      conditions.push(`UPPER(r.discipline) = UPPER($${paramIndex})`);
      params.push(discipline);
      paramIndex++;
    }

    conditions.push(`r.vendor_name IS NOT NULL AND r.vendor_name != ''`);

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const result = await query(
      `SELECT 
        r.vendor_name,
        COUNT(*) as request_count,
        SUM(l.quantity) as total_quantity,
        SUM(COALESCE(r.quotation_amount_usd, 0)) as total_quoted_usd,
        SUM(COALESCE(r.quotation_amount_ngn, 0)) as total_quoted_ngn
      FROM material_requests r
      LEFT JOIN material_request_lines l ON r.id = l.request_id
      ${whereClause}
      GROUP BY r.vendor_name
      ORDER BY request_count DESC
      LIMIT 20`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get by vendor error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch vendor analytics' });
  }
}

module.exports = {
  getSummary,
  getTopMaterials,
  getTimeSeries,
  searchMaterial,
  getByLocation,
  getLocationDetail, // ✅ NEW
  getByGroup,
  getByVendor
};