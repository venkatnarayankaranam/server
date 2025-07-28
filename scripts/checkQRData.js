require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

const checkQRData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-db');
    console.log('🔗 Connected to MongoDB');

    // Find the specific request from the screenshot
    const request = await OutingRequest.findById('68862b7f40b1ccf3ebe8a767')
      .populate('studentId');

    if (!request) {
      console.log('❌ Request not found');
      return;
    }

    console.log('\n📊 Request Details:');
    console.log(`   ID: ${request._id}`);
    console.log(`   Student: ${request.studentId?.name} (${request.studentId?.rollNumber})`);
    console.log(`   Status: ${request.status}`);
    console.log(`   Current Level: ${request.currentLevel}`);
    console.log(`   Date: ${request.outingDate}`);
    console.log(`   Out Time: ${request.outingTime}`);
    console.log(`   Return Time: ${request.returnTime}`);

    console.log('\n🎫 QR Code Data:');
    console.log('   QR Code exists:', !!request.qrCode);
    
    if (request.qrCode) {
      console.log('\n   📱 Outgoing QR:');
      console.log('     - Has Data:', !!request.qrCode.outgoing?.data);
      console.log('     - QR ID:', request.qrCode.outgoing?.qrId);
      console.log('     - Generated At:', request.qrCode.outgoing?.generatedAt);
      console.log('     - Is Expired:', request.qrCode.outgoing?.isExpired);
      console.log('     - Valid Until:', request.qrCode.outgoing?.validUntil);
      
      if (request.qrCode.outgoing?.data) {
        console.log('     - QR Data Length:', request.qrCode.outgoing.data.length);
        // Parse the QR data to see what's inside
        try {
          const qrDataUrl = request.qrCode.outgoing.data;
          if (qrDataUrl.startsWith('data:image/png;base64,')) {
            console.log('     - QR Format: Valid PNG Data URL');
            
            // Decode the base64 data to get the JSON
            const base64Data = qrDataUrl.split(',')[1];
            const qrInfo = Buffer.from(base64Data, 'base64').toString();
            console.log('     - QR Contains Image Data: YES');
          }
        } catch (error) {
          console.log('     - QR Data Parse Error:', error.message);
        }
      }

      console.log('\n   🏠 Incoming QR:');
      console.log('     - Has Data:', !!request.qrCode.incoming?.data);
      console.log('     - QR ID:', request.qrCode.incoming?.qrId);
      console.log('     - Generated At:', request.qrCode.incoming?.generatedAt);
      console.log('     - Is Expired:', request.qrCode.incoming?.isExpired);
      console.log('     - Valid Until:', request.qrCode.incoming?.validUntil);
    }

    console.log('\n🔧 Approval Flags:');
    if (request.approvalFlags) {
      console.log('   Floor Incharge:', request.approvalFlags.floorIncharge?.isApproved);
      console.log('   Hostel Incharge:', request.approvalFlags.hostelIncharge?.isApproved);
      console.log('   Warden:', request.approvalFlags.warden?.isApproved);
    } else {
      console.log('   No approval flags found');
    }

    // Try to regenerate QR if missing
    if (request.status === 'approved' && request.currentLevel === 'completed' && !request.qrCode?.outgoing?.data) {
      console.log('\n🔄 Regenerating missing QR codes...');
      try {
        await request.generateOutgoingQR();
        await request.generateIncomingQR();
        console.log('✅ QR codes regenerated successfully');
      } catch (error) {
        console.log('❌ QR regeneration failed:', error.message);
      }
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkQRData();