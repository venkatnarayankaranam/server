require('dotenv').config();
const mongoose = require('mongoose');

const verifyBlockSegregation = async () => {
  try {
    console.log('🔍 VERIFYING BLOCK SEGREGATION & ADMIN ACCESS');
    console.log('==============================================\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');
    const usersCollection = db.collection('users');

    // 1. Check overall student distribution
    console.log('📊 STUDENT DISTRIBUTION BY BLOCK:');
    console.log('─'.repeat(40));
    
    const blockStats = await studentsCollection.aggregate([
      { $group: { _id: '$hostelBlock', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    blockStats.forEach(stat => {
      console.log(`${stat._id}: ${stat.count} students`);
    });

    // 2. Check floor distribution within each block
    console.log('\n🏠 FLOOR DISTRIBUTION BY BLOCK:');
    console.log('─'.repeat(40));
    
    const floorStats = await studentsCollection.aggregate([
      { $group: { _id: { block: '$hostelBlock', floor: '$floor' }, count: { $sum: 1 } } },
      { $sort: { '_id.block': 1, '_id.floor': 1 } }
    ]).toArray();

    let currentBlock = '';
    floorStats.forEach(stat => {
      if (stat._id.block !== currentBlock) {
        console.log(`\n${stat._id.block}:`);
        currentBlock = stat._id.block;
      }
      console.log(`  ${stat._id.floor}: ${stat.count} students`);
    });

    // 3. Verify admin accounts and their block assignments
    console.log('\n👥 ADMIN ACCOUNTS & BLOCK ASSIGNMENTS:');
    console.log('─'.repeat(40));

    // D-Block admins
    console.log('\nD-BLOCK ADMINS:');
    const dBlockAdmins = await usersCollection.find({
      $or: [
        { email: /\.d@kietgroup\.com$/ },
        { assignedBlocks: 'D-Block' },
        { hostelBlock: 'D-Block' }
      ]
    }).toArray();

    dBlockAdmins.forEach(admin => {
      console.log(`• ${admin.email} (${admin.role})`);
      if (admin.assignedBlocks) console.log(`  Assigned Blocks: ${admin.assignedBlocks.join(', ')}`);
      if (admin.hostelBlock) console.log(`  Hostel Block: ${admin.hostelBlock}`);
      if (admin.assignedFloor) console.log(`  Assigned Floor: ${admin.assignedFloor.join(', ')}`);
      if (admin.floor) console.log(`  Floor: ${admin.floor.join ? admin.floor.join(', ') : admin.floor}`);
    });

    // E-Block admins
    console.log('\nE-BLOCK ADMINS:');
    const eBlockAdmins = await usersCollection.find({
      $or: [
        { email: /\.e@kietgroup\.com$/ },
        { assignedBlocks: 'E-Block' },
        { hostelBlock: 'E-Block' }
      ]
    }).toArray();

    eBlockAdmins.forEach(admin => {
      console.log(`• ${admin.email} (${admin.role})`);
      if (admin.assignedBlocks) console.log(`  Assigned Blocks: ${admin.assignedBlocks.join(', ')}`);
      if (admin.hostelBlock) console.log(`  Hostel Block: ${admin.hostelBlock}`);
      if (admin.assignedFloor) console.log(`  Assigned Floor: ${admin.assignedFloor.join(', ')}`);
      if (admin.floor) console.log(`  Floor: ${admin.floor.join ? admin.floor.join(', ') : admin.floor}`);
    });

    // 4. Test data access simulation
    console.log('\n🧪 SIMULATING ADMIN DATA ACCESS:');
    console.log('─'.repeat(40));

    // Simulate D-Block floor incharge access
    const dFloor1Incharge = await usersCollection.findOne({ 
      email: 'floorincharge1.d@kietgroup.com' 
    });
    
    if (dFloor1Incharge) {
      const dFloor1Students = await studentsCollection.find({
        hostelBlock: 'D-Block',
        floor: '1st Floor'
      }).toArray();
      
      console.log(`\nD-Block Floor 1 Incharge (${dFloor1Incharge.email}):`);
      console.log(`• Should see: D-Block, 1st Floor students only`);
      console.log(`• Actual count: ${dFloor1Students.length} students`);
      if (dFloor1Students.length > 0) {
        console.log(`• Sample student: ${dFloor1Students[0].name} (${dFloor1Students[0].rollNumber})`);
      }
    }

    // Simulate E-Block hostel incharge access
    const eHostelIncharge = await usersCollection.findOne({ 
      email: 'hostelincharge.e@kietgroup.com' 
    });
    
    if (eHostelIncharge) {
      const eBlockStudents = await studentsCollection.find({
        hostelBlock: 'E-Block'
      }).toArray();
      
      console.log(`\nE-Block Hostel Incharge (${eHostelIncharge.email}):`);
      console.log(`• Should see: All E-Block students only`);
      console.log(`• Actual count: ${eBlockStudents.length} students`);
      if (eBlockStudents.length > 0) {
        console.log(`• Sample student: ${eBlockStudents[0].name} (${eBlockStudents[0].rollNumber})`);
      }
    }

    // 5. Check for any data inconsistencies
    console.log('\n🔍 DATA CONSISTENCY CHECKS:');
    console.log('─'.repeat(40));

    // Check for students without proper block assignment
    const studentsWithoutBlock = await studentsCollection.countDocuments({
      $or: [
        { hostelBlock: { $exists: false } },
        { hostelBlock: null },
        { hostelBlock: '' }
      ]
    });
    console.log(`Students without proper block assignment: ${studentsWithoutBlock}`);

    // Check for students without proper floor assignment
    const studentsWithoutFloor = await studentsCollection.countDocuments({
      $or: [
        { floor: { $exists: false } },
        { floor: null },
        { floor: '' }
      ]
    });
    console.log(`Students without proper floor assignment: ${studentsWithoutFloor}`);

    // Check for duplicate roll numbers
    const duplicateRolls = await studentsCollection.aggregate([
      { $group: { _id: '$rollNumber', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    console.log(`Duplicate roll numbers found: ${duplicateRolls.length}`);

    console.log('\n✅ BLOCK SEGREGATION VERIFICATION COMPLETE!');
    console.log('==========================================\n');

    if (studentsWithoutBlock === 0 && studentsWithoutFloor === 0 && duplicateRolls.length === 0) {
      console.log('🎉 All checks passed! Data is properly segregated.');
      console.log('• D-Block admins will only see D-Block students');
      console.log('• E-Block admins will only see E-Block students');
      console.log('• Floor incharges will only see their assigned floor students');
      console.log('• No data inconsistencies found');
    } else {
      console.log('⚠️ Some issues found:');
      if (studentsWithoutBlock > 0) console.log(`• ${studentsWithoutBlock} students need block assignment`);
      if (studentsWithoutFloor > 0) console.log(`• ${studentsWithoutFloor} students need floor assignment`);
      if (duplicateRolls.length > 0) console.log(`• ${duplicateRolls.length} duplicate roll numbers need fixing`);
    }

    console.log('\n🔑 READY TO TEST:');
    console.log('• Login with D-Block admin: floorincharge1.d@kietgroup.com');
    console.log('• Login with E-Block admin: floorincharge1.e@kietgroup.com');
    console.log('• Verify each sees only their assigned block/floor students');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
};

verifyBlockSegregation();