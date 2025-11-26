// backend/controllers/adminController.js
const bcrypt = require('bcrypt');
const { query } = require('../config/database');


// Get all users
async function getUsers(req, res) {
  try {
    const { role, is_active } = req.query;
    
    let sql = 'SELECT id, user_id, first_name, last_name, email, role, designation, department, location, office_extension, is_active, created_at FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (role) {
      sql += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    
    if (is_active !== undefined) {
      sql += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch users' });
  }
}

// Create new user
async function createUser(req, res) {
  try {
    const { user_id, first_name, last_name, email, password, role, designation, department, location, office_extension } = req.body;
    
    // Validate required fields
    if (!user_id || !first_name || !last_name || !email || !password || !role) {
      return res.status(400).json({ error: true, message: 'Missing required fields' });
    }
    
    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE user_id = $1 OR email = $2', [user_id, email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: true, message: 'User ID or email already exists' });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await query(
      `INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, department, location, office_extension)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, first_name, last_name, email, role, designation, department, location, is_active`,
      [user_id, first_name, last_name, email, password_hash, role, designation, department, location, office_extension]
    );
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'USER_CREATED', `Created user: ${user_id}`]
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: true, message: 'Failed to create user' });
  }
}

// Update user
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, designation, department, location, office_extension } = req.body;
    
    const result = await query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           role = COALESCE($3, role),
           designation = COALESCE($4, designation),
           department = COALESCE($5, department),
           location = COALESCE($6, location),
           office_extension = COALESCE($7, office_extension),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, user_id, first_name, last_name, email, role, designation, department, location, is_active`,
      [first_name, last_name, role, designation, department, location, office_extension, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'USER_UPDATED', `Updated user ID: ${id}`]
    );
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: true, message: 'Failed to update user' });
  }
}

// Update user status (activate/deactivate)
async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    const result = await query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING user_id',
      [is_active, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'USER_STATUS_CHANGED', `User ${result.rows[0].user_id} ${is_active ? 'activated' : 'deactivated'}`]
    );
    
    res.json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: true, message: 'Failed to update user status' });
  }
}

// Reset user password
async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: true, message: 'Password must be at least 6 characters' });
    }
    
    const password_hash = await bcrypt.hash(password, 10);
    
    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING user_id',
      [password_hash, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'PASSWORD_RESET', `Reset password for user: ${result.rows[0].user_id}`]
    );
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: true, message: 'Failed to reset password' });
  }
}

// Get activity logs
async function getActivityLogs(req, res) {
  try {
    const { limit = 100, user_id, action } = req.query;
    
    let sql = `
      SELECT al.*, u.user_id, u.first_name, u.last_name, u.email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (user_id) {
      sql += ` AND al.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }
    
    if (action) {
      sql += ` AND al.action LIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }
    
    sql += ` ORDER BY al.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      logs: result.rows
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch activity logs' });
  }
}

// Get dashboard statistics
async function getDashboardStats(req, res) {
  try {
    const [usersResult, requestsResult, recentResult] = await Promise.all([
      query('SELECT role, COUNT(*) as count FROM users WHERE is_active = true GROUP BY role'),
      query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(CASE WHEN DATE(request_date) = CURRENT_DATE THEN 1 ELSE 0 END) as today_count
        FROM material_requests
        GROUP BY status
      `),
      query(`
        SELECT 
          r.id,
          r.mrf_number,
          r.request_date,
          r.first_name || ' ' || r.last_name as requester,
          r.status,
          r.criticality
        FROM material_requests r
        ORDER BY r.created_at DESC
        LIMIT 10
      `)
    ]);
    
    res.json({
      success: true,
      stats: {
        users: usersResult.rows,
        requests: requestsResult.rows,
        recentRequests: recentResult.rows
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch statistics' });
  }
}

// ✅ NEW: Delete all material requests data
async function deleteAllData(req, res) {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({ 
        error: true, 
        message: 'Confirmation text must be "DELETE_ALL_DATA"' 
      });
    }
    
    // Delete in correct order (child tables first)
    await query('DELETE FROM attachments');
    await query('DELETE FROM material_request_lines');
    await query('DELETE FROM material_requests');
    await query('DELETE FROM import_jobs');
    
    // Reset sequences
    await query("SELECT setval('material_requests_id_seq', 1, false)");
    await query("SELECT setval('material_request_lines_id_seq', 1, false)");
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'DATA_DELETED', 'All material request data deleted']
    );
    
    res.json({
      success: true,
      message: 'All material request data has been deleted successfully'
    });
  } catch (error) {
    console.error('Delete all data error:', error);
    res.status(500).json({ error: true, message: 'Failed to delete data' });
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  getActivityLogs,
  getDashboardStats,
  deleteAllData  // ✅ NEW
};