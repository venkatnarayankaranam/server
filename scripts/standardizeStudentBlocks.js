require('dotenv').config();
const mongoose = require('mongoose');

const standardizeStudentBlocks = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🔧 STANDARDIZING STUDENT BLOCK NAMES\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // Get current block distribution
    console.log('📊 CURRENT BLOCK DISTRIBUTION:');
    const currentBlocks = await studentsCollection.aggregate([
      { $group: { _id: '$hostelBlock', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    currentBlocks.forEach(block => {
      console.log(`"${block._id}": ${block.count} students`);
    });

    console.log('\n🔄 STANDARDIZING BLOCK NAMES:');

    // Standardize "D BLOCK" to "D-Block"
    const dBlockUpdate = await studentsCollection.updateMany(
      { hostelBlock: 'D BLOCK' },
      { $set: { hostelBlock: 'D-Block' } }
    );
    console.log(`✅ Updated ${dBlockUpdate.modifiedCount} students from "D BLOCK" to "D-Block"`);

    // Standardize "E BLOCK" to "E-Block"
    const eBlockUpdate = await studentsCollection.updateMany(
      { hostelBlock: 'E BLOCK' },
      { $set: { hostelBlock: 'E-Block' } }
    );
    console.log(`✅ Updated ${eBlockUpdate.modifiedCount} students from "E BLOCK" to "E-Block"`);

    // Keep "D-Block" as is (already standardized)
    const dBlockExisting = await studentsCollection.countDocuments({ hostelBlock: 'D-Block' });
    console.log(`ℹ️  ${dBlockExisting} students already have "D-Block" (no change needed)`);

    console.log('\n📊 UPDATED BLOCK DISTRIBUTION:');
    const updatedBlocks = await studentsCollection.aggregate([
      { $group: { _id: '$hostelBlock', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    updatedBlocks.forEach(block => {
      console.log(`"${block._id}": ${block.count} students`);
    });

    // Verify floor distribution by block
    console.log('\n🏠 FLOOR DISTRIBUTION BY BLOCK:');
    const floorByBlock = await studentsCollection.aggregate([
      { $group: { _id: { block: '$hostelBlock', floor: '$floor' }, count: { $sum: 1 } } },
      { $sort: { '_id.block': 1, '_id.floor': 1 } }
    ]).toArray();

    let currentBlock = '';
    floorByBlock.forEach(item => {
      if (item._id.block !== currentBlock) {
        currentBlock = item._id.block;
        console.log(`\n${currentBlock}:`);
      }
      console.log(`  ${item._id.floor || 'undefined'}: ${item.count} students`);
    });

    // Check for any students missing required fields
    console.log('\n⚠️  STUDENTS MISSING CRITICAL FIELDS:');
    
    const missingFloor = await studentsCollection.countDocuments({ 
      $or: [{ floor: { $exists: false } }, { floor: null }, { floor: '' }] 
    });
    console.log(`Missing floor: ${missingFloor} students`);

    const missingRoom = await studentsCollection.countDocuments({ 
      $or: [{ roomNumber: { $exists: false } }, { roomNumber: null }, { roomNumber: '' }] 
    });
    console.log(`Missing roomNumber: ${missingRoom} students`);

    if (missingFloor > 0 || missingRoom > 0) {
      console.log('\n🔍 Sample students with missing fields:');
      const problemStudents = await studentsCollection.find({
        $or: [
          { floor: { $exists: false } },
          { floor: null },
          { floor: '' },
          { roomNumber: { $exists: false } },
          { roomNumber: null },
          { roomNumber: '' }
        ]
      }).limit(5).toArray();

      problemStudents.forEach((student, index) => {
        console.log(`${index + 1}. ${student.name} (${student.rollNumber})`);
        console.log(`   Floor: ${student.floor || 'MISSING'}, Room: ${student.roomNumber || 'MISSING'}`);
      });
    }

    console.log('\n✅ STANDARDIZATION COMPLETE!');
    console.log(`📊 Total students: ${await studentsCollection.countDocuments()}`);
    console.log('🏢 Block format: "D-Block" and "E-Block"');
    console.log('🔄 Ready for hostel hierarchy mapping!');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error standardizing blocks:', error);
    process.exit(1);
  }
};

standardizeStudentBlocks();