// backend/routes/inventory.js
// Warehouse and Inventory Management Routes

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getWarehouses,
  createReceipt,
  getReceipts,
  getReceiptById,
  createDisbursement,
  getDisbursements,
  getDisbursementById,
  getInventoryStock,
  updateStockItem,
  createSurplus,
  getSurplus,
  updateSurplus
} = require('../controllers/inventoryController');

// All routes require authentication
router.use(authenticate);
router.use(requireAdmin);

// Warehouses
router.get('/warehouses', getWarehouses);

// Receipts
router.post('/receipts', createReceipt);
router.get('/receipts', getReceipts);
router.get('/receipts/:id', getReceiptById);

// Disbursements
router.post('/disbursements', createDisbursement);
router.get('/disbursements', getDisbursements);
router.get('/disbursements/:id', getDisbursementById);

// Inventory Stock
router.get('/stock', getInventoryStock);
router.put('/stock/:id', updateStockItem);

// Surplus Materials
router.post('/surplus', createSurplus);
router.get('/surplus', getSurplus);
router.put('/surplus/:id', updateSurplus);

module.exports = router;





