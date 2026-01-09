// backend/utils/validation.js
const { query } = require('../config/database');

function validateRequest(data) {
  const errors = [];

  if (!data.first_name || data.first_name.trim() === '') {
    errors.push('First name is required');
  }
  if (!data.last_name || data.last_name.trim() === '') {
    errors.push('Last name is required');
  }
  if (!data.user_code || data.user_code.trim() === '') {
    errors.push('User ID is required');
  }
  if (!data.designation || data.designation.trim() === '') {
    errors.push('Designation is required');
  }
  if (!data.location || data.location.trim() === '') {
    errors.push('Location is required');
  }
  if (!data.material_group && !data.discipline) {
    errors.push('Material group/discipline is required');
  }
  if (!data.reason || data.reason.trim() === '') {
    errors.push('Reason for request is required');
  }

  const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
  if (data.priority && !validPriorities.includes(data.priority)) {
    errors.push('Invalid priority value');
  }
  if (data.criticality && !validPriorities.includes(data.criticality)) {
    errors.push('Invalid criticality value');
  }

  if (!data.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
    errors.push('At least one material line item is required');
  } else {
    data.lines.forEach((line, index) => {
      if (!line.material_description || line.material_description.trim() === '') {
        errors.push(`Line ${index + 1}: Material description is required`);
      }
      if (!line.quantity || line.quantity <= 0) {
        errors.push(`Line ${index + 1}: Quantity must be greater than 0`);
      }
      if (isNaN(parseFloat(line.quantity))) {
        errors.push(`Line ${index + 1}: Invalid quantity value`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateUser(data) {
  const errors = [];

  if (!data.user_id || data.user_id.trim() === '') {
    errors.push('User ID is required');
  }
  if (!data.first_name || data.first_name.trim() === '') {
    errors.push('First name is required');
  }
  if (!data.last_name || data.last_name.trim() === '') {
    errors.push('Last name is required');
  }
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid email is required');
  }
  if (!data.password || data.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  const validRoles = ['worker', 'admin'];
  if (!data.role || !validRoles.includes(data.role)) {
    errors.push('Invalid role');
  }

  return { valid: errors.length === 0, errors };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '').substring(0, 1000);
}

function isValidDate(dateStr) {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

module.exports = {
  validateRequest,
  validateUser,
  isValidEmail,
  sanitizeString,
  isValidDate
};
