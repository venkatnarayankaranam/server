const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');
const { auth, checkRole } = require('../middleware/auth');

// Gate Dashboard - Get current activity and statistics
router.get('/dashboard', auth, checkRole(['security', 'admin', 'warden', 'gate']), async (req, res) => {
  try {
    console.log('📊 Gate Dashboard requested by:', req.user.email, req.user.role);
    
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    console.log('📅 Date range:', { startOfDay, endOfDay });

    // Get today's gate activity with better error handling
    const todayActivity = await OutingRequest.find({
      'gateActivity.scannedAt': {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
    .populate('studentId', 'name rollNumber hostelBlock floor roomNumber phoneNumber')
    .sort({ 'gateActivity.scannedAt': -1 })
    .exec();

    console.log('🎯 Found requests with gate activity:', todayActivity.length);

    // Flatten gate activity for easier display
    const activityLog = [];
    todayActivity.forEach(request => {
      if (request.gateActivity && request.gateActivity.length > 0) {
        request.gateActivity.forEach(activity => {
          const activityDate = new Date(activity.scannedAt);
          if (activityDate >= startOfDay && activityDate <= endOfDay) {
            activityLog.push({
              id: `${request._id}_${activity._id}`,
              student: request.studentId,
              type: activity.type,
              scannedAt: activity.scannedAt,
              location: activity.location || 'Main Gate',
              purpose: request.purpose,
              remarks: activity.remarks,
              qrType: activity.qrType
            });
          }
        });
      }
    });

    console.log('📝 Total activity log entries:', activityLog.length);

    // Sort by scan time (most recent first)
    activityLog.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));

    // Get comprehensive statistics
    const stats = {
      studentsOut: 0,
      studentsIn: 0,
      currentlyOut: 0,
      pendingReturn: 0
    };

    // Calculate current status by looking at the most recent activity for each student
    const studentStatus = new Map();
    
    activityLog.forEach(activity => {
      const studentId = activity.student?._id?.toString();
      if (studentId) {
        const currentActivity = studentStatus.get(studentId);
        if (!currentActivity || new Date(activity.scannedAt) > new Date(currentActivity.scannedAt)) {
          studentStatus.set(studentId, activity);
        }
      }
    });

    // Count based on most recent activity per student
    studentStatus.forEach(activity => {
      if (activity.type === 'OUT' || activity.type === 'OUTGOING') {
        stats.studentsOut++;
        stats.currentlyOut++;
      } else if (activity.type === 'IN' || activity.type === 'INCOMING') {
        stats.studentsIn++;
        // Student returned, so they're not currently out
        // Note: currentlyOut is only incremented for OUT activities above
      }
    });

    console.log('👥 Student status map:', Array.from(studentStatus.values()).map(a => ({
      student: a.student?.name,
      type: a.type,
      time: a.scannedAt
    })));

    // Get pending returns (students who went out but haven't returned)
    const outgoingRequests = await OutingRequest.find({
      status: 'approved',
      'qrCode.outgoing.isExpired': false,
      outingDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).countDocuments();

    stats.pendingReturn = Math.max(0, stats.currentlyOut);

    console.log('📊 Calculated stats:', stats);
    
    res.json({
      success: true,
      data: {
        activity: activityLog,
        stats: stats,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Gate dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gate dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Student search endpoint
router.get('/search-students', auth, checkRole(['security', 'admin', 'warden', 'gate']), async (req, res) => {
  try {
    const { q } = req.query;
    console.log('🔍 Student search query:', q);

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const User = require('../models/User');
    const searchQuery = q.trim();
    
    // Search by name or roll number
    const students = await User.find({
      role: 'student',
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { rollNumber: { $regex: searchQuery, $options: 'i' } }
      ]
    }).select('name rollNumber hostelBlock roomNumber phoneNumber').limit(10);

    console.log(`📋 Found ${students.length} students matching "${searchQuery}"`);

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error('Student search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search students'
    });
  }
});

// Currently out students endpoint - USES EXACT SAME LOGIC AS DASHBOARD
router.get('/currently-out', auth, checkRole(['security', 'admin', 'warden', 'gate']), async (req, res) => {
  try {
    console.log('👥 Fetching currently out students - using dashboard logic...');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    console.log('📅 Date range:', {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    });

    // EXACT SAME LOGIC AS DASHBOARD - Find all requests and build activity log
    const allRequests = await OutingRequest.find({}).populate('studentId', 'name rollNumber hostelBlock roomNumber phoneNumber');
    console.log(`🎯 Found ${allRequests.length} total requests`);

    const activityLog = [];
    let requestsWithActivity = 0;

    allRequests.forEach(request => {
      if (request.gateActivity && request.gateActivity.length > 0) {
        let hasActivityToday = false;
        request.gateActivity.forEach(activity => {
          const activityDate = new Date(activity.scannedAt);
          if (activityDate >= startOfDay && activityDate < endOfDay) {
            hasActivityToday = true;
            activityLog.push({
              student: request.studentId,
              type: activity.type,
              scannedAt: activity.scannedAt,
              purpose: request.purpose,
              location: activity.location
            });
          }
        });
        if (hasActivityToday) requestsWithActivity++;
      }
    });

    console.log(`🎯 Found requests with gate activity today: ${requestsWithActivity}`);
    console.log(`📝 Total activity log entries: ${activityLog.length}`);

    // EXACT SAME LOGIC AS DASHBOARD - Calculate current status by looking at most recent activity per student
    const studentStatus = new Map();
    
    activityLog.forEach(activity => {
      const studentId = activity.student?._id?.toString();
      if (studentId) {
        const currentActivity = studentStatus.get(studentId);
        if (!currentActivity || new Date(activity.scannedAt) > new Date(currentActivity.scannedAt)) {
          studentStatus.set(studentId, activity);
        }
      }
    });

    console.log('👥 Student status map:', Array.from(studentStatus.values()).map(a => ({
      student: a.student?.name,
      type: a.type,
      time: a.scannedAt
    })));

    // Filter only students who are currently out (most recent activity is OUT)
    const currentlyOut = [];
    studentStatus.forEach(activity => {
      if (activity.type === 'OUT' || activity.type === 'OUTGOING') {
        currentlyOut.push({
          _id: activity.student._id,
          name: activity.student.name,
          rollNumber: activity.student.rollNumber,
          hostelBlock: activity.student.hostelBlock,
          roomNumber: activity.student.roomNumber,
          outTime: activity.scannedAt,
          purpose: activity.purpose
        });
      }
    });

    console.log(`📊 Currently out students: ${currentlyOut.length}`);

    res.json({
      success: true,
      data: currentlyOut
    });

  } catch (error) {
    console.error('❌ Currently out students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch currently out students',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Manual check-in endpoint
router.post('/manual-checkin', auth, checkRole(['security', 'admin', 'warden', 'gate']), async (req, res) => {
  try {
    const { studentId, location = 'Main Gate' } = req.body;
    console.log('📥 Manual check-in request:', { 
      studentId, 
      location, 
      bodyReceived: req.body,
      userRole: req.user?.role 
    });

    if (!studentId) {
      console.log('❌ Student ID missing in request');
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const User = require('../models/User');
    
    // Find the gate user's ObjectId by email
    let gateUserId = req.user.id;
    if (typeof req.user.id === 'string' && req.user.id.includes('@')) {
      const gateUser = await User.findOne({ email: req.user.id });
      if (gateUser) {
        gateUserId = gateUser._id;
      }
    }

    // Find the student
    console.log('🔍 Looking for student with ID:', studentId);
    const student = await User.findById(studentId);
    console.log('👤 Student found:', student ? `${student.name} (${student.role})` : 'Not found');
    
    if (!student || student.role !== 'student') {
      console.log('❌ Student not found or not a student role');
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Use EXACT SAME logic as dashboard and currently-out endpoints
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    console.log('📅 Manual check-in date range:', {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    });
    
    // EXACT SAME LOGIC AS DASHBOARD - Find all requests for this student
    const allRequests = await OutingRequest.find({ studentId: studentId }).populate('studentId', 'name rollNumber');
    console.log(`🎯 Found ${allRequests.length} total requests for student`);
    
    // Build activity log for this student (same as dashboard logic)
    const activityLog = [];
    let requestsWithActivity = 0;

    allRequests.forEach(request => {
      if (request.gateActivity && request.gateActivity.length > 0) {
        let hasActivityToday = false;
        request.gateActivity.forEach(activity => {
          const activityDate = new Date(activity.scannedAt);
          if (activityDate >= startOfDay && activityDate < endOfDay) {
            hasActivityToday = true;
            activityLog.push({
              request: request,
              type: activity.type,
              scannedAt: activity.scannedAt,
              location: activity.location
            });
          }
        });
        if (hasActivityToday) requestsWithActivity++;
      }
    });
    
    console.log(`🎯 Found requests with gate activity today: ${requestsWithActivity}`);
    console.log(`📝 Total activity log entries: ${activityLog.length}`);
    console.log('🏃 All activities for student today:', activityLog.map(a => ({ 
      type: a.type, 
      time: a.scannedAt.toISOString() 
    })));
    
    // Find the most recent activity (same as dashboard logic)
    if (activityLog.length === 0) {
      console.log('❌ No gate activities found for student today');
      return res.status(400).json({
        success: false,
        message: 'No gate activity found for this student today'
      });
    }
    
    // Sort by time and get the most recent (same as dashboard logic)
    activityLog.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
    const mostRecentActivity = activityLog[0];
    
    console.log('🎯 Most recent activity:', {
      type: mostRecentActivity.type,
      time: mostRecentActivity.scannedAt.toISOString()
    });
    
    // Check if student is currently out (most recent activity is OUT)
    if (mostRecentActivity.type !== 'OUT' && mostRecentActivity.type !== 'OUTGOING') {
      console.log('❌ Student is not currently out - most recent activity is:', mostRecentActivity.type);
      return res.status(400).json({
        success: false,
        message: 'Student is not currently out (most recent activity is check-in)'
      });
    }
    
    const outgoingRequest = mostRecentActivity.request;
    console.log('✅ Found valid outgoing request - student is currently out');

    // Add check-in activity with current timestamp
    const checkInTime = new Date();
    const newActivity = {
      type: 'IN',
      scannedAt: checkInTime,
      scannedBy: gateUserId,
      location: location
    };
    
    console.log('📥 Adding check-in activity:', newActivity);
    outgoingRequest.gateActivity.push(newActivity);

    await outgoingRequest.save();
    console.log('💾 Saved check-in activity to database');

    console.log('✅ Manual check-in successful for:', student.name, 'at', checkInTime.toISOString());

    res.json({
      success: true,
      message: `${student.name} checked in successfully at ${checkInTime.toLocaleTimeString()}`,
      data: {
        student: {
          name: student.name,
          rollNumber: student.rollNumber,
          hostelBlock: student.hostelBlock,
          roomNumber: student.roomNumber
        },
        checkInTime: checkInTime,
        location: location,
        activity: {
          type: 'IN',
          scannedAt: checkInTime,
          location: location
        }
      }
    });

  } catch (error) {
    console.error('Manual check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process manual check-in'
    });
  }
});

// TEMPORARY: Simple manual check-in for debugging
router.post('/manual-checkin-debug', auth, async (req, res) => {
  try {
    const { studentId, location = 'Main Gate Debug' } = req.body;
    console.log('🔧 DEBUG Manual check-in:', { studentId, location, body: req.body });

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    const User = require('../models/User');
    const student = await User.findById(studentId);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('🎯 DEBUG: Would check in student:', student.name);

    // For now, just return success without actually updating database
    res.json({
      success: true,
      message: `DEBUG: ${student.name} would be checked in successfully`,
      data: {
        student: {
          name: student.name,
          rollNumber: student.rollNumber,
          hostelBlock: student.hostelBlock,
          roomNumber: student.roomNumber
        },
        checkInTime: new Date(),
        location: location
      }
    });

  } catch (error) {
    console.error('DEBUG manual check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process debug manual check-in'
    });
  }
});

// TEMPORARY: QR scan without strict auth for debugging  
router.post('/scan-debug', async (req, res) => {
  try {
    const { qrData, location = 'Main Gate (Debug)' } = req.body;
    console.log('=== DEBUG GATE SCAN REQUEST ===');
    console.log('Request body:', req.body);
    console.log('QR Data:', qrData);
    console.log('Location:', location);

    if (!qrData) {
      console.log('❌ No QR data provided');
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    let qrId;
    let parsedQR = null;

    // Handle both JSON format and simple QR ID format
    if (typeof qrData === 'object') {
      qrId = qrData.qrId;
    } else if (qrData.startsWith('{')) {
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
      // Simple QR ID format
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
    console.log('Request found for debug scan:', request ? 'Yes' : 'No');
    
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

    // Use a dummy user ID for debugging
    const dummyUserId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
    console.log('Attempting to scan QR (DEBUG):', { qrId, userId: dummyUserId, location });
    
    const scanResult = await request.scanQR(qrId, dummyUserId, location);
    console.log('Debug scan result:', scanResult);

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
        },
        debugMode: true
      }
    });

  } catch (error) {
    console.error('DEBUG QR scan error:', error);
    console.error('DEBUG QR scan error stack:', error.stack);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to scan QR code',
      debugMode: true
    });
  }
});

// Scan QR Code
router.post('/scan', auth, checkRole(['security', 'admin', 'warden', 'gate']), async (req, res) => {
  try {
    const { qrData, location = 'Main Gate' } = req.body;
    console.log('=== GATE SCAN REQUEST ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    console.log('QR Data:', qrData);
    console.log('Location:', location);

    if (!qrData) {
      console.log('❌ No QR data provided');
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    let qrId;
    let parsedQR = null;

    // Handle all QR data formats safely
    if (typeof qrData === 'object' && qrData !== null) {
      // Direct object format
      qrId = qrData.qrId;
      console.log('🔍 Object format QR ID:', qrId);
    } else if (typeof qrData === 'string') {
      if (qrData.startsWith('{')) {
        // JSON string format
        try {
          parsedQR = JSON.parse(qrData);
          qrId = parsedQR.qrId;
          console.log('🔍 Parsed JSON QR:', { qrId });
        } catch (error) {
          console.log('JSON parse error:', error.message);
          return res.status(400).json({
            success: false,
            message: 'Invalid QR code JSON format'
          });
        }
      } else {
        // Simple QR ID string format
        qrId = qrData.trim();
        console.log('🔍 Simple QR ID:', qrId);
      }
    } else {
      console.log('❌ Invalid QR data type:', typeof qrData);
      return res.status(400).json({
        success: false,
        message: 'Invalid QR data format'
      });
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

    // Find the gate user's ObjectId by email
    const User = require('../models/User');
    let gateUserId = req.user.id;
    
    // If req.user.id is an email (like maingate@kietgroup.com), find the actual ObjectId
    if (typeof req.user.id === 'string' && req.user.id.includes('@')) {
      console.log('🔍 Looking up gate user ObjectId for email:', req.user.id);
      const gateUser = await User.findOne({ email: req.user.id });
      if (gateUser) {
        gateUserId = gateUser._id;
        console.log('✅ Found gate user ObjectId:', gateUserId);
      } else {
        console.log('❌ Gate user not found in database');
        return res.status(400).json({
          success: false,
          message: 'Gate user not found in database'
        });
      }
    }

    // Scan the QR code with the proper ObjectId
    console.log('Attempting to scan QR:', { qrId, userId: gateUserId, location });
    const scanResult = await request.scanQR(qrId, gateUserId, location);
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

// Test route without authentication for debugging
router.post('/test-validate', (req, res) => {
  console.log('🧪 TEST VALIDATE endpoint hit!');
  res.json({ success: true, message: 'Test route working', path: req.path });
});

// Temporary debug route - check current user
router.get('/debug/current-user', auth, (req, res) => {
  console.log('👤 Current user debug:', req.user);
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      hasAccess: ['security', 'admin', 'warden'].includes(req.user.role?.toLowerCase())
    }
  });
});

// TEMPORARY: QR validation without strict auth for debugging
router.post('/qr/validate-debug', async (req, res) => {
  console.log('🧪 DEBUG QR Validate endpoint hit (no auth)!');
  console.log('Body:', req.body);
  
  try {
    let { qrData } = req.body;
    console.log('Debug - Received QR data:', qrData);

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    // Handle string QR data
    if (typeof qrData === 'string') {
      try {
        qrData = JSON.parse(qrData);
      } catch {
        // If parsing fails, assume it's a simple QR ID
        qrData = { qrId: qrData };
      }
    }

    // Extract QR ID
    const qrId = qrData.qrId || qrData.id;
    if (!qrId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format - missing ID'
      });
    }

    console.log('Debug - Looking for QR ID:', qrId);

    // Find request by QR ID (already populated by the static method)
    const request = await OutingRequest.findByQRId(qrId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found or invalid'
      });
    }

    console.log('✅ Debug - Request found:', {
      id: request._id,
      hasStudentId: !!request.studentId,
      studentName: request.studentId?.name,
      status: request.status
    });

    // Simple response for debugging
    res.json({
      success: true,
      data: {
        qrId,
        type: 'DEBUG',
        status: 'valid',
        student: {
          name: request.studentId?.name || 'Unknown',
          rollNumber: request.studentId?.rollNumber || 'Unknown'
        },
        canScan: true,
        message: 'Debug validation successful'
      }
    });

  } catch (error) {
    console.error('Debug QR validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
      error: error.message
    });
  }
});

// Get QR Code Details (for preview before scanning)
router.post('/qr/validate', auth, checkRole(['security', 'admin', 'warden', 'gate']), async (req, res) => {
  console.log('🔍 QR Validate endpoint hit!');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Body:', req.body);
  try {
    let { qrData } = req.body;
    console.log('Received QR data:', qrData);

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    // Handle string QR data
    if (typeof qrData === 'string') {
      try {
        qrData = JSON.parse(qrData);
      } catch {
        // If parsing fails, assume it's a simple QR ID
        qrData = { qrId: qrData };
      }
    }

    // Extract QR ID
    const qrId = qrData.qrId || qrData.id;
    if (!qrId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format - missing ID'
      });
    }

    // Find request by QR ID (already populated by the static method)
    const request = await OutingRequest.findByQRId(qrId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found or invalid'
      });
    }

    console.log('✅ Request found:', {
      id: request._id,
      hasStudentId: !!request.studentId,
      studentName: request.studentId?.name,
      status: request.status
    });

    // Check if studentId is populated
    if (!request.studentId || !request.studentId.name) {
      console.error('❌ Student data not properly populated for request:', request._id);
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
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
      error: error.message
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

// Get system status and debug info
router.get('/debug/status', auth, checkRole(['security', 'admin', 'warden']), async (req, res) => {
  try {
    console.log('=== GATE DEBUG STATUS ===');
    
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    // Count total requests with QR codes
    const totalRequests = await OutingRequest.countDocuments({
      $or: [
        { 'qrCode.outgoing.qrId': { $exists: true } },
        { 'qrCode.incoming.qrId': { $exists: true } }
      ]
    });
    
    // Get recent QR codes
    const recentQRs = await OutingRequest.find({
      $or: [
        { 'qrCode.outgoing.qrId': { $exists: true } },
        { 'qrCode.incoming.qrId': { $exists: true } }
      ]
    })
    .populate('studentId', 'name rollNumber')
    .sort({ createdAt: -1 })
    .limit(3);

    const qrSamples = [];
    recentQRs.forEach(request => {
      if (request.qrCode.outgoing?.qrId) {
        qrSamples.push({
          type: 'OUTGOING',
          qrId: request.qrCode.outgoing.qrId,
          student: request.studentId?.name,
          expired: request.qrCode.outgoing.isExpired,
          jsonData: request.qrCode.outgoing.data
        });
      }
      if (request.qrCode.incoming?.qrId) {
        qrSamples.push({
          type: 'INCOMING', 
          qrId: request.qrCode.incoming.qrId,
          student: request.studentId?.name,
          expired: request.qrCode.incoming.isExpired,
          jsonData: request.qrCode.incoming.data
        });
      }
    });

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus,
          totalQRCodes: totalRequests
        },
        qrSamples: qrSamples,
        endpoints: {
          validate: '/gate/qr/validate',
          scan: '/gate/scan',
          dashboard: '/gate/dashboard'
        },
        testInstructions: {
          manualInput: 'Copy a qrId from qrSamples and paste in dashboard input',
          jsonInput: 'Copy jsonData from qrSamples for full JSON testing',
          cameraRequirement: 'Camera requires HTTPS or localhost'
        }
      }
    });

  } catch (error) {
    console.error('Debug status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get debug status',
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