const mongoose = require('mongoose');
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
  }).populate('studentId', 'name rollNumber').limit(5);
  
  console.log('Found', requests.length, 'requests with QR codes:');
  requests.forEach(req => {
    console.log('- Student:', req.studentId?.name, '| Roll:', req.studentId?.rollNumber);
    console.log('  Outgoing QR:', req.qrCode?.outgoing?.qrId);
    console.log('  Incoming QR:', req.qrCode?.incoming?.qrId);
    console.log('  Date:', req.outingDate, '| Purpose:', req.purpose);
    console.log('  ---');
  });
  
  mongoose.disconnect();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});