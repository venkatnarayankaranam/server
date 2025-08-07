require('dotenv').config();
const mongoose = require('mongoose');

const fixNonStandardStudent = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🔧 FIXING NON-STANDARD STUDENT RECORD\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // Find the problematic student
    const problemStudent = await studentsCollection.findOne({
      email: 'venkatnarayan@gmail.com'
    });

    if (problemStudent) {
      console.log('🔍 Found problematic student record:');
      console.log(`Name: ${problemStudent.name}`);
      console.log(`Email: ${problemStudent.email}`);
      console.log(`Roll Number: ${problemStudent.rollNumber}`);
      console.log(`Block: ${problemStudent.hostelBlock}`);
      console.log(`Floor: ${problemStudent.floor}`);

      // Update to standard format
      const standardEmail = `${problemStudent.rollNumber}@student.com`.toLowerCase();
      
      console.log(`\n🔧 Updating email to standard format: ${standardEmail}`);
      
      const updateResult = await studentsCollection.updateOne(
        { _id: problemStudent._id },
        { 
          $set: { 
            email: standardEmail,
            username: problemStudent.rollNumber // Ensure username matches roll number
          }
        }
      );

      console.log(`✅ Update result: ${updateResult.modifiedCount} document(s) modified`);
      
      // Verify the update
      const updatedStudent = await studentsCollection.findOne({ _id: problemStudent._id });
      console.log('\n✅ Updated student record:');
      console.log(`Name: ${updatedStudent.name}`);
      console.log(`Email: ${updatedStudent.email}`);
      console.log(`Username: ${updatedStudent.username}`);
      console.log(`Roll Number: ${updatedStudent.rollNumber}`);
    } else {
      console.log('✅ No problematic student record found');
    }

    // Final validation
    console.log('\n📊 FINAL VALIDATION:');
    const totalStudents = await studentsCollection.countDocuments();
    const validStudents = await studentsCollection.countDocuments({
      role: 'student',
      rollNumber: { $exists: true, $ne: null, $ne: '' },
      email: { $regex: /@student\.com$/ }
    });

    console.log(`Total students: ${totalStudents}`);
    console.log(`Valid students: ${validStudents}`);
    console.log(`Coverage: ${((validStudents / totalStudents) * 100).toFixed(1)}%`);

    if (validStudents === totalStudents) {
      console.log('\n🎉 ALL STUDENT RECORDS ARE NOW STANDARDIZED!');
      console.log('✅ All emails follow @student.com format');
      console.log('✅ No non-student records in collection');
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error fixing student record:', error);
    process.exit(1);
  }
};

fixNonStandardStudent();