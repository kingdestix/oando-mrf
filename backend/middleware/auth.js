// backend/middleware/auth.js
// Authentication and Authorization Middleware

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: true, 
        message: 'No token provided' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await query(
      'SELECT id, user_id, first_name, last_name, email, role, designation, location FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: true, 
        message: 'User not found or inactive' 
      });
    }

    // Attach user to request
    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: true, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: true, 
        message: 'Token expired' 
      });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: true, 
      message: 'Authentication failed' 
    });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: true, 
      message: 'Access denied. Admin role required.' 
    });
  }
  next();
};

// Check if user is worker or admin
const requireWorkerOrAdmin = (req, res, next) => {
  if (!['worker', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: true, 
      message: 'Access denied' 
    });
  }
  next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const result = await query(
        'SELECT id, user_id, first_name, last_name, email, role FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      
      if (result.rows.length > 0) {
        req.user = result.rows[0];
      }
    }
    next();
  } catch (error) {
    // Continue without user if authentication fails
    next();
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requireWorkerOrAdmin,
  optionalAuth
};