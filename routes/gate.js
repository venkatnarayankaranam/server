const express = require('express');
const router = express.Router();
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');
const { auth, checkRole } = require('../middleware/auth');

// Gate Dashboard - Get current activity and statistics
router.get('/dashboard', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get today's gate activity
    const todayActivity = await OutingRequest.find({
      'gateActivity.scannedAt': {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
    .populate('studentId', 'name rollNumber hostelBlock floor roomNumber phoneNumber')
    .sort({ 'gateActivity.scannedAt': -1 });

    // Flatten gate activity for easier display
    const activityLog = [];
    todayActivity.forEach(request => {
      request.gateActivity.forEach(activity => {
        if (activity.scannedAt >= startOfDay && activity.scannedAt <= endOfDay) {
          activityLog.push({
            id: `${request._id}_${activity._id}`,
            student: request.studentId,
            type: activity.type,
            scannedAt: activity.scannedAt,
            location: activity.location,
            purpose: request.purpose,
            remarks: activity.remarks,
            qrType: activity.qrType
          });
        }
      });
    });

    // Sort by scan time (most recent first)
    activityLog.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));

    // Get statistics
    const stats = {
      totalOutToday: activityLog.filter(a => a.type === 'OUT').length,
      totalInToday: activityLog.filter(a => a.type === 'IN').length,
      currentlyOut: 0, // Students who went out but haven't returned today
      pendingReturn: 0, // Students who should have returned by now
    };

    // Calculate currently out students
    const studentExitMap = new Map();
    activityLog.forEach(activity => {
      const studentId = activity.student._id.toString();
      if (activity.type === 'OUT') {
        studentExitMap.set(studentId, true);
      } else if (activity.type === 'IN') {
        studentExitMap.delete(studentId);
      }
    });
    stats.currentlyOut = studentExitMap.size;

    // Get pending returns (students who should have returned by now)
    const now = new Date();
    const pendingReturns = await OutingRequest.find({
      outingDate: today.toISOString().split('T')[0],
      status: 'approved',
      'qrCode.outgoing.isExpired': true,
      'qrCode.incoming.isExpired': false,
      $expr: {
        $lt: [
          { $dateFromString: { dateString: { $concat: ['$outingDate', 'T', '$returnTime'] } } },
          now
        ]
      }
    });
    stats.pendingReturn = pendingReturns.length;

    res.json({
      success: true,
      data: {
        activityLog,
        stats,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Gate dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gate dashboard data',
      error: error.message
    });
  }
});

// Scan QR Code
router.post('/scan', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    const { qrData, location = 'Main Gate' } = req.body;
    console.log('Scan request received:', { qrData, location });

    if (!qrData) {
      console.log('No QR data provided');
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    let qrId;
    let parsedQR = null;

    // Handle both JSON format and simple QR ID format (same logic as validation)
    if (qrData.startsWith('{')) {
      // JSON format
      try {
        parsedQR = JSON.parse(qrData);
        qrId = parsedQR.qrId;
        console.log('Parsed JSON QR:', { qrId });
      } catch (error) {
        console.log('JSON parse error:', error.message);
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code JSON format'
        });
      }
    } else {
      // Simple QR ID format (e.g., "OUT_123456_789012" or "IN_123456_789012")
      qrId = qrData.trim();
      console.log('Simple QR ID:', qrId);
    }

    if (!qrId) {
      console.log('No QR ID found');
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code - missing QR ID'
      });
    }

    // Find the request by QR ID
    const request = await OutingRequest.findByQRId(qrId);
    console.log('Request found for scan:', request ? 'Yes' : 'No');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found or invalid'
      });
    }

    // Check if scanQR method exists
    if (typeof request.scanQR !== 'function') {
      console.error('scanQR method not found on request object');
      return res.status(500).json({
        success: false,
        message: 'Server error: scan method not available'
      });
    }

    // Scan the QR code
    console.log('Attempting to scan QR:', { qrId, userId: req.user.id, location });
    const scanResult = await request.scanQR(qrId, req.user.id, location);
    console.log('Scan result:', scanResult);

    res.json({
      success: true,
      data: {
        ...scanResult,
        request: {
          id: request._id,
          purpose: request.purpose,
          outingDate: request.outingDate,
          outingTime: request.outingTime,
          returnTime: request.returnTime
        }
      }
    });

  } catch (error) {
    console.error('QR scan error:', error);
    console.error('QR scan error stack:', error.stack);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to scan QR code'
    });
  }
});

// Get QR Code Details (for preview before scanning)
router.post('/qr/validate', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    let qrId;
    let parsedQR = null;

    // Handle both JSON format and simple QR ID format
    if (qrData.startsWith('{')) {
      // JSON format
      try {
        parsedQR = JSON.parse(qrData);
        qrId = parsedQR.qrId;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code JSON format'
        });
      }
    } else {
      // Simple QR ID format (e.g., "OUT_123456_789012" or "IN_123456_789012")
      qrId = qrData.trim();
    }

    if (!qrId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code - missing QR ID'
      });
    }

    // Find the request by QR ID
    const request = await OutingRequest.findByQRId(qrId);
    console.log('Found request:', request ? 'Yes' : 'No');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found or invalid'
      });
    }

    console.log('Request found:', {
      id: request._id,
      hasStudentId: !!request.studentId,
      studentType: typeof request.studentId
    });

    // Check if studentId is populated
    if (!request.studentId) {
      console.error('Student not found for request:', request._id);
      return res.status(404).json({
        success: false,
        message: 'Student data not found for this request'
      });
    }

    // Determine QR type
    let type = 'UNKNOWN';
    let qrDetails = null;
    
    if (request.qrCode.outgoing?.qrId === qrId) {
      type = 'OUTGOING';
      qrDetails = request.qrCode.outgoing;
    } else if (request.qrCode.incoming?.qrId === qrId) {
      type = 'INCOMING';
      qrDetails = request.qrCode.incoming;
    }

    console.log('QR Type determined:', type, 'Details:', qrDetails ? 'Found' : 'Not found');

    // Check if QR is expired or already used
    let qrStatus = 'valid';
    if (qrDetails) {
      if (qrDetails.isExpired) {
        qrStatus = 'expired';
      } else if (new Date() > qrDetails.validUntil) {
        qrStatus = 'time_expired';
      }
    }

    // Prepare student and outing data
    const student = {
      _id: request.studentId._id,
      name: request.studentId.name,
      rollNumber: request.studentId.rollNumber,
      hostelBlock: request.studentId.hostelBlock,
      floor: request.studentId.floor,
      roomNumber: request.studentId.roomNumber,
      phoneNumber: request.studentId.phoneNumber
    };

    const outing = {
      date: request.outingDate,
      outingTime: request.outingTime,
      returnTime: request.returnTime,
      purpose: request.purpose
    };

    res.json({
      success: true,
      data: {
        qrId,
        type,
        status: qrStatus,
        student,
        outing,
        validUntil: qrDetails?.validUntil,
        canScan: qrStatus === 'valid'
      }
    });

  } catch (error) {
    console.error('QR validation error:', error);
    console.error('Error stack:', error.stack);
    console.error('QR Data received:', qrData);
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Simple test endpoint to check scan functionality
router.post('/debug/test-scan', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    console.log('=== TEST SCAN DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    // Test with a simple QR ID
    const testQrId = req.body.qrId || 'OUT_123456_789012';
    console.log('Testing with QR ID:', testQrId);
    
    // Find any existing request
    const request = await OutingRequest.findByQRId(testQrId);
    console.log('Request found:', request ? 'Yes' : 'No');
    
    if (request) {
      console.log('Request details:', {
        id: request._id,
        hasOutgoingQR: !!request.qrCode?.outgoing?.qrId,
        hasIncomingQR: !!request.qrCode?.incoming?.qrId,
        outgoingQRId: request.qrCode?.outgoing?.qrId,
        incomingQRId: request.qrCode?.incoming?.qrId
      });
    }
    
    res.json({
      success: true,
      data: {
        testQrId,
        requestFound: !!request,
        requestDetails: request ? {
          id: request._id,
          studentId: request.studentId,
          hasOutgoingQR: !!request.qrCode?.outgoing?.qrId,
          hasIncomingQR: !!request.qrCode?.incoming?.qrId
        } : null
      }
    });
    
  } catch (error) {
    console.error('Test scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Test scan failed',
      error: error.message
    });
  }
});

// Create test QR code for testing
router.post('/debug/create-test-qr', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    // Find or create a test user
    let testUser = await User.findOne({ email: 'test.student@kietgroup.com' });
    if (!testUser) {
      testUser = new User({
        name: 'Test Student',
        email: 'test.student@kietgroup.com', 
        password: 'hashedpassword',
        role: 'student',
        rollNumber: 'TEST123',
        phoneNumber: '9876543210',
        parentPhoneNumber: '9876543211',
        hostelBlock: 'D-Block',
        floor: '2nd Floor',
        roomNumber: '201',
        branch: 'Computer Science',
        semester: 3
      });
      await testUser.save();
    }

    // Create a test outing request
    const testRequest = new OutingRequest({
      studentId: testUser._id,
      purpose: 'Testing QR Scanner',
      outingDate: new Date().toISOString().split('T')[0],
      outingTime: '10:00',
      returnTime: '18:00',
      status: 'approved',
      floorInchargeApproval: {
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      hostelInchargeApproval: {
        status: 'approved', 
        approvedBy: req.user.id,
        approvedAt: new Date()
      }
    });

    await testRequest.save();
    
    // Generate outgoing QR
    await testRequest.generateOutgoingQR();
    
    res.json({
      success: true,
      data: {
        message: 'Test QR code created successfully',
        qrId: testRequest.qrCode.outgoing.qrId,
        qrData: testRequest.qrCode.outgoing.data,
        student: testUser.name,
        requestId: testRequest._id
      }
    });

  } catch (error) {
    console.error('Create test QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test QR code',
      error: error.message
    });
  }
});

// Debug route to check existing QR codes
router.get('/debug/qr-codes', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    const requests = await OutingRequest.find({
      $or: [
        { 'qrCode.outgoing.qrId': { $exists: true } },
        { 'qrCode.incoming.qrId': { $exists: true } }
      ]
    })
    .populate('studentId', 'name rollNumber')
    .limit(10)
    .sort({ createdAt: -1 });

    const qrCodes = [];
    requests.forEach(request => {
      if (request.qrCode.outgoing?.qrId) {
        qrCodes.push({
          qrId: request.qrCode.outgoing.qrId,
          type: 'OUTGOING',
          student: request.studentId?.name,
          requestId: request._id,
          isExpired: request.qrCode.outgoing.isExpired
        });
      }
      if (request.qrCode.incoming?.qrId) {
        qrCodes.push({
          qrId: request.qrCode.incoming.qrId,
          type: 'INCOMING',
          student: request.studentId?.name,
          requestId: request._id,
          isExpired: request.qrCode.incoming.isExpired
        });
      }
    });

    res.json({
      success: true,
      data: {
        totalRequests: requests.length,
        qrCodes: qrCodes
      }
    });

  } catch (error) {
    console.error('Debug QR codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch QR codes',
      error: error.message
    });
  }
});

// Get recent gate activity
router.get('/activity/recent', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    const recentActivity = await OutingRequest.find({
      'gateActivity.scannedAt': { $gte: startOfDay }
    })
    .populate('studentId', 'name rollNumber hostelBlock floor roomNumber')
    .sort({ 'gateActivity.scannedAt': -1 })
    .limit(limit);

    const activityLog = [];
    recentActivity.forEach(request => {
      request.gateActivity.forEach(activity => {
        if (activity.scannedAt >= startOfDay) {
          activityLog.push({
            id: `${request._id}_${activity._id}`,
            student: request.studentId,
            type: activity.type,
            scannedAt: activity.scannedAt,
            location: activity.location,
            purpose: request.purpose,
            remarks: activity.remarks
          });
        }
      });
    });

    activityLog.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));

    res.json({
      success: true,
      data: activityLog.slice(0, limit)
    });

  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error.message
    });
  }
});

module.exports = router;