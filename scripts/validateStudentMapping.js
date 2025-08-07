require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const validateStudentMapping = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🔍 Checking student records for proper mapping fields...\n');

    // Find all students
    const students = await User.find({ role: 'student' });
    console.log(`📊 Found ${students.length} student records`);

    if (students.length === 0) {
      console.log('⚠️  No student records found in the database');
      mongoose.connection.close();
      return;
    }

    let validStudents = 0;
    let invalidStudents = 0;
    let missingFields = {
      rollNumber: 0,
      hostelBlock: 0,
      floor: 0,
      roomNumber: 0
    };

    console.log('\n🔍 Analyzing student records...\n');

    for (const student of students) {
      let hasAllFields = true;
      let issues = [];

      // Check required fields for student mapping
      if (!student.rollNumber) {
        hasAllFields = false;
        issues.push('rollNumber');
        missingFields.rollNumber++;
      }

      if (!student.hostelBlock) {
        hasAllFields = false;
        issues.push('hostelBlock');
        missingFields.hostelBlock++;
      }

      if (!student.floor) {
        hasAllFields = false;
        issues.push('floor');
        missingFields.floor++;
      }

      if (!student.roomNumber) {
        hasAllFields = false;
        issues.push('roomNumber');
        missingFields.roomNumber++;
      }

      if (hasAllFields) {
        validStudents++;
      } else {
        invalidStudents++;
        console.log(`❌ ${student.name} (${student.email}) - Missing: ${issues.join(', ')}`);
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`✅ Valid students (all required fields): ${validStudents}`);
    console.log(`❌ Invalid students (missing fields): ${invalidStudents}`);
    
    console.log('\n📋 Missing Fields Breakdown:');
    console.log(`🏷️  rollNumber missing: ${missingFields.rollNumber} students`);
    console.log(`🏢 hostelBlock missing: ${missingFields.hostelBlock} students`);
    console.log(`🏠 floor missing: ${missingFields.floor} students`);
    console.log(`🚪 roomNumber missing: ${missingFields.roomNumber} students`);

    // Sample valid student structure
    const validStudent = students.find(s => s.rollNumber && s.hostelBlock && s.floor && s.roomNumber);
    if (validStudent) {
      console.log('\n✅ Sample Valid Student Structure:');
      console.log({
        name: validStudent.name,
        email: validStudent.email,
        rollNumber: validStudent.rollNumber,
        hostelBlock: validStudent.hostelBlock,
        floor: validStudent.floor,
        roomNumber: validStudent.roomNumber,
        branch: validStudent.branch,
        semester: validStudent.semester
      });
    }

    // Check hostel blocks distribution
    const blockDistribution = {};
    const floorDistribution = {};
    
    students.forEach(student => {
      if (student.hostelBlock) {
        blockDistribution[student.hostelBlock] = (blockDistribution[student.hostelBlock] || 0) + 1;
      }
      if (student.floor) {
        floorDistribution[student.floor] = (floorDistribution[student.floor] || 0) + 1;
      }
    });

    if (Object.keys(blockDistribution).length > 0) {
      console.log('\n🏢 Hostel Block Distribution:');
      Object.entries(blockDistribution).forEach(([block, count]) => {
        console.log(`${block}: ${count} students`);
      });
    }

    if (Object.keys(floorDistribution).length > 0) {
      console.log('\n🏠 Floor Distribution:');
      Object.entries(floorDistribution).forEach(([floor, count]) => {
        console.log(`${floor}: ${count} students`);
      });
    }

    console.log('\n🔧 RECOMMENDATIONS:');
    if (invalidStudents > 0) {
      console.log('1. Update student records to include missing fields');
      console.log('2. Ensure rollNumber is unique for each student');
      console.log('3. Set hostelBlock to either "D-Block" (Men) or "E-Block" (Women)');
      console.log('4. Set floor to one of: "1st Floor", "2nd Floor", "3rd Floor", "4th Floor"');
      console.log('5. Set roomNumber based on actual room assignments');
    } else {
      console.log('✅ All student records have proper mapping fields!');
    }

    console.log('\n🔄 Hierarchical Approval Flow:');
    console.log('Student Request → Floor Incharge (based on floor + block)');
    console.log('                → Hostel Incharge (based on block)');
    console.log('                → Warden (based on block)');
    console.log('                → Final Approval');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error validating student mapping:', error);
    process.exit(1);
  }
};

validateStudentMapping();