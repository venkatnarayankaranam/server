const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

exports.getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Get latest requests
    const requests = await OutingRequest.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get request stats
    const stats = {
      pending: await OutingRequest.countDocuments({ studentId, status: 'pending' }),
      approved: await OutingRequest.countDocuments({ studentId, status: 'approved' }),
      denied: await OutingRequest.countDocuments({ studentId, status: 'denied' })
    };

    // Get student profile
    const student = await User.findById(studentId);

    res.json({
      success: true,
      data: {
        requests: requests.map(req => ({
          id: req._id,
          date: req.outingDate,
          outTime: req.outingTime,
          inTime: req.returnTime,
          status: req.status,
          purpose: req.purpose
        })),
        stats,
        profile: {
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          hostelBlock: student.hostelBlock,
          floor: student.floor,
          roomNumber: student.roomNumber,
          parentPhoneNumber: student.parentPhoneNumber
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.submitOutingRequest = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    
    const newRequest = new OutingRequest({
      studentId: student._id,
      outingDate: req.body.outingDate,
      outingTime: req.body.outTime,
      returnTime: req.body.inTime,
      returnDate: req.body.outingDate,
      purpose: req.body.purpose,
      parentPhoneNumber: req.body.parentContact || student.parentPhoneNumber,
      hostelBlock: student.hostelBlock,
      floor: student.floor
    });

    await newRequest.save();

    res.status(201).json({
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Hostel Incharge - Get students grouped by blocks
exports.getStudentsByBlocks = async (req, res) => {
  try {
    const { role, assignedBlocks, email } = req.user;
    
    if (role !== 'hostel-incharge') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only hostel incharge can access this data.'
      });
    }

    console.log('🏢 Hostel Incharge requesting students:', {
      email: email,
      assignedBlocks: assignedBlocks
    });

    // Check if assignedBlocks is empty or undefined
    if (!assignedBlocks || assignedBlocks.length === 0) {
      console.log('⚠️ No assigned blocks found for hostel incharge:', email);
      return res.json({
        success: true,
        data: {},
        message: 'No blocks assigned to this hostel incharge'
      });
    }

    // Get students from the students collection (not users collection)
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // Only get students from the blocks assigned to this hostel incharge
    const students = await studentsCollection.find({
      hostelBlock: { $in: assignedBlocks }
    }).toArray();

    console.log(`📊 Found ${students.length} students in assigned blocks:`, assignedBlocks);

    // Group students by their actual blocks
    const groupedStudents = {
      'D-Block': students.filter(s => s.hostelBlock === 'D-Block'),
      'E-Block': students.filter(s => s.hostelBlock === 'E-Block'),
      'W-Block': students.filter(s => s.hostelBlock === 'W-Block')
    };

    // Only return blocks that this hostel incharge is assigned to
    const filteredGroupedStudents = {};
    assignedBlocks.forEach(block => {
      if (groupedStudents[block]) {
        filteredGroupedStudents[block] = groupedStudents[block];
      }
    });

    res.json({
      success: true,
      data: filteredGroupedStudents
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Hostel Incharge - Update student details
exports.updateStudentDetails = async (req, res) => {
  try {
    const { role } = req.user;
    const { studentId } = req.params;
    const updateData = req.body;

    console.log('🔄 Student Update Request:', {
      studentId,
      role,
      updateData,
      userEmail: req.user.email
    });

    if (role !== 'hostel-incharge') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only hostel incharge can update student details.'
      });
    }

    // Validate that student belongs to allowed blocks
    const student = await User.findById(studentId);
    console.log('📋 Found Student:', {
      id: student?._id,
      name: student?.name,
      role: student?.role,
      hostelBlock: student?.hostelBlock
    });

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found.'
      });
    }

    if (!['D-Block', 'E-Block', 'W-Block'].includes(student.hostelBlock)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update students from D-Block, E-Block, or W-Block.'
      });
    }

    // Allowed fields for update
    const allowedFields = [
      'name', 'email', 'rollNumber', 'phoneNumber', 'parentPhoneNumber', 
      'hostelBlock', 'floor', 'roomNumber', 'branch', 'semester'
    ];
    
    const filteredUpdate = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdate[key] = updateData[key];
      }
    });

    console.log('✏️ Filtered Update Data:', filteredUpdate);

    const updatedStudent = await User.findByIdAndUpdate(
      studentId,
      filteredUpdate,
      { new: true, runValidators: true }
    ).select('-password');

    console.log('✅ Student Updated Successfully:', {
      id: updatedStudent._id,
      name: updatedStudent.name
    });

    res.json({
      success: true,
      message: 'Student details updated successfully.',
      student: updatedStudent
    });

  } catch (error) {
    console.error('❌ Update student error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      studentId: req.params.studentId,
      updateData: req.body
    });
    
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.name // Add error type for debugging
    });
  }
};

// Hostel Incharge - Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const { role } = req.user;
    const { studentId } = req.params;

    if (role !== 'hostel-incharge') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only hostel incharge can delete students.'
      });
    }

    // Validate that student belongs to allowed blocks
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found.'
      });
    }

    if (!['D-Block', 'E-Block', 'W-Block'].includes(student.hostelBlock)) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete students from D-Block, E-Block, or W-Block.'
      });
    }

    // Delete all related outing requests first
    await OutingRequest.deleteMany({ studentId });
    
    // Delete student
    await User.findByIdAndDelete(studentId);

    res.json({
      success: true,
      message: 'Student and related data deleted successfully.'
    });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
