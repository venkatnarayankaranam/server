const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const Student = require('../models/Student');
const DisciplinaryAction = require('../models/DisciplinaryAction');
const Notification = require('../models/Notification');

// GET /students/blocks - list students grouped by hostel blocks for hostel incharge
router.get('/blocks', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    // Prefer assignedBlocks (hostel-incharge, warden) fallback to single hostelBlock if present
    const assignedBlocks = Array.isArray(req.user.assignedBlocks) && req.user.assignedBlocks.length > 0
      ? req.user.assignedBlocks
      : (req.user.hostelBlock ? [req.user.hostelBlock] : []);

    if (!assignedBlocks || assignedBlocks.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const students = await Student.find({
      hostelBlock: { $in: assignedBlocks }
    }).select('name email rollNumber hostelBlock floor roomNumber phoneNumber parentPhoneNumber branch semester');

    // Group by block
    const grouped = {};
    assignedBlocks.forEach(block => grouped[block] = []);
    students.forEach(s => {
      const block = s.hostelBlock || 'Unknown';
      if (!grouped[block]) grouped[block] = [];
      grouped[block].push(s);
    });

    return res.json({ success: true, data: grouped });
  } catch (error) {
    console.error('students/blocks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /students/search - search students with disciplinary and suspicious activity details
router.get('/search', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({ 
        success: true, 
        students: [],
        message: 'Please provide at least 2 characters to search'
      });
    }

    // Get user's assigned blocks
    const assignedBlocks = Array.isArray(req.user.assignedBlocks) && req.user.assignedBlocks.length > 0
      ? req.user.assignedBlocks
      : (req.user.hostelBlock ? [req.user.hostelBlock] : []);

    if (!assignedBlocks || assignedBlocks.length === 0) {
      return res.json({ success: true, students: [] });
    }

    // Search students by name or roll number
    const searchRegex = new RegExp(query.trim(), 'i');
    const students = await Student.find({
      hostelBlock: { $in: assignedBlocks },
      $or: [
        { name: searchRegex },
        { rollNumber: searchRegex }
      ]
    })
    .select('name email rollNumber hostelBlock floor roomNumber phoneNumber parentPhoneNumber branch semester')
    .limit(parseInt(limit))
    .lean();

    // Get disciplinary actions and suspicious activities for each student
    const studentsWithDetails = await Promise.all(
      students.map(async (student) => {
        try {
          // Get disciplinary actions
          const disciplinaryActions = await DisciplinaryAction.find({
            studentId: student._id
          })
          .select('title description severity category source createdAt gateContext')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

          // Get suspicious activity notifications (security alerts)
          const suspiciousActivities = await Notification.find({
            userId: student._id,
            type: 'securityAlert'
          })
          .select('title message createdAt referenceId')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

          // Count total disciplinary actions and suspicious activities
          const [totalDisciplinaryActions, totalSuspiciousActivities] = await Promise.all([
            DisciplinaryAction.countDocuments({ studentId: student._id }),
            Notification.countDocuments({ userId: student._id, type: 'securityAlert' })
          ]);

          return {
            ...student,
            disciplinaryActions,
            suspiciousActivities,
            totalDisciplinaryActions,
            totalSuspiciousActivities,
            riskLevel: calculateRiskLevel(totalDisciplinaryActions, totalSuspiciousActivities)
          };
        } catch (error) {
          console.error(`Error fetching details for student ${student._id}:`, error);
          return {
            ...student,
            disciplinaryActions: [],
            suspiciousActivities: [],
            totalDisciplinaryActions: 0,
            totalSuspiciousActivities: 0,
            riskLevel: 'low'
          };
        }
      })
    );

    res.json({
      success: true,
      students: studentsWithDetails,
      totalFound: studentsWithDetails.length
    });

  } catch (error) {
    console.error('Student search error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search students',
      error: error.message 
    });
  }
});

// Helper function to calculate risk level
function calculateRiskLevel(disciplinaryCount, suspiciousCount) {
  const totalIncidents = disciplinaryCount + suspiciousCount;
  
  if (totalIncidents >= 5) return 'high';
  if (totalIncidents >= 2) return 'medium';
  return 'low';
}

// GET /students/:id/details - get detailed student information with disciplinary and suspicious activity history
router.get('/:id/details', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the student
    const student = await Student.findById(id)
      .select('name email rollNumber hostelBlock floor roomNumber phoneNumber parentPhoneNumber branch semester')
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if user has access to this student (same hostel block)
    const assignedBlocks = Array.isArray(req.user.assignedBlocks) && req.user.assignedBlocks.length > 0
      ? req.user.assignedBlocks
      : (req.user.hostelBlock ? [req.user.hostelBlock] : []);

    if (!assignedBlocks.includes(student.hostelBlock) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Student not in your assigned blocks'
      });
    }

    // Get all disciplinary actions
    const disciplinaryActions = await DisciplinaryAction.find({
      studentId: student._id
    })
    .select('title description severity category source createdAt gateContext createdBy')
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

    // Get all suspicious activity notifications
    const suspiciousActivities = await Notification.find({
      userId: student._id,
      type: 'securityAlert'
    })
    .select('title message createdAt referenceId')
    .sort({ createdAt: -1 })
    .lean();

    // Get recent outing requests
    const OutingRequest = require('../models/OutingRequest');
    const recentOutings = await OutingRequest.find({
      studentId: student._id
    })
    .select('outingDate outingTime returnTime status purpose currentLevel createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    // Calculate statistics
    const stats = {
      totalDisciplinaryActions: disciplinaryActions.length,
      totalSuspiciousActivities: suspiciousActivities.length,
      totalOutingRequests: await OutingRequest.countDocuments({ studentId: student._id }),
      approvedOutings: await OutingRequest.countDocuments({ 
        studentId: student._id, 
        status: 'approved' 
      }),
      deniedOutings: await OutingRequest.countDocuments({ 
        studentId: student._id, 
        status: 'denied' 
      }),
      riskLevel: calculateRiskLevel(disciplinaryActions.length, suspiciousActivities.length)
    };

    // Group disciplinary actions by severity
    const disciplinaryBySeverity = {
      high: disciplinaryActions.filter(d => d.severity === 'high').length,
      medium: disciplinaryActions.filter(d => d.severity === 'medium').length,
      low: disciplinaryActions.filter(d => d.severity === 'low').length
    };

    res.json({
      success: true,
      student: {
        ...student,
        disciplinaryActions,
        suspiciousActivities,
        recentOutings,
        stats,
        disciplinaryBySeverity
      }
    });

  } catch (error) {
    console.error('Student details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student details',
      error: error.message
    });
  }
});

// POST /students/register - register a new student
router.post('/register', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    const {
      name,
      email,
      rollNumber,
      phoneNumber,
      parentPhoneNumber,
      hostelBlock,
      floor,
      roomNumber,
      branch,
      semester,
      password
    } = req.body;

    // Validation
    const requiredFields = ['name', 'email', 'rollNumber', 'phoneNumber', 'parentPhoneNumber', 'hostelBlock', 'floor', 'roomNumber', 'branch', 'semester'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if user has permission to register students in this hostel block
    const userBlocks = Array.isArray(req.user.assignedBlocks) && req.user.assignedBlocks.length > 0
      ? req.user.assignedBlocks
      : (req.user.hostelBlock ? [req.user.hostelBlock] : []);

    if (req.user.role !== 'admin' && req.user.role !== 'warden' && !userBlocks.includes(hostelBlock)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot register students in this hostel block'
      });
    }

    // Check if student with same roll number or email already exists
    const existingStudent = await Student.findOne({
      $or: [
        { rollNumber: rollNumber.trim() },
        { email: email.trim().toLowerCase() }
      ]
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this roll number or email already exists'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate phone numbers
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    if (!phoneRegex.test(parentPhoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Parent phone number must be 10 digits'
      });
    }

    // Create new student
    const newStudent = new Student({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      rollNumber: rollNumber.trim().toUpperCase(),
      phoneNumber: phoneNumber.trim(),
      parentPhoneNumber: parentPhoneNumber.trim(),
      hostelBlock: hostelBlock.trim(),
      floor: Student.formatFloor(floor),
      roomNumber: roomNumber.trim(),
      branch: branch.trim(),
      semester: parseInt(semester),
      password: password || 'student123' // Default password
    });

    await newStudent.save();

    // Create user account for the student
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    
    const hashedPassword = await bcrypt.hash(password || 'student123', 10);
    const newUser = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: 'student',
      hostelBlock: hostelBlock.trim(),
      floor: Student.formatFloor(floor),
      isActive: true,
      studentId: newStudent._id
    });

    await newUser.save();

    // Update student with user ID
    newStudent.userId = newUser._id;
    await newStudent.save();

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      student: {
        id: newStudent._id,
        name: newStudent.name,
        email: newStudent.email,
        rollNumber: newStudent.rollNumber,
        hostelBlock: newStudent.hostelBlock,
        floor: newStudent.floor,
        roomNumber: newStudent.roomNumber,
        branch: newStudent.branch,
        semester: newStudent.semester
      }
    });

  } catch (error) {
    console.error('Student registration error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Student with this ${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to register student',
      error: error.message
    });
  }
});

// PUT /students/:id - update student details
router.put('/:id', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'email', 'rollNumber', 'phoneNumber', 'parentPhoneNumber', 'hostelBlock', 'floor', 'roomNumber', 'branch', 'semester'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.floor) {
      update.floor = Student.formatFloor(update.floor);
    }
    const updated = await Student.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student: updated });
  } catch (error) {
    console.error('students update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /students/:id - delete student
router.delete('/:id', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Student.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('students delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;


