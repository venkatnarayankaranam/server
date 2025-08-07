const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HomePermissionRequest = require('../models/HomePermissionRequest');
const User = require('../models/User');
const { auth, checkRole } = require('../middleware/auth');
const socketIO = require('../config/socket');
const PDFDocument = require('pdfkit');
const { generatePDF } = require('../services/pdfService');
const QRCode = require('qrcode');
const { getIO } = require('../config/socket');

// Submit new home permission request
router.post('/requests/submit', auth, async (req, res) => {
  try {
    const { goingDate, incomingDate, homeTownName, purpose, parentContact } = req.body;
    
    // Get student details
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has any active home permission requests
    const activeRequest = await HomePermissionRequest.findOne({
      studentId: req.user.id,
      status: { $in: ['pending', 'approved'] },
      currentLevel: { $ne: 'completed' }
    });

    if (activeRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active home permission request'
      });
    }

    // Create new home permission request
    const homePermissionRequest = new HomePermissionRequest({
      studentId: req.user.id,
      goingDate: new Date(goingDate),
      incomingDate: new Date(incomingDate),
      homeTownName,
      purpose,
      parentPhoneNumber: parentContact,
      hostelBlock: student.hostelBlock,
      floor: student.floor,
    });

    await homePermissionRequest.save();

    // Populate student details for response
    await homePermissionRequest.populate('studentId', 'name rollNumber email phoneNumber branch semester');

    // Emit socket event for real-time updates
    const io = getIO();
    if (io) {
      io.emit('new-home-permission-request', {
        requestId: homePermissionRequest._id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        hostelBlock: student.hostelBlock,
        floor: student.floor,
        homeTownName,
        currentLevel: 'floor-incharge'
      });
    }

    res.json({
      success: true,
      message: 'Home permission request submitted successfully',
      request: homePermissionRequest
    });

  } catch (error) {
    console.error('Error submitting home permission request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit home permission request',
      error: error.message
    });
  }
});

// Get student's home permission requests
router.get('/dashboard/student/requests', auth, async (req, res) => {
  try {
    const requests = await HomePermissionRequest.find({ studentId: req.user.id })
      .populate('studentId', 'name rollNumber email phoneNumber branch semester')
      .sort({ createdAt: -1 });

    const stats = {
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      denied: requests.filter(r => r.status === 'denied').length
    };

    res.json({
      success: true,
      requests,
      stats
    });

  } catch (error) {
    console.error('Error fetching home permission requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home permission requests',
      error: error.message
    });
  }
});

// Floor Incharge Dashboard
router.get('/dashboard/floor-incharge', auth, async (req, res) => {
  try {
    const floorIncharge = await User.findById(req.user.id);
    if (!floorIncharge) {
      return res.status(404).json({
        success: false,
        message: 'Floor incharge not found'
      });
    }

    // Get floor incharge's floor(s) - handle both array and string
    const floors = Array.isArray(floorIncharge.floor) 
      ? floorIncharge.floor 
      : floorIncharge.floor ? [floorIncharge.floor] : [];

    // Get requests for this floor incharge - only include current pending requests
    // and requests that were previously handled by this floor incharge (for stats/history)
    const requests = await HomePermissionRequest.find({
      hostelBlock: floorIncharge.hostelBlock,
      floor: { $in: floors }
    }).populate('studentId', 'name rollNumber email phoneNumber branch semester')
      .sort({ createdAt: -1 });

    const stats = {
      pending: requests.filter(r => r.currentLevel === 'floor-incharge' && r.status === 'pending').length,
      approved: requests.filter(r => r.approvalFlags?.floorIncharge?.isApproved).length,
      denied: requests.filter(r => r.status === 'denied').length,
      totalRequests: requests.length,
      floorInchargeApproved: requests.filter(r => r.approvalFlags?.floorIncharge?.isApproved).length
    };

    res.json({
      success: true,
      data: {
        requests,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching floor incharge home permission dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// Hostel Incharge Dashboard
router.get('/dashboard/hostel-incharge', auth, async (req, res) => {
  try {
    const hostelIncharge = await User.findById(req.user.id);
    if (!hostelIncharge) {
      return res.status(404).json({
        success: false,
        message: 'Hostel incharge not found'
      });
    }

    // Get requests for this hostel incharge's block
    const requests = await HomePermissionRequest.find({
      hostelBlock: hostelIncharge.hostelBlock,
      $or: [
        { currentLevel: 'hostel-incharge' },
        { 'approvalFlow.approvedBy': hostelIncharge.email }
      ]
    }).populate('studentId', 'name rollNumber email phoneNumber branch semester')
      .sort({ createdAt: -1 });

    const stats = {
      pending: requests.filter(r => r.currentLevel === 'hostel-incharge' && r.status === 'pending').length,
      approved: requests.filter(r => r.approvalFlags?.hostelIncharge?.isApproved).length,
      denied: requests.filter(r => r.status === 'denied').length,
      totalRequests: requests.length,
      floorInchargeApproved: requests.filter(r => r.approvalFlags?.floorIncharge?.isApproved).length
    };

    res.json({
      success: true,
      data: {
        requests,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching hostel incharge home permission dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// Warden Dashboard
router.get('/dashboard/warden', auth, async (req, res) => {
  try {
    // Get all requests that reached warden level or approved by this warden
    const requests = await HomePermissionRequest.find({
      $or: [
        { currentLevel: 'warden' },
        { 'approvalFlow.approvedBy': req.user.email }
      ]
    }).populate('studentId', 'name rollNumber email phoneNumber branch semester hostelBlock floor')
      .sort({ createdAt: -1 });

    const stats = {
      pending: requests.filter(r => r.currentLevel === 'warden' && r.status === 'pending').length,
      approved: requests.filter(r => r.approvalFlags?.warden?.isApproved).length,
      denied: requests.filter(r => r.status === 'denied').length,
      totalRequests: requests.length
    };

    res.json({
      success: true,
      data: {
        requests,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching warden home permission dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// Approve home permission request
router.post('/:requestId/approve', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { approvalFlow, level, status, remarks } = req.body;

    // Find the request
    const request = await HomePermissionRequest.findById(requestId)
      .populate('studentId', 'name rollNumber email phoneNumber branch semester');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Home permission request not found'
      });
    }

    // Get current user details
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate approval flow
    if (!approvalFlow || !Array.isArray(approvalFlow) || approvalFlow.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval flow data'
      });
    }

    const approvalEntry = approvalFlow[0];

    // Validate approval entry
    try {
      request.validateApprovalFlow(approvalEntry);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: 'Approval validation failed'
      });
    }

    // Add approval to the flow
    request.approvalFlow.push({
      ...approvalEntry,
      timestamp: new Date(),
      remarks: remarks || ''
    });

    // Save the request (pre-save middleware will handle status updates)
    await request.save();

    // Generate QR codes if fully approved
    if (request.status === 'approved' && request.currentLevel === 'completed') {
      try {
        // Generate outgoing QR code
        const outgoingQrId = `home-out-${request._id}-${Date.now()}`;
        const outgoingQRData = JSON.stringify({
          requestId: request._id,
          studentId: request.studentId._id,
          type: 'home-permission-outgoing',
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid for 24 hours
          qrId: outgoingQrId
        });
        const outgoingQRCode = await QRCode.toDataURL(outgoingQRData);

        // Generate incoming QR code (auto-generated when going out)
        const incomingQrId = `home-in-${request._id}-${Date.now()}`;
        const incomingQRData = JSON.stringify({
          requestId: request._id,
          studentId: request.studentId._id,
          type: 'home-permission-incoming',
          validUntil: new Date(request.incomingDate.getTime() + 24 * 60 * 60 * 1000),
          qrId: incomingQrId
        });
        const incomingQRCode = await QRCode.toDataURL(incomingQRData);

        // Update request with QR codes
        request.qrCode = {
          outgoing: {
            data: outgoingQRCode,
            generatedAt: new Date(),
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
            qrId: outgoingQrId
          },
          incoming: {
            data: incomingQRCode,
            generatedAt: new Date(),
            validUntil: new Date(request.incomingDate.getTime() + 24 * 60 * 60 * 1000),
            qrId: incomingQrId,
            autoGeneratedAt: new Date()
          }
        };

        await request.save();
      } catch (qrError) {
        console.error('Error generating QR codes:', qrError);
        // Don't fail the approval if QR generation fails
      }
    }

    // Emit socket event for real-time updates
    const io = getIO();
    if (io) {
      io.emit('home-permission-approved', {
        requestId: request._id,
        studentName: request.studentId.name,
        currentLevel: request.currentLevel,
        status: request.status,
        approver: currentUser.name
      });
    }

    res.json({
      success: true,
      message: 'Home permission request approved successfully',
      request
    });

  } catch (error) {
    console.error('Error approving home permission request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve home permission request',
      error: error.message
    });
  }
});

// Deny home permission request
router.post('/:requestId/deny', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { remarks } = req.body;

    const request = await HomePermissionRequest.findById(requestId)
      .populate('studentId', 'name rollNumber email phoneNumber branch semester');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Home permission request not found'
      });
    }

    // Get current user details
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add denial to approval flow
    request.approvalFlow.push({
      level: request.currentLevel,
      status: 'denied',
      timestamp: new Date(),
      remarks: remarks || 'Request denied',
      approvedBy: currentUser.email,
      approverInfo: {
        email: currentUser.email,
        role: currentUser.role
      }
    });

    // Update request status
    request.status = 'denied';
    await request.save();

    // Emit socket event for real-time updates
    const io = getIO();
    if (io) {
      io.emit('home-permission-denied', {
        requestId: request._id,
        studentName: request.studentId.name,
        denier: currentUser.name
      });
    }

    res.json({
      success: true,
      message: 'Home permission request denied',
      request
    });

  } catch (error) {
    console.error('Error denying home permission request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deny home permission request',
      error: error.message
    });
  }
});

// Gate Dashboard - Get approved home permissions
router.get('/dashboard/gate', auth, async (req, res) => {
  try {
    // Get all approved requests with QR codes
    const requests = await HomePermissionRequest.find({
      status: 'approved',
      currentLevel: 'completed',
      $or: [
        { 'qrCode.outgoing.data': { $exists: true } },
        { 'qrCode.incoming.data': { $exists: true } }
      ]
    }).populate('studentId', 'name rollNumber email phoneNumber branch semester hostelBlock floor roomNumber')
      .sort({ createdAt: -1 });

    const stats = {
      totalApproved: requests.length,
      awaitingCheckout: requests.filter(r => 
        r.qrCode?.outgoing?.data && 
        !r.qrCode?.outgoing?.isExpired && 
        !r.qrCode?.outgoing?.scannedAt
      ).length,
      awaitingCheckin: requests.filter(r => 
        r.qrCode?.incoming?.data && 
        !r.qrCode?.incoming?.isExpired && 
        !r.qrCode?.incoming?.scannedAt
      ).length,
      completed: requests.filter(r => 
        r.qrCode?.outgoing?.isExpired && 
        r.qrCode?.incoming?.isExpired
      ).length
    };

    res.json({
      success: true,
      data: {
        requests,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching gate dashboard home permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gate dashboard data',
      error: error.message
    });
  }
});

module.exports = router;