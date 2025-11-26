// Authentication Controller
// TODO: Implement authentication logic (login, register, etc.)

// backend/controllers/authController.js
// Authentication Controller - Login, Register, Profile Management

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { validateUser, isValidEmail } = require('../utils/validation');

/**
 * Register new user
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { user_id, first_name, last_name, email, password, role, designation, office_extension, location } = req.body;

    // Validate input
    const validation = validateUser({ user_id, first_name, last_name, email, password, role });
    if (!validation.valid) {
      return res.status(400).json({
        error: true,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE user_id = $1 OR email = $2',
      [user_id, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: true,
        message: 'User ID or email already exists'
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await query(
      `INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, office_extension, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id, first_name, last_name, email, role, designation, location`,
      [user_id, first_name, last_name, email, password_hash, role, designation, office_extension, location]
    );

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'USER_REGISTERED', `New ${role} registered: ${user_id}`]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: true,
      message: 'Registration failed'
    });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: true,
        message: 'Email and password are required'
      });
    }

    // Get user by email
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
      [user.id, 'USER_LOGIN', req.ip]
    );

    // Return user data (without password)
    const { password_hash, ...userData } = user;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: true,
      message: 'Login failed'
    });
  }
}

/**
 * Get current user profile
 * GET /api/auth/profile
 */
async function getProfile(req, res) {
  try {
    const result = await query(
      `SELECT id, user_id, first_name, last_name, email, role, designation, 
              office_extension, location, created_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: true,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch profile'
    });
  }
}

/**
 * Update user profile
 * PUT /api/auth/profile
 */
async function updateProfile(req, res) {
  try {
    const { first_name, last_name, designation, office_extension, location } = req.body;

    const result = await query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           designation = COALESCE($3, designation),
           office_extension = COALESCE($4, office_extension),
           location = COALESCE($5, location),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, user_id, first_name, last_name, email, role, designation, office_extension, location`,
      [first_name, last_name, designation, office_extension, location, req.user.id]
    );

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'PROFILE_UPDATED', 'User updated profile information']
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update profile'
    });
  }
}

/**
 * Change password
 * PUT /api/auth/change-password
 */
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: true,
        message: 'Current and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        error: true,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get current user with password
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: true,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const new_password_hash = await bcrypt.hash(new_password, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [new_password_hash, req.user.id]
    );

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)',
      [req.user.id, 'PASSWORD_CHANGED']
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to change password'
    });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};


