// backend/routes/analytics.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getSummary,
  getTopMaterials,
  getTimeSeries,
  searchMaterial,
  getByLocation,
  getLocationDetail,
  getByGroup,
  getByVendor,
  exportAnalytics
} = require('../controllers/analyticsController');

// Allow admin and pod_planner to access analytics
router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'pod_planner') {
    next();
  } else {
    res.status(403).json({ error: true, message: 'Access denied. Admin or POD Planner role required.' });
  }
});

router.get('/summary', getSummary);
router.get('/top-materials', getTopMaterials);
router.get('/timeseries', getTimeSeries);
router.get('/search', searchMaterial);
router.get('/by-location', getByLocation);
router.get('/by-group', getByGroup);
router.get('/by-vendor', getByVendor);
router.get('/location/:location', getLocationDetail);
router.post('/export', exportAnalytics); // Changed to POST to handle large chart images

module.exports = router;