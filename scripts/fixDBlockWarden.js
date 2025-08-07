require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const fixDBlockWarden = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🔧 FIXING D-BLOCK WARDEN ASSIGNMENT\n');

    // Check current D-Block warden
    const dWarden = await User.findOne({ email: 'warden.d@kietgroup.com' });
    if (!dWarden) {
      console.log('❌ D-Block warden not found');
      mongoose.connection.close();
      return;
    }

    console.log('Current D-Block warden data:');
    console.log(`Name: ${dWarden.name}`);
    console.log(`Email: ${dWarden.email}`);
    console.log(`Current assignedBlocks: ${JSON.stringify(dWarden.assignedBlocks)}`);

    // Update to have proper assignedBlocks
    const result = await User.updateOne(
      { email: 'warden.d@kietgroup.com' },
      { $set: { assignedBlocks: ['D-Block'] } }
    );

    console.log(`\n✅ Update result: ${result.modifiedCount} document(s) modified`);

    // Verify the update
    const updatedWarden = await User.findOne({ email: 'warden.d@kietgroup.com' });
    console.log('\nUpdated D-Block warden data:');
    console.log(`Name: ${updatedWarden.name}`);
    console.log(`Email: ${updatedWarden.email}`);
    console.log(`Updated assignedBlocks: ${JSON.stringify(updatedWarden.assignedBlocks)}`);

    console.log('\n🎉 D-Block warden fixed successfully!');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error fixing D-Block warden:', error);
    process.exit(1);
  }
};

fixDBlockWarden();