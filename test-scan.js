const axios = require('axios');

async function testScan() {
  try {
    console.log('Testing scan endpoint...');
    
    // Test QR codes from database
    const testQRs = [
      'OUT_68862b7f40b1ccf3ebe8a767_1753625724669',
      'IN_68862b7f40b1ccf3ebe8a767_1753625724847'
    ];
    
    for (const qrData of testQRs) {
      console.log(`\n=== Testing QR: ${qrData} ===`);
      
      try {
        const response = await axios.post('http://localhost:5000/gate/scan', {
          qrData: qrData,
          location: 'Main Gate'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_TOKEN_HERE' // This will fail but we'll see the error
          }
        });
        
        console.log('Success:', response.data);
      } catch (error) {
        console.log('Error Status:', error.response?.status);
        console.log('Error Message:', error.response?.data?.message);
        console.log('Error Details:', error.response?.data);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testScan();