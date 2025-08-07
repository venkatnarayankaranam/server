require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

async function quickFreshQR() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find an existing approved request
    const existingRequest = await OutingRequest.findOne({ status: 'approved' }).populate('studentId');
    if (!existingRequest) {
      console.log('❌ No approved requests found');
      return;
    }
    
    console.log('📋 Found existing request:', existingRequest._id);
    console.log('👤 Student:', existingRequest.studentId?.name);
    
    // Update it with fresh QR codes for today
    const today = new Date();
    const currentTime = new Date();
    const futureTime = new Date(currentTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
    
    // Generate fresh QR IDs
    const outgoingQRId = `OUT_${existingRequest._id}_${Date.now()}`;
    const incomingQRId = `IN_${existingRequest._id}_${Date.now() + 1000}`;
    
    // Create valid QR codes that expire in 4 hours
    existingRequest.qrCode = {
      outgoing: {
        qrId: outgoingQRId,
        data: 'placeholder',
        generatedAt: new Date(),
        isExpired: false,
        validUntil: futureTime
      },
      incoming: {
        qrId: incomingQRId,
        data: 'placeholder', 
        generatedAt: new Date(),
        isExpired: false,
        validUntil: futureTime
      }
    };
    
    // Update times to be current
    existingRequest.outingDate = today.toISOString().split('T')[0];
    existingRequest.outingTime = currentTime.toTimeString().slice(0, 5);
    existingRequest.returnTime = futureTime.toTimeString().slice(0, 5);
    
    await existingRequest.save();
    
    console.log('🎯 Fresh QR codes created!');
    console.log('🟢 OUTGOING QR:', outgoingQRId);
    console.log('🔵 INCOMING QR:', incomingQRId);
    console.log('⏰ Valid until:', futureTime.toLocaleString());
    console.log('');
    console.log('📱 Test these QR codes in Gate Dashboard!');
    
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

quickFreshQR();