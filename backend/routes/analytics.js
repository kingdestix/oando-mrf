// backend/routes/analytics.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getSummary,
  getTopMaterials,
  getTimeSeries,
  searchMaterial,
  getByLocation,
  getLocationDetail,
  getByGroup,
  getByVendor
} = require('../controllers/analyticsController');

router.use(authenticate);
router.use(requireAdmin);

router.get('/summary', getSummary);
router.get('/top-materials', getTopMaterials);
router.get('/timeseries', getTimeSeries);
router.get('/search', searchMaterial);
router.get('/by-location', getByLocation);
router.get('/by-group', getByGroup);
router.get('/by-vendor', getByVendor);
router.get('/location/:location', getLocationDetail);

module.exports = router;