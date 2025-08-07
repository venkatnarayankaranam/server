require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const validateHostelHierarchyWithStudents = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🏢 COMPLETE HOSTEL HIERARCHY VALIDATION WITH 600+ STUDENTS\n');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // Get staff counts
    const floorIncharges = await User.find({ role: 'floor-incharge' });
    const hostelIncharges = await User.find({ role: 'hostel-incharge' });
    const wardens = await User.find({ role: 'warden' });
    const totalStudents = await studentsCollection.countDocuments();

    console.log('📊 HIERARCHY OVERVIEW:');
    console.log(`👥 Students: ${totalStudents}`);
    console.log(`🏠 Floor Incharges: ${floorIncharges.length}`);
    console.log(`🏢 Hostel Incharges: ${hostelIncharges.length}`);
    console.log(`👑 Wardens: ${wardens.length}\n`);

    // Analyze staff by block
    const dBlockFloorIncharges = floorIncharges.filter(fi => fi.hostelBlock === 'D-Block');
    const eBlockFloorIncharges = floorIncharges.filter(fi => fi.hostelBlock === 'E-Block');
    const dBlockHostelIncharge = hostelIncharges.find(hi => hi.assignedBlocks?.includes('D-Block'));
    const eBlockHostelIncharge = hostelIncharges.find(hi => hi.assignedBlocks?.includes('E-Block'));
    const dBlockWarden = wardens.find(w => w.email?.includes('.d@'));
    const eBlockWarden = wardens.find(w => w.email?.includes('.e@'));

    console.log('🏢 STAFF STRUCTURE:');
    console.log(`D-Block Floor Incharges: ${dBlockFloorIncharges.length}/4`);
    console.log(`E-Block Floor Incharges: ${eBlockFloorIncharges.length}/4`);
    console.log(`D-Block Hostel Incharge: ${dBlockHostelIncharge ? '✅' : '❌'}`);
    console.log(`E-Block Hostel Incharge: ${eBlockHostelIncharge ? '✅' : '❌'}`);
    console.log(`D-Block Warden: ${dBlockWarden ? '✅' : '❌'}`);
    console.log(`E-Block Warden: ${eBlockWarden ? '✅' : '❌'}\n`);

    // Student distribution analysis
    console.log('👥 STUDENT DISTRIBUTION ANALYSIS:');
    const studentStats = await studentsCollection.aggregate([
      { $group: { _id: { block: '$hostelBlock', floor: '$floor' }, count: { $sum: 1 } } },
      { $sort: { '_id.block': 1, '_id.floor': 1 } }
    ]).toArray();

    let totalMapped = 0;
    let dBlockTotal = 0;
    let eBlockTotal = 0;

    studentStats.forEach(stat => {
      const block = stat._id.block;
      const floor = stat._id.floor;
      const count = stat.count;
      
      if (block === 'D-Block' || block === 'E-Block') {
        totalMapped += count;
        if (block === 'D-Block') dBlockTotal += count;
        if (block === 'E-Block') eBlockTotal += count;
        
        console.log(`${block} - ${floor}: ${count} students`);
      }
    });

    console.log(`\nD-Block Total: ${dBlockTotal} students`);
    console.log(`E-Block Total: ${eBlockTotal} students`);
    console.log(`Properly Mapped: ${totalMapped}/${totalStudents} students`);

    // Coverage analysis - how many students each staff member will handle
    console.log('\n📈 STAFF WORKLOAD ANALYSIS:');
    
    // Floor Incharge workload
    console.log('\nFloor Incharge Workload:');
    const floorWorkload = await studentsCollection.aggregate([
      { $match: { hostelBlock: { $in: ['D-Block', 'E-Block'] } } },
      { $group: { _id: { block: '$hostelBlock', floor: '$floor' }, count: { $sum: 1 } } },
      { $sort: { '_id.block': 1, '_id.floor': 1 } }
    ]).toArray();

    floorWorkload.forEach(workload => {
      const block = workload._id.block;
      const floor = workload._id.floor;
      const count = workload.count;
      const floorNum = floor?.charAt(0);
      const blockCode = block === 'D-Block' ? 'd' : 'e';
      const staffEmail = `floorincharge${floorNum}.${blockCode}@kietgroup.com`;
      
      console.log(`${staffEmail}: ${count} students (${floor}, ${block})`);
    });

    // Hostel Incharge workload
    console.log('\nHostel Incharge Workload:');
    console.log(`hostelincharge.d@kietgroup.com: ${dBlockTotal} students (D-Block)`);
    console.log(`hostelincharge.e@kietgroup.com: ${eBlockTotal} students (E-Block)`);

    // Warden workload
    console.log('\nWarden Workload:');
    console.log(`warden.d@kietgroup.com: ${dBlockTotal} students (D-Block)`);
    console.log(`warden.e@kietgroup.com: ${eBlockTotal} students (E-Block)`);

    // Mapping validation - test if we can find staff for each student group
    console.log('\n🔗 MAPPING VALIDATION:');
    
    const mappingTests = await studentsCollection.aggregate([
      { $match: { hostelBlock: { $in: ['D-Block', 'E-Block'] } } },
      { $group: { 
          _id: { block: '$hostelBlock', floor: '$floor' }, 
          count: { $sum: 1 },
          sampleStudent: { $first: '$$ROOT' }
        }
      },
      { $sort: { '_id.block': 1, '_id.floor': 1 } }
    ]).toArray();

    let successfulMappings = 0;
    let failedMappings = 0;

    for (const test of mappingTests) {
      const block = test._id.block;
      const floor = test._id.floor;
      const count = test.count;
      
      if (!floor || !block) {
        console.log(`❌ ${count} students with missing block/floor data`);
        failedMappings += count;
        continue;
      }
      
      const floorNum = floor.charAt(0);
      const blockCode = block === 'D-Block' ? 'd' : 'e';
      
      // Check if corresponding staff exists
      const floorIncharge = floorIncharges.find(fi => 
        fi.hostelBlock === block && fi.floor === floor
      );
      const hostelIncharge = block === 'D-Block' ? dBlockHostelIncharge : eBlockHostelIncharge;
      const warden = block === 'D-Block' ? dBlockWarden : eBlockWarden;
      
      if (floorIncharge && hostelIncharge && warden) {
        console.log(`✅ ${block} - ${floor}: ${count} students → Complete hierarchy`);
        successfulMappings += count;
      } else {
        console.log(`❌ ${block} - ${floor}: ${count} students → Missing staff`);
        if (!floorIncharge) console.log(`   Missing Floor Incharge for ${floor}`);
        if (!hostelIncharge) console.log(`   Missing Hostel Incharge for ${block}`);
        if (!warden) console.log(`   Missing Warden for ${block}`);
        failedMappings += count;
      }
    }

    // Final summary
    console.log('\n📊 FINAL VALIDATION SUMMARY:');
    console.log(`✅ Students with complete hierarchy: ${successfulMappings}`);
    console.log(`❌ Students with incomplete hierarchy: ${failedMappings}`);
    console.log(`📈 Coverage: ${((successfulMappings / totalStudents) * 100).toFixed(1)}%`);

    const isFullyOperational = (
      successfulMappings === totalMapped &&
      failedMappings === 0 &&
      dBlockFloorIncharges.length === 4 &&
      eBlockFloorIncharges.length === 4 &&
      dBlockHostelIncharge &&
      eBlockHostelIncharge &&
      dBlockWarden &&
      eBlockWarden
    );

    console.log(`\n🏁 SYSTEM STATUS: ${isFullyOperational ? '✅ FULLY OPERATIONAL' : '⚠️  NEEDS ATTENTION'}`);

    if (isFullyOperational) {
      console.log('\n🎉 HOSTEL HIERARCHY IS COMPLETE AND READY FOR PRODUCTION!');
      console.log('📋 All 600+ students can be properly routed through the approval workflow');
      console.log('🔄 Request flow: Student → Floor Incharge → Hostel Incharge → Warden → Approved');
    } else {
      console.log('\n🔧 ACTIONS REQUIRED:');
      if (failedMappings > 0) {
        console.log('1. Fix student data with missing block/floor information');
      }
      if (dBlockFloorIncharges.length < 4) {
        console.log('2. Create missing D-Block floor incharges');
      }
      if (eBlockFloorIncharges.length < 4) {
        console.log('3. Create missing E-Block floor incharges');
      }
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error validating hierarchy:', error);
    process.exit(1);
  }
};

validateHostelHierarchyWithStudents();