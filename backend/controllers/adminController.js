// backend/controllers/adminController.js
const bcrypt = require('bcrypt');
const { query } = require('../config/database');


// Get all users
async function getUsers(req, res) {
  try {
    const { role, is_active } = req.query;
    
    let sql = `SELECT id, user_id, first_name, last_name, email, role, designation, department, location, 
               office_extension, is_active, created_at, discipline_assignment, area_assignment, location_assignment 
               FROM users WHERE 1=1`;
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
    res.status(500).json({ error: true, message: 'Failed to fetch users: ' + error.message });
  }
}

// Create new user
async function createUser(req, res) {
  try {
    const { user_id, first_name, last_name, email, password, role, designation, department, location, office_extension, discipline_assignment, area_assignment, location_assignment } = req.body;
    
    // Validate required fields (role is optional, defaults to 'worker')
    if (!user_id || !first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: true, message: 'Missing required fields: user_id, first_name, last_name, email, and password are required' });
    }
    
    // Default role to 'worker' if not provided
    const userRole = role || 'worker';
    
    // Validate discipline assignment for discipline roles
    if ((userRole === 'discipline_unit' || userRole === 'discipline_manager') && !discipline_assignment) {
      return res.status(400).json({ error: true, message: 'Discipline assignment is required for discipline_unit and discipline_manager roles' });
    }
    
    // Check if user already exists (only check non-empty values)
    const existingConditions = [];
    const existingParams = [];
    let existingParamIndex = 1;
    
    if (user_id && user_id.trim()) {
      existingConditions.push(`user_id = $${existingParamIndex}`);
      existingParams.push(user_id.trim());
      existingParamIndex++;
    }
    
    if (email && email.trim()) {
      existingConditions.push(`email = $${existingParamIndex}`);
      existingParams.push(email.trim().toLowerCase());
      existingParamIndex++;
    }
    
    if (existingConditions.length > 0) {
      const existing = await query(
        `SELECT id, user_id, email FROM users WHERE ${existingConditions.join(' OR ')}`,
        existingParams
      );
      
      if (existing.rows.length > 0) {
        const existingUser = existing.rows[0];
        let conflictField = '';
        if (existingUser.user_id === user_id) conflictField = 'User ID';
        if (existingUser.email === email.toLowerCase()) conflictField = conflictField ? 'User ID and Email' : 'Email';
        return res.status(409).json({ 
          error: true, 
          message: `${conflictField} already exists. Please use a different ${conflictField.toLowerCase()}.` 
        });
      }
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Build INSERT query with optional fields
    const insertFields = ['user_id', 'first_name', 'last_name', 'email', 'password_hash', 'role', 'designation', 'department', 'location', 'office_extension'];
    const insertValues = [user_id, first_name, last_name, email, password_hash, userRole, designation || null, department || null, location || null, office_extension || null];
    let paramIndex = insertFields.length + 1;
    
    if (discipline_assignment) {
      insertFields.push('discipline_assignment');
      insertValues.push(discipline_assignment);
      paramIndex++;
    }
    
    if (area_assignment) {
      insertFields.push('area_assignment');
      insertValues.push(area_assignment);
      paramIndex++;
    }
    
    if (location_assignment) {
      insertFields.push('location_assignment');
      insertValues.push(location_assignment);
      paramIndex++;
    }
    
    const placeholders = insertFields.map((_, i) => `$${i + 1}`).join(', ');
    
    // Insert user
    const result = await query(
      `INSERT INTO users (${insertFields.join(', ')})
       VALUES (${placeholders})
       RETURNING id, user_id, first_name, last_name, email, role, designation, department, location, office_extension, discipline_assignment, area_assignment, location_assignment, is_active`,
      insertValues
    );
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'USER_CREATED', `Created user: ${user_id} with role: ${userRole}`]
    ).catch(err => console.error('Failed to log activity:', err));
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: true, message: 'Failed to create user: ' + error.message });
  }
}

// Update user
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, designation, department, location, office_extension, discipline_assignment, area_assignment, location_assignment } = req.body;
    
    // Build UPDATE query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(first_name);
      paramIndex++;
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(last_name);
      paramIndex++;
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }
    if (designation !== undefined) {
      updates.push(`designation = $${paramIndex}`);
      values.push(designation);
      paramIndex++;
    }
    if (department !== undefined) {
      updates.push(`department = $${paramIndex}`);
      values.push(department);
      paramIndex++;
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex}`);
      values.push(location);
      paramIndex++;
    }
    if (office_extension !== undefined) {
      updates.push(`office_extension = $${paramIndex}`);
      values.push(office_extension);
      paramIndex++;
    }
    if (discipline_assignment !== undefined) {
      updates.push(`discipline_assignment = $${paramIndex}`);
      values.push(discipline_assignment || null);
      paramIndex++;
    }
    if (area_assignment !== undefined) {
      updates.push(`area_assignment = $${paramIndex}`);
      values.push(area_assignment || null);
      paramIndex++;
    }
    if (location_assignment !== undefined) {
      updates.push(`location_assignment = $${paramIndex}`);
      values.push(location_assignment || null);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: true, message: 'No fields to update' });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id); // Add id as last parameter
    
    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id, first_name, last_name, email, role, designation, department, location, office_extension, discipline_assignment, area_assignment, location_assignment, is_active`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }
    
    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'USER_UPDATED', `Updated user ID: ${id}`]
    ).catch(err => console.error('Failed to log activity:', err));
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: true, message: 'Failed to update user: ' + error.message });
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