const mongoose = require('mongoose');
require('./models/User'); // Load User model first
const OutingRequest = require('./models/OutingRequest');

mongoose.connect('mongodb://localhost:27017/outing-system').then(async () => {
  console.log('Connected to MongoDB');
  
  // Find some recent QR codes
  const requests = await OutingRequest.find({
    status: 'approved',
    $or: [
      { 'qrCode.outgoing.qrId': { $exists: true } },
      { 'qrCode.incoming.qrId': { $exists: true } }
    ]
  }).populate('studentId', 'name rollNumber').limit(3);
  
  console.log('Found', requests.length, 'requests with QR codes:');
  
  if (requests.length === 0) {
    console.log('No approved requests with QR codes found. Let me check all requests...');
    
    const allRequests = await OutingRequest.find({}).limit(5);
    console.log('Total requests found:', allRequests.length);
    
    allRequests.forEach((req, index) => {
      console.log(`${index + 1}. Status: ${req.status}, Date: ${req.outingDate}`);
      console.log('   Has QR codes:', !!req.qrCode);
      if (req.qrCode) {
        console.log('   - Outgoing QR:', req.qrCode.outgoing?.qrId || 'None');
        console.log('   - Incoming QR:', req.qrCode.incoming?.qrId || 'None');
      }
    });
  } else {
    requests.forEach(req => {
      console.log('- Student:', req.studentId?.name, '| Roll:', req.studentId?.rollNumber);
      console.log('  Outgoing QR:', req.qrCode?.outgoing?.qrId);
      console.log('  Outgoing Expired:', req.qrCode?.outgoing?.isExpired);
      console.log('  Incoming QR:', req.qrCode?.incoming?.qrId);
      console.log('  Incoming Expired:', req.qrCode?.incoming?.isExpired);
      console.log('  Date:', req.outingDate, '| Purpose:', req.purpose);
      console.log('  ---');
    });
    
    // Test the first QR code
    if (requests[0] && requests[0].qrCode?.outgoing?.qrId) {
      const testQrId = requests[0].qrCode.outgoing.qrId;
      console.log('Testing findByQRId with:', testQrId);
      
      const foundRequest = await OutingRequest.findByQRId(testQrId);
      console.log('Found request by QR ID:', !!foundRequest);
      console.log('Request ID matches:', foundRequest?._id.toString() === requests[0]._id.toString());
    }
  }
  
  mongoose.disconnect();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});