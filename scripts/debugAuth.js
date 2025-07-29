require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// Mock token from localStorage - you need to replace this with actual token
const testToken = 'REPLACE_WITH_ACTUAL_TOKEN';

async function debugAuth() {
  try {
    console.log('🔍 JWT Secret:', process.env.JWT_SECRET);
    console.log('🔍 Test Token:', testToken.substring(0, 50) + '...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Try to decode the token
    try {
      const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
      console.log('✅ Token decoded successfully:', decoded);
      
      // Check if user exists
      const user = await User.findById(decoded.id) || await User.findOne({ email: decoded.email });
      if (user) {
        console.log('✅ User found:', {
          id: user._id,
          email: user.email,
          role: user.role
        });
      } else {
        console.log('❌ User not found in database');
      }
      
    } catch (jwtError) {
      console.log('❌ JWT Error:', jwtError.message);
      
      // Try to decode without verification to see the payload
      try {
        const decoded = jwt.decode(testToken);
        console.log('🔍 Token payload (unverified):', decoded);
      } catch (decodeError) {
        console.log('❌ Cannot decode token:', decodeError.message);
      }
    }

    // List all users for debugging
    console.log('\n📋 All users in database:');
    const users = await User.find({}, 'email role').limit(10);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
    });

    // Create a fresh token for security user
    console.log('\n🔑 Creating fresh token for security user...');
    const securityUser = await User.findOne({ email: 'security@kietgroup.com' });
    if (securityUser) {
      const freshToken = jwt.sign(
        {
          id: securityUser._id,
          email: securityUser.email,
          role: securityUser.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      console.log('✅ Fresh token generated:');
      console.log(freshToken);
      console.log('\n📋 Copy this token and paste it in your browser localStorage:');
      console.log(`localStorage.setItem('token', '${freshToken}');`);
    } else {
      console.log('❌ Security user not found');
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    mongoose.disconnect();
    process.exit();
  }
}

console.log('🚀 Starting JWT Debug...');
console.log('⚠️  Replace testToken variable with your actual token from browser localStorage');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

debugAuth();