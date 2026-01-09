// backend/controllers/profileController.js
// User Profile Management Controller

const { query, transaction } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Configure multer for signature uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/signatures');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const user = req.user;
    const ext = path.extname(file.originalname);
    const filename = `signature_${user.id}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
}).single('signature');

// ===================================
// UPLOAD SIGNATURE
// ===================================
async function uploadSignature(req, res) {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: true, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }

    try {
      const user = req.user;
      const signaturePath = `/uploads/signatures/${req.file.filename}`;

      // Delete old signature if exists
      const userResult = await query(
        'SELECT signature_path FROM users WHERE id = $1',
        [user.id]
      );

      if (userResult.rows[0] && userResult.rows[0].signature_path) {
        const oldPath = path.join(__dirname, '..', userResult.rows[0].signature_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Update user signature path based on role
      const roleSignatureFields = {
        'technical_coordinator': 'technical_coordinator_signature',
        'assistant_manager': 'assistant_manager_signature',
        'area_manager_land': 'area_manager_signature',
        'area_manager_swamp': 'area_manager_signature',
        'area_manager_phc': 'area_manager_signature',
        'pod_planner': 'pod_planner_signature',
        'discipline_unit': 'discipline_unit_signature',
        'discipline_manager': 'discipline_manager_signature',
        'dodm': 'commercial_approver_signature'
      };

      // Also store in a general signature_path field for easy access
      await query(
        `UPDATE users 
         SET signature_path = $1,
             ${roleSignatureFields[user.role] ? `${roleSignatureFields[user.role]} = $1,` : ''}
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [signaturePath, user.id]
      );

      res.json({
        success: true,
        message: 'Signature uploaded successfully',
        signature_path: signaturePath
      });
    } catch (error) {
      console.error('Upload signature error:', error);
      
      // Delete uploaded file on error
      if (req.file) {
        const filePath = path.join(__dirname, '../uploads/signatures', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      res.status(500).json({ error: true, message: 'Failed to upload signature: ' + error.message });
    }
  });
}

// ===================================
// REMOVE SIGNATURE
// ===================================
async function removeSignature(req, res) {
  try {
    const user = req.user;

    // Get current signature path
    const userResult = await query(
      'SELECT signature_path FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rows[0] && userResult.rows[0].signature_path) {
      const signaturePath = userResult.rows[0].signature_path;
      const filePath = path.join(__dirname, '..', signaturePath);
      
      // Delete file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update user - remove signature path based on role
    const roleSignatureFields = {
      'technical_coordinator': 'technical_coordinator_signature',
      'assistant_manager': 'assistant_manager_signature',
      'area_manager_land': 'area_manager_signature',
      'area_manager_swamp': 'area_manager_signature',
      'area_manager_phc': 'area_manager_signature',
      'pod_planner': 'pod_planner_signature',
      'discipline_unit': 'discipline_unit_signature',
      'discipline_manager': 'discipline_manager_signature',
      'dodm': 'commercial_approver_signature'
    };

    await query(
      `UPDATE users 
       SET signature_path = NULL,
           ${roleSignatureFields[user.role] ? `${roleSignatureFields[user.role]} = NULL,` : ''}
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    res.json({
      success: true,
      message: 'Signature removed successfully'
    });
  } catch (error) {
    console.error('Remove signature error:', error);
    res.status(500).json({ error: true, message: 'Failed to remove signature: ' + error.message });
  }
}

// ===================================
// CHANGE PASSWORD
// ===================================
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    const user = req.user;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: true, message: 'Current password and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: true, message: 'New password must be at least 8 characters long' });
    }

    // Verify current password
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    const isValid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(400).json({ error: true, message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: true, message: 'Failed to change password: ' + error.message });
  }
}

module.exports = {
  uploadSignature,
  removeSignature,
  changePassword
};

