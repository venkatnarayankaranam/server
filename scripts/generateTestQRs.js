require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

const generateTestQRs = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-db');
    console.log('🔗 Connected to MongoDB');

    // Find an approved request
    const request = await OutingRequest.findOne({
      status: 'approved',
      currentLevel: 'completed'
    }).populate('studentId');

    if (!request) {
      console.log('❌ No approved requests found');
      return;
    }

    console.log('\n🎫 QR Code Test Data:');
    console.log('━'.repeat(50));
    
    if (request.qrCode?.outgoing?.data) {
      // Extract the JSON data from the QR code
      const outgoingQRId = request.qrCode.outgoing.qrId;
      console.log('\n📱 OUTGOING QR CODE DATA:');
      console.log('QR ID:', outgoingQRId);
      console.log('Copy this text to test scanning:');
      console.log('━'.repeat(30));
      console.log(outgoingQRId);
      console.log('━'.repeat(30));
    }

    if (request.qrCode?.incoming?.data) {
      const incomingQRId = request.qrCode.incoming.qrId;
      console.log('\n🏠 INCOMING QR CODE DATA:');
      console.log('QR ID:', incomingQRId);
      console.log('Copy this text to test scanning:');
      console.log('━'.repeat(30));
      console.log(incomingQRId);
      console.log('━'.repeat(30));
    }

    console.log('\n🧪 TESTING INSTRUCTIONS:');
    console.log('1. Go to Gate Dashboard: http://localhost:5174/dashboard/security');
    console.log('2. Login as security: security@kietgroup.com / Security@2026');
    console.log('3. Click "Scan QR Code" → Click camera icon');
    console.log('4. Click "Or paste QR data manually" and paste one of the QR IDs above');
    console.log('5. The system should validate and process the QR code');
    
    console.log('\n✅ Test data ready!');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

generateTestQRs();