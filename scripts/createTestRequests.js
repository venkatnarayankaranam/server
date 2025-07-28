require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

const createTestRequests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-db');
    console.log('Connected to MongoDB');

    // Find a student to create requests for
    const student = await User.findOne({ role: 'student' });
    if (!student) {
      console.log('No student found. Creating a test student...');
      const bcrypt = require('bcryptjs');
      const testStudent = new User({
        name: 'Test Student',
        email: 'teststudent@kietgroup.com',
        password: await bcrypt.hash('password123', 10),
        role: 'student',
        rollNumber: 'TEST001',
        hostelBlock: 'D-Block',
        floor: '1st Floor',
        roomNumber: '101',
        phoneNumber: '9876543210',
        parentPhoneNumber: '9876543211',
        branch: 'CSE',
        semester: 'VI',
        isActive: true
      });
      await testStudent.save();
      console.log('Test student created');
    }

    const studentToUse = student || await User.findOne({ role: 'student' });

    // Create test requests at different approval stages
    const requests = [
      {
        studentId: studentToUse._id,
        outingDate: new Date().toISOString().split('T')[0],
        outingTime: '14:00',
        returnTime: '18:00',
        purpose: 'Medical checkup',
        parentPhoneNumber: '9876543211',
        hostelBlock: 'D-Block',
        floor: '1st Floor',
        status: 'pending',
        currentLevel: 'warden',
        approvalFlags: {
          floorIncharge: {
            isApproved: true,
            approvedBy: 'floorincharge@kietgroup.com',
            approvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // Add timestamp for QR generation
            remarks: 'Approved by Floor Incharge'
          },
          hostelIncharge: {
            isApproved: true,
            approvedBy: 'hostelincharge@kietgroup.com',
            approvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // Add timestamp for QR generation
            remarks: 'Approved by Hostel Incharge'
          },
          warden: {
            isApproved: false,
            approvedBy: null,
            approvedAt: null,
            remarks: null
          }
        }
      },
      {
        studentId: studentToUse._id,
        outingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
        outingTime: '10:00',
        returnTime: '16:00',
        purpose: 'Visit home',
        parentPhoneNumber: '9876543211',
        hostelBlock: 'D-Block',
        floor: '1st Floor',
        status: 'pending',
        currentLevel: 'warden',
        approvalFlags: {
          floorIncharge: {
            isApproved: true,
            approvedBy: 'floorincharge@kietgroup.com',
            approvedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // Add timestamp for QR generation
            remarks: 'Approved by Floor Incharge'
          },
          hostelIncharge: {
            isApproved: true,
            approvedBy: 'hostelincharge@kietgroup.com',
            approvedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            timestamp: new Date(Date.now() - 30 * 60 * 1000), // Add timestamp for QR generation
            remarks: 'Approved by Hostel Incharge'
          },
          warden: {
            isApproved: false,
            approvedBy: null,
            approvedAt: null,
            remarks: null
          }
        }
      },
      {
        studentId: studentToUse._id,
        outingDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
        outingTime: '09:00',
        returnTime: '17:00',
        purpose: 'Shopping',
        parentPhoneNumber: '9876543211',
        hostelBlock: 'D-Block',
        floor: '1st Floor',
        status: 'approved',
        currentLevel: 'completed',
        approvalFlags: {
          floorIncharge: {
            isApproved: true,
            approvedBy: 'floorincharge@kietgroup.com',
            approvedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
            remarks: 'Approved by Floor Incharge'
          },
          hostelIncharge: {
            isApproved: true,
            approvedBy: 'hostelincharge@kietgroup.com',
            approvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
            remarks: 'Approved by Hostel Incharge'
          },
          warden: {
            isApproved: true,
            approvedBy: 'warden@kietgroup.com',
            approvedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
            timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000),
            remarks: 'Approved by Warden'
          }
        }
      }
    ];

    // Delete existing test requests
    await OutingRequest.deleteMany({ purpose: { $in: ['Medical checkup', 'Visit home', 'Shopping'] } });

    // Create new test requests
    for (const requestData of requests) {
      const request = new OutingRequest(requestData);
      await request.save();
      console.log(`Created request: ${request.purpose} (Status: ${request.status}, Level: ${request.currentLevel})`);
    }

    console.log('Test requests created successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error creating test requests:', error);
    process.exit(1);
  }
};

createTestRequests();