require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const createHostelStaff = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('Connected to MongoDB');

    // Floor Incharges for D Block (Men's Hostel)
    const dBlockFloorIncharges = [
      {
        name: "First Floor Incharge - D Block",
        email: "floorincharge1.d@kietgroup.com",
        password: "FloorIncharge@1",
        role: "floor-incharge",
        hostelBlock: "D-Block",
        floor: "1st Floor",
        roomNumber: "D-FI-101",
        phoneNumber: "9876543211",
        staffId: "FI-D-001",
        assignedFloor: ["1st Floor"]
      },
      {
        name: "Second Floor Incharge - D Block",
        email: "floorincharge2.d@kietgroup.com",
        password: "FloorIncharge@2",
        role: "floor-incharge",
        hostelBlock: "D-Block",
        floor: "2nd Floor",
        roomNumber: "D-FI-201",
        phoneNumber: "9876543212",
        staffId: "FI-D-002",
        assignedFloor: ["2nd Floor"]
      },
      {
        name: "Third Floor Incharge - D Block",
        email: "floorincharge3.d@kietgroup.com",
        password: "FloorIncharge@3",
        role: "floor-incharge",
        hostelBlock: "D-Block",
        floor: "3rd Floor",
        roomNumber: "D-FI-301",
        phoneNumber: "9876543213",
        staffId: "FI-D-003",
        assignedFloor: ["3rd Floor"]
      },
      {
        name: "Fourth Floor Incharge - D Block",
        email: "floorincharge4.d@kietgroup.com",
        password: "FloorIncharge@4",
        role: "floor-incharge",
        hostelBlock: "D-Block",
        floor: "4th Floor",
        roomNumber: "D-FI-401",
        phoneNumber: "9876543214",
        staffId: "FI-D-004",
        assignedFloor: ["4th Floor"]
      }
    ];

    // Hostel Incharge for D Block
    const dBlockHostelIncharge = {
      name: "Hostel Incharge - D Block",
      email: "hostelincharge.d@kietgroup.com",
      password: "HostelIncharge@d",
      role: "hostel-incharge",
      phoneNumber: "9876543215",
      staffId: "HI-D-001",
      assignedBlocks: ["D-Block"]
    };

    // Warden for D Block
    const dBlockWarden = {
      name: "Warden - D Block",
      email: "warden.d@kietgroup.com",
      password: "Warden@d",
      role: "warden",
      phoneNumber: "9876543216",
      staffId: "W-D-001"
    };

    // Floor Incharges for E Block (Women's Hostel)
    const eBlockFloorIncharges = [
      {
        name: "First Floor Incharge - E Block",
        email: "floorincharge1.e@kietgroup.com",
        password: "FloorIncharge@1",
        role: "floor-incharge",
        hostelBlock: "E-Block",
        floor: "1st Floor",
        roomNumber: "E-FI-101",
        phoneNumber: "9876543221",
        staffId: "FI-E-001",
        assignedFloor: ["1st Floor"]
      },
      {
        name: "Second Floor Incharge - E Block",
        email: "floorincharge2.e@kietgroup.com",
        password: "FloorIncharge@2",
        role: "floor-incharge",
        hostelBlock: "E-Block",
        floor: "2nd Floor",
        roomNumber: "E-FI-201",
        phoneNumber: "9876543222",
        staffId: "FI-E-002",
        assignedFloor: ["2nd Floor"]
      },
      {
        name: "Third Floor Incharge - E Block",
        email: "floorincharge3.e@kietgroup.com",
        password: "FloorIncharge@3",
        role: "floor-incharge",
        hostelBlock: "E-Block",
        floor: "3rd Floor",
        roomNumber: "E-FI-301",
        phoneNumber: "9876543223",
        staffId: "FI-E-003",
        assignedFloor: ["3rd Floor"]
      },
      {
        name: "Fourth Floor Incharge - E Block",
        email: "floorincharge4.e@kietgroup.com",
        password: "FloorIncharge@4",
        role: "floor-incharge",
        hostelBlock: "E-Block",
        floor: "4th Floor",
        roomNumber: "E-FI-401",
        phoneNumber: "9876543224",
        staffId: "FI-E-004",
        assignedFloor: ["4th Floor"]
      }
    ];

    // Hostel Incharge for E Block
    const eBlockHostelIncharge = {
      name: "Hostel Incharge - E Block",
      email: "hostelincharge.e@kietgroup.com",
      password: "HostelIncharge@e",
      role: "hostel-incharge",
      phoneNumber: "9876543225",
      staffId: "HI-E-001",
      assignedBlocks: ["E-Block"]
    };

    // Warden for E Block
    const eBlockWarden = {
      name: "Warden - E Block",
      email: "warden.e@kietgroup.com",
      password: "Warden@e",
      role: "warden",
      phoneNumber: "9876543226",
      staffId: "W-E-001"
    };

    // Combine all users
    const allUsers = [
      ...dBlockFloorIncharges,
      dBlockHostelIncharge,
      dBlockWarden,
      ...eBlockFloorIncharges,
      eBlockHostelIncharge,
      eBlockWarden
    ];

    console.log('Creating hostel staff users...');
    let createdCount = 0;
    let skippedCount = 0;

    for (const userData of allUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          console.log(`⚠️  User already exists: ${userData.email}`);
          skippedCount++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Create new user
        const newUser = new User({
          ...userData,
          password: hashedPassword,
          isActive: true
        });

        await newUser.save();
        console.log(`✅ Created: ${userData.name} (${userData.email})`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Error creating user ${userData.email}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Created: ${createdCount} users`);
    console.log(`⚠️  Skipped: ${skippedCount} users (already exist)`);
    console.log(`📧 Total users processed: ${allUsers.length}`);

    console.log('\n🔐 Login Credentials Summary:');
    console.log('\n--- D BLOCK (Men\'s Hostel) ---');
    console.log('Floor Incharges:');
    dBlockFloorIncharges.forEach(user => {
      console.log(`${user.name}: ${user.email} / ${user.password}`);
    });
    console.log(`Hostel Incharge: ${dBlockHostelIncharge.email} / ${dBlockHostelIncharge.password}`);
    console.log(`Warden: ${dBlockWarden.email} / ${dBlockWarden.password}`);

    console.log('\n--- E BLOCK (Women\'s Hostel) ---');
    console.log('Floor Incharges:');
    eBlockFloorIncharges.forEach(user => {
      console.log(`${user.name}: ${user.email} / ${user.password}`);
    });
    console.log(`Hostel Incharge: ${eBlockHostelIncharge.email} / ${eBlockHostelIncharge.password}`);
    console.log(`Warden: ${eBlockWarden.email} / ${eBlockWarden.password}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error creating hostel staff:', error);
    process.exit(1);
  }
};

createHostelStaff();