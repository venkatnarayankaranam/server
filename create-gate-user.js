const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createGateUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    // Check if gate user already exists
    const existingUser = await User.findOne({ email: 'maingate@kietgroup.com' });
    
    if (existingUser) {
      console.log('✅ Gate user already exists:');
      console.log('   Email:', existingUser.email);
      console.log('   Role:', existingUser.role);
      console.log('   ObjectId:', existingUser._id);
      
      if (existingUser.role !== 'gate') {
        console.log('🔄 Updating role to "gate"...');
        existingUser.role = 'gate';
        await existingUser.save();
        console.log('✅ Role updated successfully');
      }
    } else {
      console.log('🔄 Creating new gate user...');
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('gate123', saltRounds);
      
      // Create gate user
      const gateUser = new User({
        name: 'Main Gate Security',
        email: 'maingate@kietgroup.com',
        password: hashedPassword,
        role: 'gate',
        phoneNumber: '1234567890'
      });
      
      await gateUser.save();
      console.log('✅ Gate user created successfully:');
      console.log('   Email:', gateUser.email);
      console.log('   Role:', gateUser.role);
      console.log('   ObjectId:', gateUser._id);
      console.log('   Password: gate123');
    }
    
    console.log('\n🎉 Gate user setup complete!');
    console.log('🔑 Login credentials:');
    console.log('   Email: maingate@kietgroup.com');
    console.log('   Password: gate123');
    
  } catch (error) {
    console.error('❌ Error creating gate user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  createGateUser();
}

module.exports = createGateUser;