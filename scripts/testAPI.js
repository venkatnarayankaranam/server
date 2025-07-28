require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

const testAPI = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-db');
    console.log('🔗 Connected to MongoDB');

    // Find student ID for the user (assuming venkatnarayan)
    const student = await User.findOne({ rollNumber: '226' });
    if (!student) {
      console.log('❌ Student not found');
      return;
    }

    console.log(`👤 Found student: ${student.name} (ID: ${student._id})`);

    // Simulate the API call that the frontend makes
    const requests = await OutingRequest.find({ studentId: student._id })
      .sort({ createdAt: -1 })
      .select('outingDate outingTime returnTime status purpose createdAt currentLevel approvalFlags approvalFlow qrCode')
      .lean();

    console.log(`\n📊 API would return ${requests.length} requests:`);

    requests.forEach((req, index) => {
      const apiResponse = {
        id: req._id,
        date: req.outingDate,
        outTime: req.outingTime,
        inTime: req.returnTime,
        status: req.status,
        purpose: req.purpose,
        createdAt: req.createdAt,
        currentLevel: req.currentLevel,
        approvalStatus: {
          floorIncharge: req.approvalFlags?.floorIncharge?.isApproved ? 'approved' : 'waiting',
          hostelIncharge: req.approvalFlags?.hostelIncharge?.isApproved ? 'approved' : 'waiting',
          warden: req.approvalFlags?.warden?.isApproved ? 'approved' : 'waiting'
        },
        qrCode: req.qrCode || null,
        isFullyApproved: req.status === 'approved' && req.currentLevel === 'completed'
      };

      console.log(`\n🎫 Request ${index + 1}:`);
      console.log(`   ID: ${apiResponse.id.toString().slice(-8)}`);
      console.log(`   Status: ${apiResponse.status}`);
      console.log(`   Current Level: ${apiResponse.currentLevel}`);
      console.log(`   Is Fully Approved: ${apiResponse.isFullyApproved}`);
      console.log(`   Has QR Code Object: ${!!apiResponse.qrCode}`);
      
      if (apiResponse.qrCode) {
        console.log(`   Has Outgoing QR: ${!!apiResponse.qrCode.outgoing?.data}`);
        console.log(`   Outgoing QR ID: ${apiResponse.qrCode.outgoing?.qrId}`);
        console.log(`   Outgoing Expired: ${apiResponse.qrCode.outgoing?.isExpired}`);
        console.log(`   Has Incoming QR: ${!!apiResponse.qrCode.incoming?.data}`);
        console.log(`   Incoming QR ID: ${apiResponse.qrCode.incoming?.qrId}`);
        console.log(`   Incoming Expired: ${apiResponse.qrCode.incoming?.isExpired}`);
      }
    });

    console.log('\n✅ This is the exact data your frontend should receive!');
    console.log('🔄 Please refresh your browser page to see the updated QR codes');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testAPI();