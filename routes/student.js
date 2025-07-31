const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

// Student routes
router.get('/dashboard', auth, checkRole(['student']), studentController.getStudentDashboard);
router.post('/submit-request', auth, checkRole(['student']), studentController.submitOutingRequest);

// Hostel Incharge student management routes
router.get('/blocks', auth, checkRole(['hostel-incharge']), studentController.getStudentsByBlocks);
router.put('/:studentId', auth, checkRole(['hostel-incharge']), studentController.updateStudentDetails);
router.delete('/:studentId', auth, checkRole(['hostel-incharge']), studentController.deleteStudent);

module.exports = router;
