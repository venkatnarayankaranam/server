require('dotenv').config();
const mongoose = require('mongoose');

const checkWardens = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🔍 CHECKING ALL WARDENS\n');

    const usersCollection = mongoose.connection.db.collection('users');
    const wardens = await usersCollection.find({ role: 'warden' }).toArray();
    
    console.log(`Found ${wardens.length} wardens:`);
    wardens.forEach((warden, index) => {
      console.log(`\n${index + 1}. ${warden.name}`);
      console.log(`   Email: ${warden.email}`);
      console.log(`   Assigned Blocks: ${JSON.stringify(warden.assignedBlocks)}`);
      console.log(`   Hostel Block: ${warden.hostelBlock || 'undefined'}`);
      console.log(`   Created: ${warden.createdAt}`);
    });

    console.log('\n📋 EXPECTED WARDENS:');
    console.log('1. warden.d@kietgroup.com (D-Block)');
    console.log('2. warden.e@kietgroup.com (E-Block)');
    console.log('3. warden.w@kietgroup.com (W-Block)');

    // Check for duplicates or incorrect wardens
    const expectedEmails = ['warden.d@kietgroup.com', 'warden.e@kietgroup.com', 'warden.w@kietgroup.com'];
    const actualEmails = wardens.map(w => w.email);
    
    console.log('\n🔍 ANALYSIS:');
    const extraWardens = actualEmails.filter(email => !expectedEmails.includes(email));
    const missingWardens = expectedEmails.filter(email => !actualEmails.includes(email));
    
    if (extraWardens.length > 0) {
      console.log(`❌ Extra wardens found: ${extraWardens.join(', ')}`);
    }
    
    if (missingWardens.length > 0) {
      console.log(`❌ Missing wardens: ${missingWardens.join(', ')}`);
    }

    if (extraWardens.length === 0 && missingWardens.length === 0) {
      console.log('✅ All wardens are correct');
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error checking wardens:', error);
    process.exit(1);
  }
};

checkWardens();