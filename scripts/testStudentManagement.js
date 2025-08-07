require('dotenv').config();
const mongoose = require('mongoose');

const testStudentManagement = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🧪 TESTING STUDENT MANAGEMENT API\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');
    const usersCollection = db.collection('users');

    // Simulate the getStudentsByBlocks function for each hostel incharge
    const hostelIncharges = await usersCollection.find({ role: 'hostel-incharge' }).toArray();

    for (const hostelIncharge of hostelIncharges) {
      console.log(`\n🏢 Testing ${hostelIncharge.email}:`);
      console.log(`Assigned Blocks: ${JSON.stringify(hostelIncharge.assignedBlocks)}`);

      // Get students from assigned blocks
      const students = await studentsCollection.find({
        hostelBlock: { $in: hostelIncharge.assignedBlocks }
      }).toArray();

      console.log(`Found ${students.length} students`);

      // Group by blocks
      const groupedStudents = {
        'D-Block': students.filter(s => s.hostelBlock === 'D-Block'),
        'E-Block': students.filter(s => s.hostelBlock === 'E-Block'),
        'W-Block': students.filter(s => s.hostelBlock === 'W-Block')
      };

      // Only show assigned blocks
      const filteredGroups = {};
      hostelIncharge.assignedBlocks.forEach(block => {
        if (groupedStudents[block]) {
          filteredGroups[block] = groupedStudents[block];
        }
      });

      console.log('Results:');
      Object.keys(filteredGroups).forEach(block => {
        console.log(`  ${block}: ${filteredGroups[block].length} students`);
        if (filteredGroups[block].length > 0) {
          console.log(`    Sample: ${filteredGroups[block][0].name} (${filteredGroups[block][0].email})`);
        }
      });
    }

    // Test floor incharge request filtering
    console.log('\n\n🏠 TESTING FLOOR INCHARGE REQUEST FILTERING:\n');

    const floorIncharges = await usersCollection.find({ role: 'floor-incharge' }).limit(3).toArray();

    for (const floorIncharge of floorIncharges) {
      console.log(`\n👤 Testing ${floorIncharge.email}:`);
      console.log(`Block: ${floorIncharge.hostelBlock}, Floor: ${floorIncharge.floor}`);

      // Count students that would be under this floor incharge
      const studentsUnderFloorIncharge = await studentsCollection.countDocuments({
        hostelBlock: floorIncharge.hostelBlock,
        floor: floorIncharge.floor
      });

      console.log(`Students under this floor incharge: ${studentsUnderFloorIncharge}`);

      // Simulate request filtering (no actual requests yet, but showing the logic)
      console.log(`Would see outing requests from: ${floorIncharge.hostelBlock} - ${floorIncharge.floor}`);
    }

    console.log('\n✅ STUDENT MANAGEMENT TEST COMPLETE!');
    console.log('\n📋 EXPECTED BEHAVIOR:');
    console.log('1. D-Block Hostel Incharge sees only D-Block students');
    console.log('2. E-Block Hostel Incharge sees only E-Block students');
    console.log('3. W-Block Hostel Incharge sees only W-Block students (none currently)');
    console.log('4. Floor Incharges see only students from their floor');
    console.log('5. Outing requests route to correct floor incharge based on student floor');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error testing student management:', error);
    process.exit(1);
  }
};

testStudentManagement();