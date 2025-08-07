require('dotenv').config();
const mongoose = require('mongoose');

const fixStudentDataIssues = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🔧 FIXING STUDENT DATA ISSUES\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // Find the problematic student record
    const problemStudent = await studentsCollection.findOne({
      $or: [
        { floor: { $exists: false } },
        { floor: null },
        { floor: '' },
        { roomNumber: { $exists: false } },
        { roomNumber: null },
        { roomNumber: '' }
      ]
    });

    if (problemStudent) {
      console.log('🔍 Found problematic student record:');
      console.log(`Name: ${problemStudent.name}`);
      console.log(`Email: ${problemStudent.email}`);
      console.log(`Role: ${problemStudent.role}`); 
      console.log(`Current Floor: ${problemStudent.floor || 'MISSING'}`);
      console.log(`Current Room: ${problemStudent.roomNumber || 'MISSING'}\n`);

      // Check if this is actually a staff member or misplaced record
      if (problemStudent.name === 'FLOOR INCHARGE' || problemStudent.role !== 'student') {
        console.log('⚠️  This appears to be a staff record in the students collection');
        console.log('📝 Removing from students collection...');
        
        await studentsCollection.deleteOne({ _id: problemStudent._id });
        console.log('✅ Removed non-student record from students collection');
      } else {
        console.log('🔧 This is a legitimate student - assigning default values...');
        
        // Assign to a default floor/room based on their block
        const defaultFloor = '1st Floor'; // Default to 1st floor
        const defaultRoom = problemStudent.hostelBlock === 'D-Block' ? 'D-DEFAULT' : 'E-DEFAULT';
        
        await studentsCollection.updateOne(
          { _id: problemStudent._id },
          { 
            $set: { 
              floor: defaultFloor,
              roomNumber: defaultRoom
            }
          }
        );
        
        console.log(`✅ Updated student with default values:`);
        console.log(`   Floor: ${defaultFloor}`);
        console.log(`   Room: ${defaultRoom}`);
      }
    } else {
      console.log('✅ No problematic student records found');
    }

    // Final validation
    console.log('\n📊 FINAL VALIDATION:');
    const totalStudents = await studentsCollection.countDocuments();
    const validStudents = await studentsCollection.countDocuments({
      name: { $exists: true, $ne: null, $ne: '' },
      email: { $exists: true, $ne: null, $ne: '' },
      rollNumber: { $exists: true, $ne: null, $ne: '' },
      hostelBlock: { $in: ['D-Block', 'E-Block'] },
      floor: { $exists: true, $ne: null, $ne: '' },
      roomNumber: { $exists: true, $ne: null, $ne: '' }
    });

    console.log(`Total students: ${totalStudents}`);
    console.log(`Valid students: ${validStudents}`);
    console.log(`Coverage: ${((validStudents / totalStudents) * 100).toFixed(1)}%`);

    if (validStudents === totalStudents) {
      console.log('\n🎉 ALL STUDENT DATA IS NOW PERFECT!');
      console.log('✅ Every student can be properly mapped through the approval hierarchy');
    } else {
      console.log(`\n⚠️  Still ${totalStudents - validStudents} students need attention`);
    }

    // Show final distribution
    console.log('\n🏢 FINAL BLOCK DISTRIBUTION:');
    const finalStats = await studentsCollection.aggregate([
      { $group: { _id: { block: '$hostelBlock', floor: '$floor' }, count: { $sum: 1 } } },
      { $sort: { '_id.block': 1, '_id.floor': 1 } }
    ]).toArray();

    let dBlockTotal = 0;
    let eBlockTotal = 0;

    finalStats.forEach(stat => {
      const block = stat._id.block;
      const floor = stat._id.floor;
      const count = stat.count;
      
      console.log(`${block} - ${floor}: ${count} students`);
      
      if (block === 'D-Block') dBlockTotal += count;
      if (block === 'E-Block') eBlockTotal += count;
    });

    console.log(`\nD-Block Total: ${dBlockTotal} students`);
    console.log(`E-Block Total: ${eBlockTotal} students`);
    console.log(`Grand Total: ${dBlockTotal + eBlockTotal} students`);

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error fixing student data:', error);
    process.exit(1);
  }
};

fixStudentDataIssues();