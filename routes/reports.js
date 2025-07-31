const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

// Reports routes for Hostel Incharge
router.get('/download', auth, checkRole(['hostel-incharge']), reportController.generateReport);

module.exports = router;