const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Student Dashboard Routes
router.get('/student/requests', auth, checkRole(['student']), async (req, res) => {
  try {
    console.log('Fetching requests for student:', req.user.id);
    
    const [requests, stats] = await Promise.all([
      OutingRequest.find({ studentId: req.user.id })
        .sort({ createdAt: -1 })
        .select('outingDate outingTime returnTime status purpose createdAt currentLevel approvalFlags approvalFlow qrCode gateActivity category')
        .lean(),
      {
        pending: await OutingRequest.countDocuments({ 
          studentId: req.user.id, 
          status: 'pending' 
        }),
        approved: await OutingRequest.countDocuments({ 
          studentId: req.user.id, 
          status: 'approved' 
        }),
        denied: await OutingRequest.countDocuments({ 
          studentId: req.user.id, 
          status: 'denied' 
        })
      }
    ]);

    console.log(`Found ${requests.length} requests for student ${req.user.id}`);

    // Compute robust completion state
    const isRequestCompleted = (r) => {
      const isFullyApproved = r.status === 'approved' && r.currentLevel === 'completed';
      if (!isFullyApproved) return false;
      const outgoingScanned = !!(r.qrCode?.outgoing?.isExpired && r.qrCode?.outgoing?.scannedAt);
      const incomingScanned = !!(r.qrCode?.incoming?.isExpired && r.qrCode?.incoming?.scannedAt);
      const isEmergency = r.category === 'emergency';
      const hasExit = Array.isArray(r.gateActivity) && r.gateActivity.some(a => a?.type === 'OUT' || a?.type === 'OUTGOING');
      const hasEntry = Array.isArray(r.gateActivity) && r.gateActivity.some(a => a?.type === 'IN' || a?.type === 'INCOMING');
      if (isEmergency) {
        return outgoingScanned || hasExit;
      }
      const qrCleared = !r.qrCode?.outgoing?.data && !r.qrCode?.incoming?.data;
      return (outgoingScanned && incomingScanned) || (hasExit && hasEntry) || qrCleared;
    };

    // Load recent notifications for this student
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ 
      success: true, 
      requests: requests.map(req => ({
        id: req._id,
        date: req.outingDate,
        outTime: req.outingTime,
        inTime: req.returnTime,
        status: req.status,
        purpose: req.purpose,
        createdAt: req.createdAt,
        currentLevel: req.currentLevel,
        category: req.category || 'normal',
        approvalStatus: {
          floorIncharge: req.approvalFlags?.floorIncharge?.isApproved ? 'approved' : 'waiting',
          hostelIncharge: req.approvalFlags?.hostelIncharge?.isApproved ? 'approved' : 'waiting',
          warden: req.approvalFlags?.warden?.isApproved ? 'approved' : 'waiting'
        },
        qrCode: req.qrCode || null,
        isFullyApproved: req.status === 'approved' && req.currentLevel === 'completed',
        // New robust flag used by client
        isCompleted: isRequestCompleted(req)
      })),
      stats,
      notifications
    });
  } catch (error) {
    console.error('Error fetching student requests:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/student/submit-request', auth, checkRole(['student']), async (req, res) => {
  try {
    const newRequest = new OutingRequest({
      studentId: req.user.id,
      outingDate: req.body.outingDate,
      outingTime: req.body.outTime,
      returnTime: req.body.inTime,
      returnDate: req.body.outingDate,
      purpose: req.body.purpose,
      parentPhoneNumber: req.body.parentContact,
      hostelBlock: req.user.hostelBlock,
      floor: req.user.floor,
      status: 'pending',
      currentLevel: 'floor-incharge'
    });

    await newRequest.save();

    res.json({
      success: true,
      request: {
        id: newRequest._id,
        date: newRequest.outingDate,
        outTime: newRequest.outingTime,
        inTime: newRequest.returnTime,
        status: newRequest.status,
        purpose: newRequest.purpose
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Floor Incharge Dashboard Routes
router.get('/floor-incharge/requests', auth, checkRole(['floor-incharge']), async (req, res) => {
  try {
    console.log('🏢 Floor Incharge requesting data:', {
      email: req.user.email,
      hostelBlock: req.user.hostelBlock,
      floor: req.user.floor,
      assignedFloor: req.user.assignedFloor
    });

    // Get requests for this floor incharge's assigned floor and block
    const requests = await OutingRequest.find({
      currentLevel: 'floor-incharge',
      hostelBlock: req.user.hostelBlock,
      floor: req.user.floor
    }).populate({
      path: 'studentId',
      model: 'Student',
      select: 'name rollNumber roomNumber'
    });

    console.log(`📋 Found ${requests.length} pending requests for floor incharge`);

    // Get total count of students from students collection (not users)
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');
    
    const totalStudents = await studentsCollection.countDocuments({
      hostelBlock: req.user.hostelBlock,
      floor: req.user.floor
    });

    const stats = {
      totalStudents,
      pending: await OutingRequest.countDocuments({
        currentLevel: 'floor-incharge',
        hostelBlock: req.user.hostelBlock,
        floor: req.user.floor,
        status: 'pending'
      }),
      approved: await OutingRequest.countDocuments({
        hostelBlock: req.user.hostelBlock,
        floor: req.user.floor,
        'approvalFlags.floorIncharge.isApproved': true
      }),
      denied: await OutingRequest.countDocuments({
        hostelBlock: req.user.hostelBlock,
        floor: req.user.floor,
        'approvalFlow.level': 'floor-incharge',
        'approvalFlow.status': 'denied'
      })
    };

    console.log('📊 Floor Incharge Stats:', stats);

    res.json({ 
      success: true, 
      requests, 
      stats,
      totalStudents 
    });
  } catch (error) {
    console.error('❌ Floor Incharge Dashboard Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Hostel Incharge Dashboard Routes
router.get('/hostel-incharge/requests', auth, checkRole(['hostel-incharge']), async (req, res) => {
  try {
    const requests = await OutingRequest.find({
      currentLevel: 'hostel-incharge',
      hostelBlock: { $in: req.user.assignedBlocks }
    }).populate({
      path: 'studentId',
      model: 'Student',
      select: 'name rollNumber roomNumber floor hostelBlock'
    });

    // Get statistics
    const Student = require('../models/Student');
    const stats = {
      totalStudents: await Student.countDocuments({
        hostelBlock: { $in: req.user.assignedBlocks }
      }),
      pending: await OutingRequest.countDocuments({
        currentLevel: 'hostel-incharge',
        hostelBlock: { $in: req.user.assignedBlocks },
        status: 'pending'
      }),
      approved: await OutingRequest.countDocuments({
        hostelBlock: { $in: req.user.assignedBlocks },
        'approvalFlags.hostelIncharge.isApproved': true
      }),
      denied: await OutingRequest.countDocuments({
        hostelBlock: { $in: req.user.assignedBlocks },
        status: 'denied',
        currentLevel: 'completed'
      })
    };

    res.json({
      success: true,
      requests,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Warden Dashboard Routes
router.get('/warden/requests', auth, checkRole(['warden']), async (req, res) => {
  try {
    const [requests, students, outingsToday] = await Promise.all([
      OutingRequest.find({
        currentLevel: 'warden',
        'approvalFlags.hostelIncharge.isApproved': true
      }).populate({
        path: 'studentId',
        model: 'Student',
        select: 'name rollNumber hostelBlock floor roomNumber'
      }),
      
      require('../models/Student').countDocuments({}),
      
      OutingRequest.countDocuments({
        status: 'approved',
        outingDate: {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(23, 59, 59, 999)
        }
      })
    ]);

    // Get approval statistics
    const stats = {
      totalStudents: students,
      outingsToday,
      pending: await OutingRequest.countDocuments({
        currentLevel: 'warden',
        'approvalFlags.hostelIncharge.isApproved': true
      }),
      approved: await OutingRequest.countDocuments({
        status: 'approved',
        currentLevel: 'completed'
      }),
      denied: await OutingRequest.countDocuments({
        status: 'denied',
        currentLevel: 'completed'
      })
    };

    res.json({
      success: true,
      requests,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Handle request actions
router.post('/request/:requestId/action', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, comments } = req.body;

    const request = await OutingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.workflow.push({
      level: req.user.role,
      status: action,
      actionBy: req.user.id,
      actionAt: new Date(),
      comments: comments || ''
    });

    if (action === 'approve') {
      request.moveToNextLevel();
    } else if (action === 'deny') {
      request.status = 'denied';
      request.currentLevel = 'completed';
    }

    await request.save();

    res.json({
      success: true,
      message: `Request ${action}d successfully`,
      request: {
        id: request._id,
        status: request.status,
        currentLevel: request.currentLevel
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Handle hostel incharge approval/denial
router.post('/hostel-incharge/request/:requestId/action', auth, checkRole(['hostel-incharge']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, comments } = req.body;

    const request = await OutingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.currentLevel !== 'hostel-incharge') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request state for hostel incharge action'
      });
    }

    request.approvalFlow.push({
      level: 'hostel-incharge',
      status: action,
      timestamp: new Date(),
      remarks: comments,
      approvedBy: req.user.email,
      approverInfo: {
        email: req.user.email,
        role: 'hostel-incharge'
      }
    });

    if (action === 'approve') {
      request.approvalFlags.hostelIncharge = {
        isApproved: true,
        timestamp: new Date(),
        remarks: comments
      };
      await request.moveToNextLevel();
    } else {
      request.status = 'denied';
      request.currentLevel = 'completed';
    }

    await request.save();

    res.json({
      success: true,
      message: `Request ${action}d successfully`,
      request: {
        id: request._id,
        status: request.status,
        currentLevel: request.currentLevel
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Handle warden approval/denial
router.post('/warden/request/:requestId/action', auth, checkRole(['warden']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, comments } = req.body;

    const request = await OutingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.currentLevel !== 'warden') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request state for warden action'
      });
    }

    request.approvalFlow.push({
      level: 'warden',
      status: action,
      timestamp: new Date(),
      remarks: comments,
      approvedBy: req.user.email,
      approverInfo: {
        email: req.user.email,
        role: 'warden'
      }
    });

    if (action === 'approve') {
      request.approvalFlags.warden = {
        isApproved: true,
        timestamp: new Date(),
        remarks: comments
      };
      request.status = 'approved';
      request.currentLevel = 'completed';
    } else {
      request.status = 'denied';
      request.currentLevel = 'completed';
    }

    await request.save();

    res.json({
      success: true,
      message: `Request ${action}d successfully`,
      request: {
        id: request._id,
        status: request.status,
        currentLevel: request.currentLevel
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
