require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User'); // Import User model for populate to work
const { generateIncomingQRsNow } = require('../services/qrScheduler');

const testQRSystem = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-db');
    console.log('🔗 Connected to MongoDB');

    // Find approved requests that have outgoing QR but no incoming QR
    const approvedRequests = await OutingRequest.find({
      status: 'approved',
      'qrCode.outgoing.data': { $exists: true }
    }).populate('studentId');

    console.log(`\n📊 Found ${approvedRequests.length} approved requests with outgoing QR`);

    for (const request of approvedRequests) {
      console.log(`\n🎫 Request ID: ${request._id}`);
      console.log(`   Student: ${request.studentId.name} (${request.studentId.rollNumber})`);
      console.log(`   Outing Date: ${request.outingDate}`);
      console.log(`   Return Time: ${request.returnTime}`);
      console.log(`   Has Outgoing QR: ${!!request.qrCode?.outgoing?.data}`);
      console.log(`   Outgoing QR Expired: ${request.qrCode?.outgoing?.isExpired || false}`);
      console.log(`   Has Incoming QR: ${!!request.qrCode?.incoming?.data}`);
      
      // If outgoing QR exists but incoming doesn't, generate it for testing
      if (request.qrCode?.outgoing?.data && !request.qrCode?.incoming?.data) {
        try {
          await request.generateIncomingQR();
          console.log(`   ✅ Generated incoming QR for testing`);
        } catch (error) {
          console.log(`   ❌ Failed to generate incoming QR: ${error.message}`);
        }
      }
    }

    // Show QR code details
    console.log('\n🔍 QR Code Details:');
    const updatedRequests = await OutingRequest.find({
      status: 'approved',
      'qrCode.outgoing.data': { $exists: true }
    }).populate('studentId');

    for (const request of updatedRequests) {
      console.log(`\n📱 Request ${request._id.toString().slice(-8)}:`);
      
      if (request.qrCode?.outgoing?.data) {
        console.log(`   🚪 Outgoing QR ID: ${request.qrCode.outgoing.qrId}`);
        console.log(`   🚪 Outgoing Generated: ${request.qrCode.outgoing.generatedAt}`);
        console.log(`   🚪 Outgoing Expired: ${request.qrCode.outgoing.isExpired}`);
        console.log(`   🚪 Valid Until: ${request.qrCode.outgoing.validUntil}`);
      }
      
      if (request.qrCode?.incoming?.data) {
        console.log(`   🏠 Incoming QR ID: ${request.qrCode.incoming.qrId}`);
        console.log(`   🏠 Incoming Generated: ${request.qrCode.incoming.generatedAt}`);
        console.log(`   🏠 Incoming Expired: ${request.qrCode.incoming.isExpired}`);
        console.log(`   🏠 Valid Until: ${request.qrCode.incoming.validUntil}`);
      }
    }

    console.log('\n✅ QR System test completed!');
    console.log('\n🎯 Test the system:');
    console.log('1. Login as student to see QR codes in dashboard');
    console.log('2. Login as security (security@kietgroup.com / Security@2026) to scan QRs');
    console.log('3. Copy QR data from student dashboard and paste in gate dashboard scanner');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
};

testQRSystem();