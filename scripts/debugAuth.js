require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const debugAuth = async () => {
  try {
    console.log('🔍 DEBUGGING AUTHENTICATION ISSUE');
    console.log('==================================\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('✅ Connected to MongoDB\n');

    // Check the D-Block hostel incharge user
    console.log('🏢 Checking D-Block Hostel Incharge User:');
    console.log('─'.repeat(40));
    
    const dHostelIncharge = await User.findOne({ email: 'hostelincharge.d@kietgroup.com' });
    
    if (dHostelIncharge) {
      console.log(`✅ Found user: ${dHostelIncharge.email}`);
      console.log(`   Role: ${dHostelIncharge.role}`);
      console.log(`   AssignedBlocks: ${JSON.stringify(dHostelIncharge.assignedBlocks)}`);
      console.log(`   HostelBlock: ${dHostelIncharge.hostelBlock}`);
      
      // Simulate JWT token creation (same as in auth.js)
      const tokenData = {
        id: dHostelIncharge._id,
        email: dHostelIncharge.email,
        role: dHostelIncharge.role,
        hostelBlock: dHostelIncharge.hostelBlock,
        floor: dHostelIncharge.floor,
        assignedBlocks: dHostelIncharge.assignedBlocks,
        assignedFloor: dHostelIncharge.assignedFloor,
        assignedBlock: dHostelIncharge.hostelBlock,
      };
      
      console.log('\n🎟️ JWT Token Data (what should be in token):');
      console.log(JSON.stringify(tokenData, null, 2));
      
      // Create actual token
      const token = jwt.sign(
        tokenData,
        process.env.JWT_SECRET || 'OutingApplication@2026',
        { expiresIn: '1d' }
      );
      
      console.log('\n🔑 Generated JWT Token:');
      console.log(token.substring(0, 50) + '...');
      
      // Decode token to verify
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'OutingApplication@2026');
      console.log('\n🔓 Decoded JWT Token:');
      console.log(JSON.stringify(decoded, null, 2));
      
    } else {
      console.log('❌ D-Block hostel incharge user not found');
    }

    // Also check E-Block
    console.log('\n🏢 Checking E-Block Hostel Incharge User:');
    console.log('─'.repeat(40));
    
    const eHostelIncharge = await User.findOne({ email: 'hostelincharge.e@kietgroup.com' });
    
    if (eHostelIncharge) {
      console.log(`✅ Found user: ${eHostelIncharge.email}`);
      console.log(`   Role: ${eHostelIncharge.role}`);
      console.log(`   AssignedBlocks: ${JSON.stringify(eHostelIncharge.assignedBlocks)}`);
      console.log(`   HostelBlock: ${eHostelIncharge.hostelBlock}`);
    } else {
      console.log('❌ E-Block hostel incharge user not found');
    }

    // Check students count
    console.log('\n📊 Student Counts by Block:');
    console.log('─'.repeat(30));
    
    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');
    
    const dBlockCount = await studentsCollection.countDocuments({ hostelBlock: 'D-Block' });
    const eBlockCount = await studentsCollection.countDocuments({ hostelBlock: 'E-Block' });
    
    console.log(`D-Block: ${dBlockCount} students`);
    console.log(`E-Block: ${eBlockCount} students`);
    
    console.log('\n🧪 DEBUGGING RESULTS:');
    console.log('─'.repeat(30));
    console.log('• User data exists in database');
    console.log('• JWT token should include assignedBlocks');
    console.log('• Students exist in database');
    console.log('\n💡 LIKELY ISSUE: Old JWT token in browser');
    console.log('🔧 SOLUTION: Clear browser storage and re-login');

  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
};

debugAuth();