// backend/server.js
// FIXED: Proper rate limiting configuration to prevent 429 errors

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const analyticsRoutes = require('./routes/analytics');
const importRoutes = require('./routes/imports');  // ✅ FIXED: imports not import
const exportRoutes = require('./routes/exports');  // ✅ FIXED: exports not export
const inventoryRoutes = require('./routes/inventory');
const quotationRoutes = require('./routes/quotations');

const app = express();
const PORT = process.env.PORT || 5000;
const approvalRoutes = require('./routes/approval');

app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ✅ FIXED: More generous rate limiting for analytics (prevents 429 errors)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute (was too low before)
  message: { error: true, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting only to non-analytics routes
app.use('/api/auth', apiLimiter);
app.use('/api/requests', apiLimiter);
app.use('/api/imports', apiLimiter);
app.use('/api/exports', apiLimiter);
app.use('/api/inventory', apiLimiter);
app.use('/api/quotations', apiLimiter);

// ✅ Analytics gets MORE generous limit
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute for analytics
  message: { error: true, message: 'Too many analytics requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/analytics', analyticsLimiter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/approval', approvalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Oando MRF API is running',
    timestamp: new Date().toISOString()
  });
});

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    error: true,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});



// Start server
app.listen(PORT, async () => {
  console.log('==========================================');
  console.log('  Oando Material Request Form System');
  console.log('==========================================');
  console.log(`  Server: http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  
  // Verify email configuration
  const { verifyEmailConfig } = require('./utils/email');
  await verifyEmailConfig();
  
  console.log('==========================================');
});

module.exports = app;