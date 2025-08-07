require('dotenv').config();
const mongoose = require('mongoose');
const QRCode = require('qrcode'); // Required for QR generation
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

async function createFreshTestQR() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find a test student or create one
    let testStudent = await User.findOne({ email: 'venkatnarayan@kietgroup.com' });
    if (!testStudent) {
      console.log('📝 Creating test student...');
      testStudent = new User({
        name: 'Venkat Narayan',
        email: 'venkatnarayan@kietgroup.com',
        password: 'hashedpassword123',
        role: 'student',
        rollNumber: 'TEST123',
        phoneNumber: '9876543210',
        parentPhoneNumber: '9876543211',
        hostelBlock: 'D-Block',
        floor: '2nd Floor',
        roomNumber: '201',
        branch: 'Computer Science',
        semester: 3
      });
      await testStudent.save();
      console.log('✅ Test student created');
    } else {
      console.log('👤 Found existing test student:', testStudent.name);
    }
    
    // Create a fresh outing request for today
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const outingRequest = new OutingRequest({
      studentId: testStudent._id,
      purpose: 'Fresh QR Test - Shopping',
      outingDate: today.toISOString().split('T')[0], // Today's date
      outingTime: '14:00',
      returnTime: '18:00',
      status: 'approved',
      approvedBy: testStudent._id, // Self-approved for testing
      approvedAt: new Date(),
      // Set all required approvals
      approvalFlags: {
        floorIncharge: {
          isApproved: true,
          timestamp: new Date(),
          approvedBy: testStudent._id,
          remarks: 'Test approval'
        },
        hostelIncharge: {
          isApproved: true,
          timestamp: new Date(),
          approvedBy: testStudent._id,
          remarks: 'Test approval'
        },
        warden: {
          isApproved: true,
          timestamp: new Date(),
          approvedBy: testStudent._id,
          remarks: 'Test approval'
        }
      }
    });
    
    // Generate QR codes
    await outingRequest.generateOutgoingQR();
    await outingRequest.generateIncomingQR();
    await outingRequest.save();
    
    console.log('🎫 Fresh test outing request created!');
    console.log('📊 Details:');
    console.log('  Request ID:', outingRequest._id);
    console.log('  Student:', testStudent.name);
    console.log('  Date:', outingRequest.outingDate);
    console.log('  Status:', outingRequest.status);
    console.log('');
    console.log('🎯 Fresh QR Codes:');
    console.log('  🟢 OUTGOING QR:', outingRequest.qrCode.outgoing.qrId);
    console.log('  🔵 INCOMING QR:', outingRequest.qrCode.incoming.qrId);
    console.log('');
    console.log('⏰ Expiry Times:');
    console.log('  Outgoing expires:', outingRequest.qrCode.outgoing.validUntil);
    console.log('  Incoming expires:', outingRequest.qrCode.incoming.validUntil);
    console.log('');
    console.log('📱 Use these QR codes for testing in the Gate Dashboard!');
    
    // Test the scan functionality with fresh QR
    console.log('\n🧪 Testing fresh QR scan...');
    try {
      const result = await outingRequest.scanQR(outingRequest.qrCode.outgoing.qrId, '68863155dfd83433f3e5e775', 'Main Gate');
      console.log('✅ Fresh QR scan result:', result);
    } catch (scanError) {
      console.log('❌ Fresh QR scan error:', scanError.message);
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createFreshTestQR();