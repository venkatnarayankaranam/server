require('dotenv').config();
const mongoose = require('mongoose');

const exploreStudentsCluster = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');
    
    console.log('🔍 EXPLORING DATABASE STRUCTURE\n');
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📂 Available collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Check for students collection specifically
    const db = mongoose.connection.db;
    
    try {
      const studentsCount = await db.collection('students').countDocuments();
      console.log(`\n👥 Students collection found with ${studentsCount} documents`);
      
      if (studentsCount > 0) {
        // Get sample student records
        const sampleStudents = await db.collection('students').find().limit(3).toArray();
        console.log('\n📋 Sample student record structures:');
        
        sampleStudents.forEach((student, index) => {
          console.log(`\n--- Student ${index + 1} ---`);
          console.log(JSON.stringify(student, null, 2));
        });

        // Check field distribution
        console.log('\n📊 FIELD ANALYSIS:');
        
        // Check for common fields
        const fieldsToCheck = ['name', 'email', 'rollNumber', 'block', 'floor', 'roomNumber', 'hostelBlock', 'branch', 'semester'];
        
        for (const field of fieldsToCheck) {
          const countWithField = await db.collection('students').countDocuments({ [field]: { $exists: true, $ne: null } });
          const percentage = ((countWithField / studentsCount) * 100).toFixed(1);
          console.log(`${field}: ${countWithField}/${studentsCount} (${percentage}%)`);
        }

        // Check block distribution
        console.log('\n🏢 BLOCK DISTRIBUTION:');
        const blockAggregation = await db.collection('students').aggregate([
          { $group: { _id: '$block', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]).toArray();
        
        blockAggregation.forEach(block => {
          console.log(`${block._id || 'undefined'}: ${block.count} students`);
        });

        // Check floor distribution
        console.log('\n🏠 FLOOR DISTRIBUTION:');
        const floorAggregation = await db.collection('students').aggregate([
          { $group: { _id: '$floor', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]).toArray();
        
        floorAggregation.forEach(floor => {
          console.log(`${floor._id || 'undefined'}: ${floor.count} students`);
        });

        // Check if we need to map blocks to proper format
        console.log('\n🔍 CHECKING BLOCK FORMATS:');
        const uniqueBlocks = await db.collection('students').distinct('block');
        console.log('Unique block values:', uniqueBlocks);

        // Check if hostelBlock field exists
        const hostelBlockCount = await db.collection('students').countDocuments({ hostelBlock: { $exists: true } });
        console.log(`\nStudents with hostelBlock field: ${hostelBlockCount}`);
        
        if (hostelBlockCount > 0) {
          const uniqueHostelBlocks = await db.collection('students').distinct('hostelBlock');
          console.log('Unique hostelBlock values:', uniqueHostelBlocks);
        }
      }
      
    } catch (error) {
      console.log('❌ Students collection not found or error:', error.message);
    }
    
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

exploreStudentsCluster();