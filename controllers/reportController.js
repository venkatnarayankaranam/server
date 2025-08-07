const PDFDocument = require('pdfkit');
const OutingRequest = require('../models/OutingRequest');
const { generatePDF } = require('../services/pdfService');

exports.generateReport = async (req, res) => {
  try {
    const { role, hostelBlock, assignedFloor } = req.user;
    const { reportType, status } = req.query; // reportType: daily, weekly, monthly, yearly

    // Calculate date ranges based on report type
    const now = new Date();
    let startDate, endDate;
    
    switch (reportType) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        endDate = new Date();
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type. Use: daily, weekly, monthly, yearly'
        });
    }

    let query = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Add role-specific filters
    switch(role) {
      case 'floor-incharge':
        query.hostelBlock = hostelBlock;
        query.floor = { $in: assignedFloor };
        break;
      case 'hostel-incharge':
        query.hostelBlock = hostelBlock;
        break;
      case 'warden':
        // Warden can see all requests
        break;
    }

    if (status) {
      query.status = status;
    }

    const [requests, statistics] = await Promise.all([
      OutingRequest.find(query)
        .populate('studentId', 'name rollNumber hostelBlock roomNumber phoneNumber branch')
        .sort({ createdAt: -1 }),
      
      // Get statistics
      OutingRequest.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalOutings: { $sum: 1 },
            totalReturns: {
              $sum: {
                $cond: [{ $ne: ['$checkIn.time', null] }, 1, 0]
              }
            },
            approvedCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'approved'] }, 1, 0]
              }
            },
            pendingCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
              }
            },
            deniedCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'denied'] }, 1, 0]
              }
            }
          }
        }
      ])
    ]);

    const stats = statistics[0] || {
      totalOutings: 0,
      totalReturns: 0,
      approvedCount: 0,
      pendingCount: 0,
      deniedCount: 0
    };

    // Generate PDF using the service
    const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Outing Report`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${reportType}-outing-report-${Date.now()}.pdf`);

    // Enhanced PDF generation with statistics
    generatePDF(res, {
      title: reportTitle,
      requests,
      role,
      statistics: stats,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
