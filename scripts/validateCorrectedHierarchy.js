require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const validateCorrectedHierarchy = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🏢 VALIDATING CORRECTED HOSTEL HIERARCHY\n');
    console.log('📋 STRUCTURE:');
    console.log('• D-Block: Boys Hostel');
    console.log('• E-Block: Boys Hostel');
    console.log('• W-Block: Women\'s Hostel\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // Get all staff by block (considering both hostelBlock and assignedBlocks)
    const dBlockStaff = await User.find({ 
      $or: [
        { hostelBlock: 'D-Block' },
        { assignedBlocks: 'D-Block' }
      ]
    });
    const eBlockStaff = await User.find({ 
      $or: [
        { hostelBlock: 'E-Block' },
        { assignedBlocks: 'E-Block' }
      ]
    });
    const wBlockStaff = await User.find({ 
      $or: [
        { hostelBlock: 'W-Block' },
        { assignedBlocks: 'W-Block' }
      ]
    });

    console.log('👥 STAFF SUMMARY BY BLOCK:');
    console.log(`D-Block Staff: ${dBlockStaff.length}`);
    console.log(`E-Block Staff: ${eBlockStaff.length}`);
    console.log(`W-Block Staff: ${wBlockStaff.length}\n`);

    // Detailed staff breakdown
    console.log('🏢 DETAILED STAFF STRUCTURE:\n');

    // D-Block
    console.log('--- D-BLOCK (BOYS HOSTEL) ---');
    const dFloorIncharges = dBlockStaff.filter(s => s.role === 'floor-incharge');
    const dHostelIncharge = dBlockStaff.find(s => s.role === 'hostel-incharge');
    const dWarden = dBlockStaff.find(s => s.role === 'warden');

    console.log(`Floor Incharges: ${dFloorIncharges.length}/4`);
    dFloorIncharges.forEach(fi => console.log(`  ${fi.floor}: ${fi.email}`));
    console.log(`Hostel Incharge: ${dHostelIncharge ? dHostelIncharge.email : 'MISSING'}`);
    console.log(`Warden: ${dWarden ? dWarden.email : 'MISSING'}\n`);

    // E-Block  
    console.log('--- E-BLOCK (BOYS HOSTEL) ---');
    const eFloorIncharges = eBlockStaff.filter(s => s.role === 'floor-incharge');
    const eHostelIncharge = eBlockStaff.find(s => s.role === 'hostel-incharge');
    const eWarden = eBlockStaff.find(s => s.role === 'warden');

    console.log(`Floor Incharges: ${eFloorIncharges.length}/4`);
    eFloorIncharges.forEach(fi => console.log(`  ${fi.floor}: ${fi.email}`));
    console.log(`Hostel Incharge: ${eHostelIncharge ? eHostelIncharge.email : 'MISSING'}`);
    console.log(`Warden: ${eWarden ? eWarden.email : 'MISSING'}\n`);

    // W-Block
    console.log('--- W-BLOCK (WOMEN\'S HOSTEL) ---');
    const wFloorIncharges = wBlockStaff.filter(s => s.role === 'floor-incharge');
    const wHostelIncharge = wBlockStaff.find(s => s.role === 'hostel-incharge');
    const wWarden = wBlockStaff.find(s => s.role === 'warden');

    console.log(`Floor Incharges: ${wFloorIncharges.length}/4`);
    wFloorIncharges.forEach(fi => console.log(`  ${fi.floor}: ${fi.email}`));
    console.log(`Hostel Incharge: ${wHostelIncharge ? wHostelIncharge.email : 'MISSING'}`);
    console.log(`Warden: ${wWarden ? wWarden.email : 'MISSING'}\n`);

    // Student distribution analysis
    console.log('👥 CURRENT STUDENT DISTRIBUTION:');
    const studentStats = await studentsCollection.aggregate([
      { $group: { _id: '$hostelBlock', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    studentStats.forEach(stat => {
      console.log(`${stat._id}: ${stat.count} students`);
    });

    // Note about block mapping
    console.log('\n📝 BLOCK MAPPING STATUS:');
    const dBlockStudents = await studentsCollection.countDocuments({ hostelBlock: 'D-Block' });
    const eBlockStudents = await studentsCollection.countDocuments({ hostelBlock: 'E-Block' });
    const wBlockStudents = await studentsCollection.countDocuments({ hostelBlock: 'W-Block' });

    console.log(`D-Block students: ${dBlockStudents} (Boys)`);
    console.log(`E-Block students: ${eBlockStudents} (Boys)`);
    console.log(`W-Block students: ${wBlockStudents} (Women)`);

    if (wBlockStudents === 0) {
      console.log('\n⚠️  NO WOMEN STUDENTS CURRENTLY IN W-BLOCK');
      console.log('📋 This is expected if all current students are boys');
      console.log('🔧 W-Block staff is ready for when women students are added');
    }

    // Approval workflow examples
    console.log('\n🔄 SAMPLE APPROVAL WORKFLOWS:\n');

    console.log('D-Block Student (Boys) Example:');
    console.log('Student (D-Block, 2nd Floor) → floorincharge2.d@kietgroup.com → hostelincharge.d@kietgroup.com → warden.d@kietgroup.com');

    console.log('\nE-Block Student (Boys) Example:');
    console.log('Student (E-Block, 1st Floor) → floorincharge1.e@kietgroup.com → hostelincharge.e@kietgroup.com → warden.e@kietgroup.com');

    console.log('\nW-Block Student (Women) Example:');
    console.log('Student (W-Block, 3rd Floor) → floorincharge3.w@kietgroup.com → hostelincharge.w@kietgroup.com → warden.w@kietgroup.com');

    // Final validation
    const totalFloorIncharges = dFloorIncharges.length + eFloorIncharges.length + wFloorIncharges.length;
    const totalHostelIncharges = (dHostelIncharge ? 1 : 0) + (eHostelIncharge ? 1 : 0) + (wHostelIncharge ? 1 : 0);
    const totalWardens = (dWarden ? 1 : 0) + (eWarden ? 1 : 0) + (wWarden ? 1 : 0);

    console.log('\n📊 FINAL VALIDATION:');
    console.log(`Total Floor Incharges: ${totalFloorIncharges}/12 (4 per block × 3 blocks)`);
    console.log(`Total Hostel Incharges: ${totalHostelIncharges}/3 (1 per block)`);
    console.log(`Total Wardens: ${totalWardens}/3 (1 per block)`);
    console.log(`Total Staff: ${totalFloorIncharges + totalHostelIncharges + totalWardens}/18`);

    const isComplete = totalFloorIncharges === 12 && totalHostelIncharges === 3 && totalWardens === 3;
    console.log(`\n🏁 HIERARCHY STATUS: ${isComplete ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);

    if (isComplete) {
      console.log('\n🎉 CORRECTED HOSTEL HIERARCHY IS FULLY OPERATIONAL!');
      console.log('✅ D-Block (Boys): Complete staff structure');
      console.log('✅ E-Block (Boys): Complete staff structure'); 
      console.log('✅ W-Block (Women): Complete staff structure');
      console.log('🔄 System ready for all three hostel blocks');
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error validating hierarchy:', error);
    process.exit(1);
  }
};

validateCorrectedHierarchy();