require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

async function testToken() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // The token from the client
    const clientToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODYzMTU1ZGZkODM0MzNmM2U1ZTc3NSIsImVtYWlsIjoic2VjdXJpdHlAa2lldGdyb3VwLmNvbSIsInJvbGUiOiJzZWN1cml0eSIsImlhdCI6MTc1MzcxMzkzNSwiZXhwIjoxNzU0MzE4NzM1fQ.GhlZF90CBJQ0aGcGCTvivn_N-98yl3OslgMzX7WX378';

    console.log('🔍 Environment:');
    console.log('  JWT_SECRET:', process.env.JWT_SECRET);
    console.log('  NODE_ENV:', process.env.NODE_ENV);

    console.log('\n🔑 Token Info:');
    console.log('  Token length:', clientToken.length);
    console.log('  Token starts with:', clientToken.substring(0, 50));

    // Try to decode without verification first
    try {
      const decoded = jwt.decode(clientToken);
      console.log('\n📋 Token Payload (unverified):');
      console.log('  ID:', decoded.id);
      console.log('  Email:', decoded.email);
      console.log('  Role:', decoded.role);
      console.log('  Issued At:', new Date(decoded.iat * 1000));
      console.log('  Expires At:', new Date(decoded.exp * 1000));
      console.log('  Is Expired:', decoded.exp < Date.now() / 1000);
    } catch (decodeError) {
      console.log('❌ Cannot decode token:', decodeError.message);
    }

    // Try to verify the token
    try {
      const verified = jwt.verify(clientToken, process.env.JWT_SECRET);
      console.log('\n✅ Token Verification PASSED');
      console.log('  Verified payload:', verified);

      // Check if user exists
      const user = await User.findById(verified.id);
      if (user) {
        console.log('\n✅ User Found in Database:');
        console.log('  ID:', user._id);
        console.log('  Email:', user.email);
        console.log('  Role:', user.role);
      } else {
        console.log('\n❌ User NOT found in database');
      }

    } catch (verifyError) {
      console.log('\n❌ Token Verification FAILED:', verifyError.message);
      
      // Try with different secrets
      const testSecrets = [
        'OutingApplication@2026',
        process.env.JWT_SECRET,
        'your-secret-key',
        'fallback-secret'
      ];

      for (const secret of testSecrets) {
        try {
          const test = jwt.verify(clientToken, secret);
          console.log(`✅ Token valid with secret: "${secret}"`);
          break;
        } catch (e) {
          console.log(`❌ Failed with secret: "${secret}"`);
        }
      }
    }

    // Simulate the auth middleware flow
    console.log('\n🔄 Simulating Auth Middleware...');
    try {
      // Clean the token like in middleware
      const cleanToken = clientToken.replace('Bearer ', '').trim();
      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
      
      console.log('✅ Auth middleware simulation PASSED');
      console.log('  Role:', decoded.role);
      
      if (decoded.role === 'security' || decoded.role === 'gate') {
        const user = await User.findById(decoded.id) || await User.findOne({ email: decoded.email });
        if (user) {
          console.log('✅ Security user auth would succeed');
          console.log('  Final user object would be:', {
            id: user._id,
            email: decoded.email,
            role: decoded.role
          });
        } else {
          console.log('❌ Security user not found - auth would fail');
        }
      }
      
    } catch (middlewareError) {
      console.log('❌ Auth middleware simulation FAILED:', middlewareError.message);
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    mongoose.disconnect();
  }
}

testToken();