require('dotenv').config();
const mongoose = require('mongoose');

const removeOldWarden = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    console.log('🗑️  REMOVING OLD WARDEN RECORD\n');

    const usersCollection = mongoose.connection.db.collection('users');
    
    // Find the old warden record
    const oldWarden = await usersCollection.findOne({ email: 'warden@kietgroup.com' });
    
    if (oldWarden) {
      console.log('🔍 Found old warden record:');
      console.log(`Name: ${oldWarden.name}`);
      console.log(`Email: ${oldWarden.email}`);
      console.log(`Created: ${oldWarden.createdAt}`);
      console.log(`Assigned Blocks: ${JSON.stringify(oldWarden.assignedBlocks)}`);

      // Remove the old warden
      const deleteResult = await usersCollection.deleteOne({ email: 'warden@kietgroup.com' });
      
      if (deleteResult.deletedCount > 0) {
        console.log('\n✅ Successfully removed old warden record');
      } else {
        console.log('\n❌ Failed to remove old warden record');
      }
    } else {
      console.log('✅ No old warden record found');
    }

    // Verify current wardens
    console.log('\n📊 CURRENT WARDENS AFTER CLEANUP:');
    const currentWardens = await usersCollection.find({ role: 'warden' }).toArray();
    
    currentWardens.forEach((warden, index) => {
      console.log(`${index + 1}. ${warden.email} (${warden.name})`);
    });

    console.log(`\nTotal wardens: ${currentWardens.length} (Expected: 3)`);

    if (currentWardens.length === 3) {
      console.log('🎉 Perfect! Now we have exactly 3 wardens as expected');
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error removing old warden:', error);
    process.exit(1);
  }
};

removeOldWarden();