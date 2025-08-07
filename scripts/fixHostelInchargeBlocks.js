require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const fixHostelInchargeBlocks = async () => {
  try {
    console.log('🔧 FIXING HOSTEL INCHARGE BLOCK ASSIGNMENTS');
    console.log('============================================\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('✅ Connected to MongoDB\n');

    // Check current hostel incharge users
    console.log('📋 Current Hostel Incharge Users:');
    console.log('─'.repeat(40));
    
    const hostelIncharges = await User.find({ role: 'hostel-incharge' });
    
    hostelIncharges.forEach(user => {
      console.log(`• ${user.email}`);
      console.log(`  Current assignedBlocks: ${JSON.stringify(user.assignedBlocks)}`);
      console.log(`  Current hostelBlock: ${user.hostelBlock}`);
    });

    // Update D-Block hostel incharge
    console.log('\n🏢 Updating D-Block Hostel Incharge...');
    const dHostelIncharge = await User.findOneAndUpdate(
      { email: 'hostelincharge.d@kietgroup.com' },
      { 
        $set: { 
          assignedBlocks: ['D-Block'],
          hostelBlock: 'D-Block' // Also ensure hostelBlock is set
        }
      },
      { new: true }
    );

    if (dHostelIncharge) {
      console.log(`✅ Updated ${dHostelIncharge.email}:`);
      console.log(`  New assignedBlocks: ${JSON.stringify(dHostelIncharge.assignedBlocks)}`);
      console.log(`  New hostelBlock: ${dHostelIncharge.hostelBlock}`);
    } else {
      console.log('❌ D-Block hostel incharge not found');
    }

    // Update E-Block hostel incharge
    console.log('\n🏢 Updating E-Block Hostel Incharge...');
    const eHostelIncharge = await User.findOneAndUpdate(
      { email: 'hostelincharge.e@kietgroup.com' },
      { 
        $set: { 
          assignedBlocks: ['E-Block'],
          hostelBlock: 'E-Block' // Also ensure hostelBlock is set
        }
      },
      { new: true }
    );

    if (eHostelIncharge) {
      console.log(`✅ Updated ${eHostelIncharge.email}:`);
      console.log(`  New assignedBlocks: ${JSON.stringify(eHostelIncharge.assignedBlocks)}`);
      console.log(`  New hostelBlock: ${eHostelIncharge.hostelBlock}`);
    } else {
      console.log('❌ E-Block hostel incharge not found');
    }

    // Also check and fix any women's block hostel incharge if exists
    console.log('\n🏢 Checking for Women\'s Block Hostel Incharge...');
    const wHostelIncharge = await User.findOneAndUpdate(
      { 
        $or: [
          { email: 'hostelincharge.w@kietgroup.com' },
          { email: 'hostelincharge.women@kietgroup.com' }
        ]
      },
      { 
        $set: { 
          assignedBlocks: ['W-Block'],
          hostelBlock: 'W-Block'
        }
      },
      { new: true }
    );

    if (wHostelIncharge) {
      console.log(`✅ Updated ${wHostelIncharge.email}:`);
      console.log(`  New assignedBlocks: ${JSON.stringify(wHostelIncharge.assignedBlocks)}`);
      console.log(`  New hostelBlock: ${wHostelIncharge.hostelBlock}`);
    } else {
      console.log('ℹ️  Women\'s block hostel incharge not found (this is okay)');
    }

    console.log('\n🔍 Verification - Final Hostel Incharge Assignments:');
    console.log('─'.repeat(50));
    
    const updatedHostelIncharges = await User.find({ role: 'hostel-incharge' });
    updatedHostelIncharges.forEach(user => {
      console.log(`• ${user.email}`);
      console.log(`  assignedBlocks: ${JSON.stringify(user.assignedBlocks)}`);
      console.log(`  hostelBlock: ${user.hostelBlock}`);
      console.log('');
    });

    console.log('✅ HOSTEL INCHARGE BLOCK ASSIGNMENTS FIXED!');
    console.log('===========================================\n');

    console.log('🧪 NEXT STEPS:');
    console.log('1. Restart your server to apply the auth middleware changes');
    console.log('2. Clear browser localStorage/cookies to force new login');
    console.log('3. Login with hostelincharge.d@kietgroup.com');
    console.log('4. Verify you only see D-Block students');
    console.log('5. Login with hostelincharge.e@kietgroup.com');
    console.log('6. Verify you only see E-Block students');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
};

fixHostelInchargeBlocks();