const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const socketIO = require('../config/socket');
const QRCode = require('qrcode');

exports.handleApproval = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { remarks = '', approvalStatus } = req.body; // approvalStatus expected: 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status. Must be "approved" or "rejected".'
      });
    }

    const request = await OutingRequest.findById(requestId)
      .populate('studentId', 'name email rollNumber phoneNumber');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    const userRole = req.user.role;

    // Block main gate approval
    if (userRole === 'gate') {
      return res.status(403).json({
        success: false,
        message: 'Main Gate cannot approve requests.'
      });
    }

    // Validate current level matches user role
    if (request.currentLevel !== userRole) {
      return res.status(400).json({
        success: false,
        message: `Invalid approval sequence. Expected ${request.currentLevel}, got ${userRole}`
      });
    }

    // Handle approval or rejection logic
    if (userRole === 'floor-incharge') {
      if (approvalStatus === 'approved') {
        request.approvalFlags.floorIncharge.isApproved = true;
        request.approvalFlags.floorIncharge.timestamp = new Date();
        request.approvalFlags.floorIncharge.remarks = remarks;
        request.currentLevel = 'hostel-incharge';
        // Do not change request.status yet
      } else {
        // Rejected by floor incharge
        request.approvalFlags.floorIncharge.isApproved = false;
        request.approvalFlags.floorIncharge.timestamp = new Date();
        request.approvalFlags.floorIncharge.remarks = remarks;
        request.status = 'denied';
        request.currentLevel = 'completed';
      }
    } else if (userRole === 'hostel-incharge') {
      // Can only approve if floorIncharge approved
      if (!request.approvalFlags.floorIncharge.isApproved) {
        return res.status(400).json({
          success: false,
          message: 'Floor Incharge approval required before Hostel Incharge approval.'
        });
      }

      if (approvalStatus === 'approved') {
        request.approvalFlags.hostelIncharge.isApproved = true;
        request.approvalFlags.hostelIncharge.timestamp = new Date();
        request.approvalFlags.hostelIncharge.remarks = remarks;
        // Move to warden level after hostel incharge approval
        request.currentLevel = 'warden';
      } else {
        // Rejected by hostel incharge
        request.approvalFlags.hostelIncharge.isApproved = false;
        request.approvalFlags.hostelIncharge.timestamp = new Date();
        request.approvalFlags.hostelIncharge.remarks = remarks;
        request.status = 'denied';
        request.currentLevel = 'completed';
      }
    } else if (userRole === 'warden') {
      // Can only approve if both floor incharge and hostel incharge approved
      if (!request.approvalFlags.floorIncharge.isApproved || !request.approvalFlags.hostelIncharge.isApproved) {
        return res.status(400).json({
          success: false,
          message: 'Both Floor Incharge and Hostel Incharge approval required before Warden approval.'
        });
      }

      if (approvalStatus === 'approved') {
        request.approvalFlags.warden.isApproved = true;
        request.approvalFlags.warden.timestamp = new Date();
        request.approvalFlags.warden.remarks = remarks;
        
        // Final approval - generate QR code and mark as approved
        request.status = 'approved';
        request.currentLevel = 'completed';

        // Generate outgoing QR code on final approval
        const qrPayload = {
          requestId: request._id.toString(),
          studentId: request.studentId._id.toString(),
          type: 'outgoing',
          generatedAt: new Date()
        };
        request.qrCode.outgoing.data = await QRCode.toDataURL(JSON.stringify(qrPayload));
        request.qrCode.outgoing.generatedAt = new Date();
      } else {
        // Rejected by warden
        request.approvalFlags.warden.isApproved = false;
        request.approvalFlags.warden.timestamp = new Date();
        request.approvalFlags.warden.remarks = remarks;
        request.status = 'denied';
        request.currentLevel = 'completed';
      }
    }

    // Add to approval flow
    request.approvalFlow.push({
      level: userRole,
      status: approvalStatus,
      timestamp: new Date(),
      remarks,
      approvedBy: req.user.email,
      approverInfo: {
        email: req.user.email,
        role: userRole
      }
    });

    await request.save();

    // Send notification to student
    await exports.sendStudentNotification(request, approvalStatus, userRole);

    // Send response
    res.json({
      success: true,
      message: 'Approval processed successfully',
      request: {
        id: request._id,
        status: request.status,
        currentLevel: request.currentLevel,
        approvalFlags: request.approvalFlags
      }
    });

  } catch (error) {
    console.error('Approval error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role === 'warden') {
      const [requests, students, hostels, outingsToday] = await Promise.all([
        OutingRequest.find({
          currentLevel: 'warden',
          hostelInchargeApproval: 'approved'
        }).populate('studentId', 'name email rollNumber hostelBlock roomNumber floor'),
        User.countDocuments({ role: 'student' }),
        User.distinct('hostelBlock'),
        OutingRequest.countDocuments({
          status: 'approved',
          outingDate: {
            $gte: new Date().setHours(0, 0, 0, 0),
            $lt: new Date().setHours(23, 59, 59, 999)
          }
        })
      ]);

      const stats = await OutingRequest.aggregate([
        { $match: { currentLevel: 'warden' } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]);

      return res.json({
        success: true,
        data: {
          requests,
          totalHostels: hostels.length,
          totalStudents: students,
          outingsToday,
          stats: {
            pending: stats.find(s => s._id === 'pending')?.count || 0,
            approved: stats.find(s => s._id === 'approved')?.count || 0,
            denied: stats.find(s => s._id === 'denied')?.count || 0
          }
        }
      });
    }
    
    const { hostelBlock, assignedFloor } = req.user;
    let query = {};

    // Build query based on role
    switch(role) {
      case 'floor-incharge':
        query = { 
          hostelBlock,
          floor: { $in: assignedFloor },
          currentLevel: 'floor-incharge'
        };
        break;
      case 'hostel-incharge':
        query = { 
          hostelBlock,
          currentLevel: 'hostel-incharge'
        };
        break;
      case 'warden':
        query = { 
          currentLevel: 'warden'
        };
        break;
    }

    const [requests, stats] = await Promise.all([
      OutingRequest.find(query)
        .populate('studentId', 'name email rollNumber phoneNumber hostelBlock roomNumber')
        .populate('approvalFlow.approvedBy', 'name email role')
        .sort({ createdAt: -1 }),
      OutingRequest.aggregate([
        { $match: query },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ])
    ]);

    const formattedStats = {
      pending: 0,
      approved: 0,
      denied: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
    });

    res.json({
      success: true,
      requests,
      stats: formattedStats
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyQRCode = async (req, res) => {
  try {
    const { qrData } = req.body;
    const data = JSON.parse(qrData);

    const request = await OutingRequest.findById(data.requestId)
      .populate('studentId', 'name email rollNumber phoneNumber parentPhoneNumber outingTime returnTime');

    if (!request) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code'
      });
    }

    const now = new Date();

    if (data.type === 'outgoing') {
      if (!request.qrCode.outgoing.data || request.qrCode.outgoing.data !== qrData) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired outgoing QR code'
        });
      }

      // Mark outgoing QR as used (make invisible)
      request.qrCode.outgoing.data = null;
      request.checkOut = {
        time: now,
        scannedBy: req.user.id
      };

      // Generate incoming QR 30 minutes before return time
      const incomingQRTime = new Date(request.returnDate);
      const [hours, minutes] = request.returnTime.split(':').map(Number);
      incomingQRTime.setHours(hours, minutes - 30, 0, 0);

      if (now >= incomingQRTime) {
        const incomingPayload = {
          requestId: request._id.toString(),
          studentId: request.studentId._id.toString(),
          type: 'incoming',
          generatedAt: now
        };
        request.qrCode.incoming.data = await QRCode.toDataURL(JSON.stringify(incomingPayload));
        request.qrCode.incoming.generatedAt = now;
      }

    } else if (data.type === 'incoming') {
      if (!request.qrCode.incoming.data || request.qrCode.incoming.data !== qrData) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired incoming QR code'
        });
      }

      // Mark incoming QR as used (make invisible)
      request.qrCode.incoming.data = null;
      request.checkIn = {
        time: now,
        scannedBy: req.user.id
      };

      // Check if return is within 30 minutes of scheduled time
      const scheduledReturn = new Date(`${request.returnDate}T${request.returnTime}`);
      const timeDiff = Math.abs(scheduledReturn - now) / (1000 * 60); // difference in minutes

      if (timeDiff > 30) {
        request.status = 'late-return';
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code type'
      });
    }

    await request.save();

    // Emit real-time update
    socketIO.getIO().emit('qr-scan', {
      requestId: request._id,
      type: data.type,
      timestamp: now
    });

    res.json({
      success: true,
      studentDetails: {
        name: request.studentId.name,
        rollNumber: request.studentId.rollNumber,
        phoneNumber: request.studentId.phoneNumber,
        parentPhoneNumber: request.parentPhoneNumber,
        outTime: request.outingTime,
        inTime: request.returnTime
      },
      scanTime: now
    });

  } catch (error) {
    console.error('QR verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper method to send notifications to students
exports.sendStudentNotification = async (request, approvalStatus, userRole) => {
  try {
    let title, message;
    
    if (approvalStatus === 'approved') {
      if (request.status === 'approved' && request.currentLevel === 'completed') {
        // Final approval from warden
        title = 'Outing Request Approved';
        message = 'Your outing request has been accepted. QR code generated successfully.';
      } else {
        // Intermediate approval
        title = 'Outing Request Updated';
        message = `Your outing request has been approved by ${userRole.replace('-', ' ')} and moved to the next level.`;
      }
    } else {
      // Rejected
      title = 'Outing Request Denied';
      message = 'Your outing request has been denied.';
    }

    // Create notification
    const notification = new Notification({
      userId: request.studentId._id || request.studentId,
      title,
      message,
      type: 'outingUpdate',
      referenceId: request._id,
      read: false
    });

    await notification.save();

    // Emit real-time notification if socket is available
    if (socketIO.getIO()) {
      socketIO.getIO().to(request.studentId._id.toString()).emit('notification', {
        id: notification._id,
        title,
        message,
        type: 'outingUpdate',
        createdAt: notification.createdAt
      });
    }

  } catch (error) {
    console.error('Notification error:', error);
    // Don't throw error to avoid disrupting the main approval flow
  }
};
