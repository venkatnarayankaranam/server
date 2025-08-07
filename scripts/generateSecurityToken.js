require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

async function generateSecurityToken() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find the security user
    const securityUser = await User.findOne({ email: 'security@kietgroup.com' });
    
    if (!securityUser) {
      console.log('❌ Security user not found. Creating one...');
      
      // Create security user if it doesn't exist
      const newSecurityUser = new User({
        name: 'Security Guard',
        email: 'security@kietgroup.com',
        password: 'Security@2026', // This should be hashed in production
        role: 'security',
        hostelBlock: 'Main Gate',
        floor: ['Ground']
      });
      
      await newSecurityUser.save();
      console.log('✅ Security user created');
      
      // Generate token for new user
      const token = jwt.sign(
        {
          id: newSecurityUser._id,
          email: newSecurityUser.email,
          role: newSecurityUser.role
        },
        process.env.JWT_SECRET || 'OutingApplication@2026',
        { expiresIn: '7d' }
      );
      
      console.log('\n🎫 Generated Token:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(token);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.log('\n📋 Instructions:');
      console.log('1. Copy the token above');
      console.log('2. Open browser DevTools (F12)');
      console.log('3. Go to Console tab');
      console.log('4. Run this command:');
      console.log(`   localStorage.setItem('token', '${token}');`);
      console.log('5. Refresh the page');
      
      return token;
    }
    
    // Generate token for existing user
    const token = jwt.sign(
      {
        id: securityUser._id,
        email: securityUser.email,
        role: securityUser.role
      },
      process.env.JWT_SECRET || 'OutingApplication@2026',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Security user found:', {
      id: securityUser._id,
      email: securityUser.email,
      role: securityUser.role
    });
    
    console.log('\n🎫 Generated Token:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(token);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n📋 Instructions:');
    console.log('1. Copy the token above');
    console.log('2. Open browser DevTools (F12)');
    console.log('3. Go to Console tab');
    console.log('4. Run this command:');
    console.log(`   localStorage.setItem('token', '${token}');`);
    console.log('5. Refresh the page');
    
    // Verify the token
    console.log('\n🔍 Token Verification:');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'OutingApplication@2026');
      console.log('✅ Token is valid:', decoded);
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
    }
    
    return token;
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

generateSecurityToken();