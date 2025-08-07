require('dotenv').config();
const mongoose = require('mongoose');

const correctBlockStructure = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🔧 CORRECTING BLOCK STRUCTURE - D/E BLOCKS (BOYS) + W BLOCK (WOMEN)\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // First, let's see the current distribution
    console.log('📊 CURRENT BLOCK DISTRIBUTION:');
    const currentBlocks = await studentsCollection.aggregate([
      { $group: { _id: '$hostelBlock', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    currentBlocks.forEach(block => {
      console.log(`"${block._id}": ${block.count} students`);
    });

    // Check if there are any students that should be in Women's block
    // Look for patterns that might indicate women students (names, emails, etc.)
    console.log('\n🔍 ANALYZING STUDENT PATTERNS FOR GENDER CLASSIFICATION:');
    
    // Sample some students to check for patterns
    const sampleStudents = await studentsCollection.find().limit(20).toArray();
    console.log('\nSample student names and emails:');
    sampleStudents.forEach((student, index) => {
      console.log(`${index + 1}. ${student.name} (${student.email}) - Block: ${student.hostelBlock}`);
    });

    // For now, let's assume E-Block students should remain as boys
    // and we need to identify which students should be in W-Block
    console.log('\n📋 CURRENT UNDERSTANDING:');
    console.log('✅ D-Block: Boys Hostel');
    console.log('✅ E-Block: Boys Hostel'); 
    console.log('❓ W-Block: Women\'s Hostel (needs to be identified)');

    console.log('\n⚠️  MANUAL CLASSIFICATION NEEDED:');
    console.log('Since gender information is not explicitly stored, we need to:');
    console.log('1. Identify which students belong to Women\'s hostel');
    console.log('2. Update their hostelBlock to "W-Block"');
    console.log('3. Create W-Block staff (instead of E-Block staff for women)');

    console.log('\n🔧 PROPOSED ACTIONS:');
    console.log('1. Keep D-Block as is (Boys)');
    console.log('2. Keep E-Block as is (Boys)'); 
    console.log('3. Identify and move women students to W-Block');
    console.log('4. Create staff for all three blocks: D, E, W');

    // Check floor distribution for each block
    console.log('\n🏠 FLOOR DISTRIBUTION BY CURRENT BLOCKS:');
    const floorStats = await studentsCollection.aggregate([
      { $group: { _id: { block: '$hostelBlock', floor: '$floor' }, count: { $sum: 1 } } },
      { $sort: { '_id.block': 1, '_id.floor': 1 } }
    ]).toArray();

    let currentBlock = '';
    floorStats.forEach(item => {
      if (item._id.block !== currentBlock) {
        currentBlock = item._id.block;
        console.log(`\n${currentBlock}:`);
      }
      console.log(`  ${item._id.floor || 'undefined'}: ${item.count} students`);
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error analyzing block structure:', error);
    process.exit(1);
  }
};

correctBlockStructure();