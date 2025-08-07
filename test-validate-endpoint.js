const axios = require('axios');

async function testValidateEndpoint() {
  try {
    console.log('Testing /gate/qr/validate endpoint...');
    
    const response = await axios.post('http://localhost:5000/gate/qr/validate', {
      qrData: 'test-qr-data'
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail due to auth, but should give us 401 not 404
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Success:', response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('✅ Endpoint exists! (Auth error expected)');
      } else if (error.response.status === 404) {
        console.log('❌ Endpoint not found!');
      } else {
        console.log('✅ Endpoint exists with status:', error.response.status);
      }
    } else {
      console.error('Request error:', error.message);
    }
  }
}

testValidateEndpoint();