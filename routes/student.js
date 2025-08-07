const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const studentController = require('../controllers/studentController');
const { generatePastOutingsPDF } = require('../services/pdfService');

// Student routes
router.get('/dashboard', auth, checkRole(['student']), studentController.getStudentDashboard);
router.post('/submit-request', auth, checkRole(['student']), studentController.submitOutingRequest);

// Download past outings PDF
router.get('/past-outings/pdf', auth, checkRole(['student']), async (req, res) => {
  try {
    console.log('📄 Generating PDF for student past outings...');
    console.log('👤 Student ID:', req.user.id);
    console.log('👤 Student Name:', req.user.name);

    const OutingRequest = require('../models/OutingRequest');
    
    // Get all approved outings for the current student
    const pastOutings = await OutingRequest.find({
      studentId: req.user.id,
      status: 'approved'
    })
    .populate('studentId', 'name rollNumber hostelBlock floor roomNumber phoneNumber')
    .sort({ createdAt: -1 });

    console.log('📋 Found approved outings:', pastOutings.length);

    // Filter to only completed outings (both QR codes used)
    const completedOutings = pastOutings.filter(request => {
      const requestData = request.toObject();
      const outgoingExpired = requestData.qrCode?.outgoing?.isExpired || false;
      const incomingExpired = requestData.qrCode?.incoming?.isExpired || false;
      const hasOutgoingQR = requestData.qrCode?.outgoing?.data && !outgoingExpired;
      const hasIncomingQR = requestData.qrCode?.incoming?.data && !incomingExpired;
      const hasAnyQR = hasOutgoingQR || hasIncomingQR;
      const isFullyApproved = request.status === 'approved' && request.currentLevel === 'completed';
      
      const isCompleted = isFullyApproved && !hasAnyQR;
      console.log(`Outing ${request._id}: isCompleted = ${isCompleted}, hasAnyQR = ${hasAnyQR}, isFullyApproved = ${isFullyApproved}`);
      
      return isCompleted;
    });

    console.log('✅ Completed outings:', completedOutings.length);

    const pdfContent = await generatePastOutingsPDF({
      outings: completedOutings,
      studentName: req.user.name,
      studentRollNumber: req.user.rollNumber,
      currentUser: req.user.email
    });

    console.log('📄 PDF generated successfully, size:', pdfContent.length);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=past_outings_${req.user.rollNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
    res.send(pdfContent);

  } catch (error) {
    console.error('PDF generation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Hostel Incharge student management routes
router.get('/blocks', auth, checkRole(['hostel-incharge']), studentController.getStudentsByBlocks);
router.put('/:studentId', auth, checkRole(['hostel-incharge']), studentController.updateStudentDetails);
router.delete('/:studentId', auth, checkRole(['hostel-incharge']), studentController.deleteStudent);

module.exports = router;
