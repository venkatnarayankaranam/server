require('dotenv').config();
const mongoose = require('mongoose');

const testAPI = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🧪 TESTING API SETUP\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');
    const usersCollection = db.collection('users');

    // Test student data
    console.log('📊 STUDENTS COLLECTION:');
    const studentCount = await studentsCollection.countDocuments();
    const sampleStudent = await studentsCollection.findOne();
    console.log(`Total students: ${studentCount}`);
    console.log('Sample student:', {
      name: sampleStudent?.name,
      email: sampleStudent?.email,
      rollNumber: sampleStudent?.rollNumber,
      hostelBlock: sampleStudent?.hostelBlock,
      floor: sampleStudent?.floor
    });

    // Test staff data
    console.log('\n👥 STAFF COLLECTION:');
    const floorIncharges = await usersCollection.countDocuments({ role: 'floor-incharge' });
    const hostelIncharges = await usersCollection.countDocuments({ role: 'hostel-incharge' });
    const wardens = await usersCollection.countDocuments({ role: 'warden' });

    console.log(`Floor Incharges: ${floorIncharges}`);
    console.log(`Hostel Incharges: ${hostelIncharges}`);
    console.log(`Wardens: ${wardens}`);

    // Test specific hostel incharge
    console.log('\n🏢 HOSTEL INCHARGE TEST:');
    const dHostelIncharge = await usersCollection.findOne({ email: 'hostelincharge.d@kietgroup.com' });
    console.log('D-Block Hostel Incharge:', {
      email: dHostelIncharge?.email,
      assignedBlocks: dHostelIncharge?.assignedBlocks,
      hostelBlock: dHostelIncharge?.hostelBlock
    });

    // Test floor incharge
    console.log('\n🏠 FLOOR INCHARGE TEST:');
    const floorIncharge = await usersCollection.findOne({ email: 'floorincharge1.d@kietgroup.com' });
    console.log('D-Block Floor Incharge 1:', {
      email: floorIncharge?.email,
      hostelBlock: floorIncharge?.hostelBlock,
      floor: floorIncharge?.floor,
      assignedFloor: floorIncharge?.assignedFloor
    });

    // Test block distribution
    console.log('\n🏢 BLOCK DISTRIBUTION:');
    const dBlock = await studentsCollection.countDocuments({ hostelBlock: 'D-Block' });
    const eBlock = await studentsCollection.countDocuments({ hostelBlock: 'E-Block' });
    const wBlock = await studentsCollection.countDocuments({ hostelBlock: 'W-Block' });

    console.log(`D-Block: ${dBlock} students`);
    console.log(`E-Block: ${eBlock} students`);
    console.log(`W-Block: ${wBlock} students`);

    // Test API simulation
    console.log('\n🔧 API SIMULATION:');
    console.log('1. D-Block Hostel Incharge should see:', dBlock, 'students');
    console.log('2. E-Block Hostel Incharge should see:', eBlock, 'students');
    console.log('3. W-Block Hostel Incharge should see:', wBlock, 'students');

    // Test floor-wise distribution for D-Block
    console.log('\n🏠 D-BLOCK FLOOR DISTRIBUTION:');
    const dBlockFloors = await studentsCollection.aggregate([
      { $match: { hostelBlock: 'D-Block' } },
      { $group: { _id: '$floor', count: { $sum: 1 } } },
      { $sort: { '_id': 1 } }
    ]).toArray();

    dBlockFloors.forEach(floor => {
      console.log(`${floor._id}: ${floor.count} students`);
    });

    console.log('\n✅ API TEST COMPLETE - System should work correctly now!');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error testing API:', error);
    process.exit(1);
  }
};

testAPI();