// backend/controllers/inventoryController.js
// Warehouse and Inventory Management Controller

const { query, transaction } = require('../config/database');

// ==================== WAREHOUSES ====================

async function getWarehouses(req, res) {
  try {
    const result = await query(
      'SELECT * FROM warehouses WHERE is_active = true ORDER BY warehouse_code'
    );
    res.json({ success: true, warehouses: result.rows });
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch warehouses' });
  }
}

// ==================== WAREHOUSE RECEIPTS ====================

async function createReceipt(req, res) {
  try {
    const {
      warehouse_id,
      request_id,
      received_date,
      received_by,
      contractor_name,
      delivery_note_ref,
      invoice_ref,
      condition: receiptCondition,
      remarks,
      items
    } = req.body;

    if (!warehouse_id || !received_date || !received_by || !items || items.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'Warehouse, date, received by, and items are required'
      });
    }

    const user = req.user;

    const result = await transaction(async (client) => {
      // Generate receipt number
      const receiptCount = await client.query(
        'SELECT COUNT(*) as count FROM warehouse_receipts WHERE received_date >= CURRENT_DATE'
      );
      const count = parseInt(receiptCount.rows[0].count) + 1;
      const receiptNumber = `WR-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(count).padStart(4, '0')}`;

      // Insert receipt
      const receiptResult = await client.query(
        `INSERT INTO warehouse_receipts (
          receipt_number, request_id, warehouse_id, received_date,
          received_by, contractor_name, delivery_note_ref, invoice_ref,
          condition, remarks, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          receiptNumber, request_id || null, warehouse_id, received_date,
          received_by, contractor_name || null, delivery_note_ref || null,
          invoice_ref || null, receiptCondition || 'Good', remarks || null,
          user.id
        ]
      );

      const receipt = receiptResult.rows[0];

      // Insert receipt lines
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(
          `INSERT INTO warehouse_receipt_lines (
            receipt_id, line_no, material_description, oem_model, part_number,
            quantity_received, quantity_unit, condition, shelf_location, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            receipt.id, i + 1, item.material_description, item.oem_model || null,
            item.part_number || null, item.quantity_received, item.quantity_unit || 'pcs',
            item.condition || 'Good', item.shelf_location || null, item.remarks || null
          ]
        );
      }

      // Get full receipt with lines
      const fullReceipt = await client.query(
        `SELECT r.*, w.warehouse_name, w.warehouse_code
         FROM warehouse_receipts r
         JOIN warehouses w ON w.id = r.warehouse_id
         WHERE r.id = $1`,
        [receipt.id]
      );

      const lines = await client.query(
        'SELECT * FROM warehouse_receipt_lines WHERE receipt_id = $1 ORDER BY line_no',
        [receipt.id]
      );

      return {
        ...fullReceipt.rows[0],
        items: lines.rows
      };
    });

    res.json({ success: true, receipt: result });
  } catch (error) {
    console.error('Create receipt error:', error);
    res.status(500).json({ error: true, message: 'Failed to create receipt: ' + error.message });
  }
}

async function getReceipts(req, res) {
  try {
    const { page = 1, limit = 25, warehouse_id, from_date, to_date } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (warehouse_id) {
      conditions.push(`r.warehouse_id = $${paramIndex}`);
      params.push(warehouse_id);
      paramIndex++;
    }

    if (from_date) {
      conditions.push(`r.received_date >= $${paramIndex}`);
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      conditions.push(`r.received_date <= $${paramIndex}`);
      params.push(to_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const receiptsResult = await query(
      `SELECT r.*, w.warehouse_name, w.warehouse_code,
              COUNT(l.id) as item_count
       FROM warehouse_receipts r
       JOIN warehouses w ON w.id = r.warehouse_id
       LEFT JOIN warehouse_receipt_lines l ON l.receipt_id = r.id
       ${whereClause}
       GROUP BY r.id, w.warehouse_name, w.warehouse_code
       ORDER BY r.received_date DESC, r.id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(DISTINCT r.id) as total
       FROM warehouse_receipts r
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      receipts: receiptsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch receipts' });
  }
}

async function getReceiptById(req, res) {
  try {
    const { id } = req.params;

    const receiptResult = await query(
      `SELECT r.*, w.warehouse_name, w.warehouse_code
       FROM warehouse_receipts r
       JOIN warehouses w ON w.id = r.warehouse_id
       WHERE r.id = $1`,
      [id]
    );

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Receipt not found' });
    }

    const linesResult = await query(
      'SELECT * FROM warehouse_receipt_lines WHERE receipt_id = $1 ORDER BY line_no',
      [id]
    );

    res.json({
      success: true,
      receipt: {
        ...receiptResult.rows[0],
        items: linesResult.rows
      }
    });
  } catch (error) {
    console.error('Get receipt by id error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch receipt' });
  }
}

// ==================== WAREHOUSE DISBURSEMENTS ====================

async function createDisbursement(req, res) {
  try {
    const {
      warehouse_id,
      request_id,
      disbursed_date,
      disbursed_by,
      received_by,
      department,
      work_order_no,
      purpose,
      remarks,
      items
    } = req.body;

    if (!warehouse_id || !disbursed_date || !disbursed_by || !received_by || !items || items.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'Warehouse, date, disbursed by, received by, and items are required'
      });
    }

    const user = req.user;

    const result = await transaction(async (client) => {
      // Generate disbursement number
      const disbursementCount = await client.query(
        'SELECT COUNT(*) as count FROM warehouse_disbursements WHERE disbursed_date >= CURRENT_DATE'
      );
      const count = parseInt(disbursementCount.rows[0].count) + 1;
      const disbursementNumber = `WD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(count).padStart(4, '0')}`;

      // Insert disbursement
      const disbursementResult = await client.query(
        `INSERT INTO warehouse_disbursements (
          disbursement_number, request_id, warehouse_id, disbursed_date,
          disbursed_by, received_by, department, work_order_no,
          purpose, remarks, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          disbursementNumber, request_id || null, warehouse_id, disbursed_date,
          disbursed_by, received_by, department || null, work_order_no || null,
          purpose || null, remarks || null, user.id
        ]
      );

      const disbursement = disbursementResult.rows[0];

      // Insert disbursement lines and check stock
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check available stock
        const stockCheck = await client.query(
          `SELECT quantity_available FROM inventory_stock
           WHERE warehouse_id = $1
             AND material_description = $2
             AND COALESCE(oem_model, '') = COALESCE($3, '')
             AND COALESCE(part_number, '') = COALESCE($4, '')`,
          [warehouse_id, item.material_description, item.oem_model || null, item.part_number || null]
        );

        if (stockCheck.rows.length === 0 || parseFloat(stockCheck.rows[0].quantity_available) < parseFloat(item.quantity_disbursed)) {
          throw new Error(`Insufficient stock for ${item.material_description}`);
        }

        await client.query(
          `INSERT INTO warehouse_disbursement_lines (
            disbursement_id, line_no, material_description, oem_model, part_number,
            quantity_disbursed, quantity_unit, condition, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            disbursement.id, i + 1, item.material_description, item.oem_model || null,
            item.part_number || null, item.quantity_disbursed, item.quantity_unit || 'pcs',
            item.condition || 'Good', item.remarks || null
          ]
        );
      }

      // Get full disbursement with lines
      const fullDisbursement = await client.query(
        `SELECT d.*, w.warehouse_name, w.warehouse_code
         FROM warehouse_disbursements d
         JOIN warehouses w ON w.id = d.warehouse_id
         WHERE d.id = $1`,
        [disbursement.id]
      );

      const lines = await client.query(
        'SELECT * FROM warehouse_disbursement_lines WHERE disbursement_id = $1 ORDER BY line_no',
        [disbursement.id]
      );

      return {
        ...fullDisbursement.rows[0],
        items: lines.rows
      };
    });

    res.json({ success: true, disbursement: result });
  } catch (error) {
    console.error('Create disbursement error:', error);
    res.status(500).json({ error: true, message: 'Failed to create disbursement: ' + error.message });
  }
}

async function getDisbursements(req, res) {
  try {
    const { page = 1, limit = 25, warehouse_id, from_date, to_date } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (warehouse_id) {
      conditions.push(`d.warehouse_id = $${paramIndex}`);
      params.push(warehouse_id);
      paramIndex++;
    }

    if (from_date) {
      conditions.push(`d.disbursed_date >= $${paramIndex}`);
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      conditions.push(`d.disbursed_date <= $${paramIndex}`);
      params.push(to_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const disbursementsResult = await query(
      `SELECT d.*, w.warehouse_name, w.warehouse_code,
              COUNT(l.id) as item_count
       FROM warehouse_disbursements d
       JOIN warehouses w ON w.id = d.warehouse_id
       LEFT JOIN warehouse_disbursement_lines l ON l.disbursement_id = d.id
       ${whereClause}
       GROUP BY d.id, w.warehouse_name, w.warehouse_code
       ORDER BY d.disbursed_date DESC, d.id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(DISTINCT d.id) as total
       FROM warehouse_disbursements d
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      disbursements: disbursementsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get disbursements error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch disbursements' });
  }
}

async function getDisbursementById(req, res) {
  try {
    const { id } = req.params;

    const disbursementResult = await query(
      `SELECT d.*, w.warehouse_name, w.warehouse_code
       FROM warehouse_disbursements d
       JOIN warehouses w ON w.id = d.warehouse_id
       WHERE d.id = $1`,
      [id]
    );

    if (disbursementResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Disbursement not found' });
    }

    const linesResult = await query(
      'SELECT * FROM warehouse_disbursement_lines WHERE disbursement_id = $1 ORDER BY line_no',
      [id]
    );

    res.json({
      success: true,
      disbursement: {
        ...disbursementResult.rows[0],
        items: linesResult.rows
      }
    });
  } catch (error) {
    console.error('Get disbursement by id error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch disbursement' });
  }
}

// ==================== INVENTORY STOCK ====================

async function getInventoryStock(req, res) {
  try {
    const { warehouse_id, search, low_stock_only } = req.query;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (warehouse_id) {
      conditions.push(`s.warehouse_id = $${paramIndex}`);
      params.push(warehouse_id);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        s.material_description ILIKE $${paramIndex} OR
        s.oem_model ILIKE $${paramIndex} OR
        s.part_number ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (low_stock_only === 'true') {
      conditions.push(`s.quantity_available <= s.reorder_level AND s.reorder_level IS NOT NULL`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT s.*, w.warehouse_name, w.warehouse_code
       FROM inventory_stock s
       JOIN warehouses w ON w.id = s.warehouse_id
       ${whereClause}
       ORDER BY s.material_description, s.warehouse_id`,
      params
    );

    res.json({ success: true, stock: result.rows });
  } catch (error) {
    console.error('Get inventory stock error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch inventory stock' });
  }
}

async function updateStockItem(req, res) {
  try {
    const { id } = req.params;
    const { reorder_level, shelf_location, remarks } = req.body;

    const result = await query(
      `UPDATE inventory_stock
       SET reorder_level = $1, shelf_location = $2, remarks = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [reorder_level || null, shelf_location || null, remarks || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Stock item not found' });
    }

    res.json({ success: true, stock: result.rows[0] });
  } catch (error) {
    console.error('Update stock item error:', error);
    res.status(500).json({ error: true, message: 'Failed to update stock item' });
  }
}

// ==================== SURPLUS MATERIALS ====================

async function createSurplus(req, res) {
  try {
    const {
      warehouse_id,
      material_description,
      oem_model,
      part_number,
      quantity_surplus,
      quantity_unit,
      reason,
      reported_by,
      reported_date,
      disposition,
      remarks
    } = req.body;

    if (!warehouse_id || !material_description || !quantity_surplus || !reported_by) {
      return res.status(400).json({
        error: true,
        message: 'Warehouse, material description, quantity, and reported by are required'
      });
    }

    const result = await query(
      `INSERT INTO inventory_surplus (
        warehouse_id, material_description, oem_model, part_number,
        quantity_surplus, quantity_unit, reason, reported_by,
        reported_date, disposition, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        warehouse_id, material_description, oem_model || null, part_number || null,
        quantity_surplus, quantity_unit || 'pcs', reason || null, reported_by,
        reported_date || new Date().toISOString().split('T')[0], disposition || 'Available',
        remarks || null
      ]
    );

    res.json({ success: true, surplus: result.rows[0] });
  } catch (error) {
    console.error('Create surplus error:', error);
    res.status(500).json({ error: true, message: 'Failed to create surplus record' });
  }
}

async function getSurplus(req, res) {
  try {
    const { warehouse_id, disposition, search } = req.query;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (warehouse_id) {
      conditions.push(`s.warehouse_id = $${paramIndex}`);
      params.push(warehouse_id);
      paramIndex++;
    }

    if (disposition) {
      conditions.push(`s.disposition = $${paramIndex}`);
      params.push(disposition);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        s.material_description ILIKE $${paramIndex} OR
        s.oem_model ILIKE $${paramIndex} OR
        s.part_number ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT s.*, w.warehouse_name, w.warehouse_code
       FROM inventory_surplus s
       JOIN warehouses w ON w.id = s.warehouse_id
       ${whereClause}
       ORDER BY s.reported_date DESC, s.id DESC`,
      params
    );

    res.json({ success: true, surplus: result.rows });
  } catch (error) {
    console.error('Get surplus error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch surplus materials' });
  }
}

async function updateSurplus(req, res) {
  try {
    const { id } = req.params;
    const { disposition, remarks } = req.body;

    const result = await query(
      `UPDATE inventory_surplus
       SET disposition = $1, remarks = $2
       WHERE id = $3
       RETURNING *`,
      [disposition, remarks || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Surplus record not found' });
    }

    res.json({ success: true, surplus: result.rows[0] });
  } catch (error) {
    console.error('Update surplus error:', error);
    res.status(500).json({ error: true, message: 'Failed to update surplus record' });
  }
}

module.exports = {
  getWarehouses,
  createReceipt,
  getReceipts,
  getReceiptById,
  createDisbursement,
  getDisbursements,
  getDisbursementById,
  getInventoryStock,
  updateStockItem,
  createSurplus,
  getSurplus,
  updateSurplus
};

