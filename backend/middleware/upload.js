// backend/middleware/upload.js
// File Upload Middleware using Multer

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const attachmentsDir = path.join(uploadsDir, 'attachments');
const importsDir = path.join(uploadsDir, 'imports');

[uploadsDir, attachmentsDir, importsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for attachments (images/PDFs)
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  }
});

// Storage configuration for imports (Excel/CSV)
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, importsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `import-${sanitizedName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for attachments (images and PDFs only)
const attachmentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, GIF, and PDF files are allowed.'), false);
  }
};

// File filter for imports (Excel and CSV only)
const importFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv'
  ];
  
  const allowedExts = ['.xls', '.xlsx', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel (.xls, .xlsx) and CSV files are allowed.'), false);
  }
};

// Multer upload instances
const attachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

const importUpload = multer({
  storage: importStorage,
  fileFilter: importFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for imports
  }
});

// Error handler for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: true,
        message: 'File too large. Maximum size is 5MB for attachments and 10MB for imports.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: true,
        message: 'Unexpected field name. Please check your form data.'
      });
    }
    return res.status(400).json({
      error: true,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    // Other errors (like file filter errors)
    return res.status(400).json({
      error: true,
      message: err.message
    });
  }
  next();
};

module.exports = {
  attachmentUpload,
  importUpload,
  handleMulterError,
  uploadsDir,
  attachmentsDir,
  importsDir
};