require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

const testWardenApproval = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-db');
    console.log('🔗 Connected to MongoDB');

    // Find a pending request that needs warden approval
    const request = await OutingRequest.findOne({
      'approvalFlags.hostelIncharge.isApproved': true,
      'approvalFlags.warden.isApproved': false
    }).populate('studentId', 'name email rollNumber hostelBlock floor roomNumber phoneNumber parentPhoneNumber');

    if (!request) {
      console.log('❌ No requests pending warden approval');
      
      // Create a test request
      const student = await User.findOne({ role: 'student' });
      if (student) {
        const testRequest = new OutingRequest({
          studentId: student._id,
          outingDate: new Date(),
          outingTime: '14:00',
          returnTime: '18:00',
          purpose: 'Test approval',
          hostelBlock: 'D-Block',
          floor: 2,
          status: 'pending',
          currentLevel: 'hostel-incharge',
          approvalFlags: {
            floorIncharge: {
              isApproved: true,
              approvedBy: 'Floor Incharge',
              approvedAt: new Date()
            },
            hostelIncharge: {
              isApproved: true,
              approvedBy: 'Hostel Incharge', 
              approvedAt: new Date()
            },
            warden: {
              isApproved: false
            }
          }
        });
        
        await testRequest.save();
        console.log('✅ Created test request:', testRequest._id);
        return;
      }
    }

    console.log('🎫 Testing warden approval for request:', request._id);
    console.log('👤 Student:', request.studentId.name, '(' + request.studentId.rollNumber + ')');

    // Test the QR generation separately
    try {
      console.log('🔧 Testing QR generation...');
      
      // Manually trigger warden approval
      request.approvalFlags.warden = {
        isApproved: true,
        approvedBy: 'Test Warden',
        approvedAt: new Date(),
        remarks: 'Test approval'
      };
      
      request.status = 'approved';
      request.currentLevel = 'completed';
      
      await request.save();
      console.log('✅ Request approved and saved');
      
      // Now try QR generation
      await request.generateOutgoingQR();
      console.log('✅ QR generation successful');
      
      console.log('🎯 QR ID:', request.qrCode.outgoing.qrId);
      
    } catch (error) {
      console.error('❌ QR generation failed:', error.message);
      console.error('❌ Stack:', error.stack);
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
};

testWardenApproval();