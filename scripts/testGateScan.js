require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User'); // Required for population

async function testGateScan() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const testQR = 'OUT_68862b7f40b1ccf3ebe8a767_1753625724669';
    console.log('🔍 Testing QR:', testQR);
    
    // Find the request
    const request = await OutingRequest.findByQRId(testQR);
    console.log('📋 Request found:', !!request);
    
    if (request) {
      console.log('📊 Request details:');
      console.log('  ID:', request._id);
      console.log('  Status:', request.status);
      console.log('  Has scanQR method:', typeof request.scanQR === 'function');
      
      // Check if the request is populated with student data
      console.log('  Student populated:', !!request.studentId);
      if (request.studentId) {
        console.log('  Student name:', request.studentId.name || 'Not populated');
      }
      
      // Test the scanQR method
      if (typeof request.scanQR === 'function') {
        console.log('\n🧪 Testing scanQR method...');
        try {
          const result = await request.scanQR(testQR, '68863155dfd83433f3e5e775', 'Main Gate');
          console.log('✅ Scan result:', result);
        } catch (scanError) {
          console.log('❌ Scan error:', scanError.message);
          console.log('📝 Error details:', scanError);
        }
      } else {
        console.log('❌ scanQR method not available');
      }
      
    } else {
      console.log('❌ Request not found for QR:', testQR);
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGateScan();