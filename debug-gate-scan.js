const mongoose = require('mongoose');
const OutingRequest = require('./models/OutingRequest');
const User = require('./models/User');
const connectDB = require('./config/db');
require('dotenv').config();

const debugGateScan = async () => {
  try {
    console.log('🔍 Starting Gate Scan Debug...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // 1. Check for existing QR codes
    console.log('\n=== EXISTING QR CODES ===');
    const requests = await OutingRequest.find({
      $or: [
        { 'qrCode.outgoing.qrId': { $exists: true } },
        { 'qrCode.incoming.qrId': { $exists: true } }
      ]
    })
    .populate('studentId', 'name rollNumber')
    .limit(5)
    .sort({ createdAt: -1 });

    if (requests.length === 0) {
      console.log('❌ No QR codes found in database');
      
      // Create a test QR code
      console.log('\n=== CREATING TEST QR ===');
      
      // Find or create test user
      let testUser = await User.findOne({ email: 'test.gate@kiet.edu' });
      if (!testUser) {
        testUser = new User({
          name: 'Gate Test Student',
          email: 'test.gate@kiet.edu',
          password: 'hashedpassword123',
          role: 'student',
          rollNumber: 'GATE001',
          phoneNumber: '9876543210',
          parentPhoneNumber: '9876543211',
          hostelBlock: 'D-Block',
          floor: '1st Floor',
          roomNumber: '101',
          branch: 'Computer Science',
          semester: 3
        });
        await testUser.save();
        console.log('✅ Created test user:', testUser.name);
      }

      // Create test outing request
      const testRequest = new OutingRequest({
        studentId: testUser._id,
        purpose: 'Gate Testing',
        outingDate: new Date().toISOString().split('T')[0],
        outingTime: '10:00',
        returnTime: '18:00',
        parentPhoneNumber: testUser.parentPhoneNumber,
        hostelBlock: testUser.hostelBlock,
        floor: testUser.floor,
        status: 'approved',
        currentLevel: 'completed',
        approvalFlags: {
          floorIncharge: { isApproved: true, timestamp: new Date() },
          hostelIncharge: { isApproved: true, timestamp: new Date() },
          warden: { isApproved: true, timestamp: new Date() }
        }
      });

      await testRequest.save();
      await testRequest.generateOutgoingQR();
      
      console.log('✅ Created test QR:', testRequest.qrCode.outgoing.qrId);
      console.log('📱 QR Data:', testRequest.qrCode.outgoing.data);
      
      requests.push(testRequest);
    }

    // 2. Display existing QR codes
    console.log('\n=== AVAILABLE QR CODES FOR TESTING ===');
    requests.forEach((request, index) => {
      console.log(`\n${index + 1}. Request ID: ${request._id}`);
      console.log(`   Student: ${request.studentId?.name || 'Unknown'}`);
      console.log(`   Roll: ${request.studentId?.rollNumber || 'Unknown'}`);
      
      if (request.qrCode.outgoing?.qrId) {
        console.log(`   🔴 OUTGOING QR: ${request.qrCode.outgoing.qrId}`);
        console.log(`      Expired: ${request.qrCode.outgoing.isExpired}`);
        console.log(`      Valid Until: ${request.qrCode.outgoing.validUntil}`);
        console.log(`      Full JSON: ${request.qrCode.outgoing.data}`);
      }
      
      if (request.qrCode.incoming?.qrId) {
        console.log(`   🟢 INCOMING QR: ${request.qrCode.incoming.qrId}`);
        console.log(`      Expired: ${request.qrCode.incoming.isExpired}`);
        console.log(`      Valid Until: ${request.qrCode.incoming.validUntil}`);
      }
    });

    // 3. Test QR lookup
    console.log('\n=== TESTING QR LOOKUP ===');
    const testQrId = requests[0]?.qrCode?.outgoing?.qrId;
    if (testQrId) {
      console.log(`Testing lookup for QR: ${testQrId}`);
      const foundRequest = await OutingRequest.findByQRId(testQrId);
      
      if (foundRequest) {
        console.log('✅ QR lookup successful');
        console.log('   Found student:', foundRequest.studentId?.name);
        console.log('   Has scanQR method:', typeof foundRequest.scanQR === 'function');
      } else {
        console.log('❌ QR lookup failed');
      }
    }

    // 4. Test JSON parsing (simulating frontend)
    console.log('\n=== TESTING JSON PARSING ===');
    if (requests[0]?.qrCode?.outgoing?.data) {
      const qrData = requests[0].qrCode.outgoing.data;
      console.log('Raw QR Data:', qrData);
      
      try {
        const parsed = JSON.parse(qrData);
        console.log('✅ JSON parsing successful');
        console.log('   QR ID from JSON:', parsed.qrId);
        console.log('   Type:', parsed.type);
        console.log('   Student Name:', parsed.student?.name);
      } catch (error) {
        console.log('❌ JSON parsing failed:', error.message);
      }
    }

    console.log('\n🎯 READY FOR TESTING!');
    console.log('Copy one of the QR IDs above and paste it in the Gate Dashboard input field.');
    console.log('Or copy the full JSON data for more comprehensive testing.');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the debug script
debugGateScan();