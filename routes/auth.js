const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth'); // Import the auth middleware

const ADMIN_CREDENTIALS = {
  "floorincharge@kietgroup.com": {
    password: "FloorIncharge@2026",
    role: "floor-incharge",
    assignedBlock: "D-Block",
    assignedFloor: ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor"],
    isAdmin: true
  },
  "hostelincharge@kietgroup.com": {
    password: "HostelIncharge@2026",
    role: "hostel-incharge",
  },
  "maingate@kietgroup.com": {
    password: "MainGate@2026",
    role: "gate",
  },
  "warden@kietgroup.com": {
    password: "Warden@2026",
    role: "warden",
  },
};

router.post('/register', async (req, res) => {
  try {
    console.log('🎓 Student Registration Request:', {
      body: req.body,
      hasRequiredFields: {
        email: !!req.body.email,
        name: !!req.body.name,
        rollNumber: !!req.body.rollNumber,
        branch: !!req.body.branch,
        semester: !!req.body.semester
      }
    });

    const {
      email,
      password,
      name,
      rollNumber,
      phoneNumber,
      parentPhoneNumber,
      hostelBlock,
      floor,
      roomNumber,
      branch,
      semester,
    } = req.body;

    // Validate required fields
    if (!email || !name || !rollNumber || !hostelBlock || !floor || !roomNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: email, name, rollNumber, hostelBlock, floor, roomNumber are required' 
      });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Format floor value
    const formattedFloor = User.formatFloor(floor);
    
    // Format hostel block (ensure proper format)
    const formattedHostelBlock = hostelBlock?.includes('-Block') ? hostelBlock : `${hostelBlock}-Block`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData = {
      email,
      password: hashedPassword,
      name,
      rollNumber,
      phoneNumber,
      parentPhoneNumber,
      hostelBlock: formattedHostelBlock,
      floor: formattedFloor,
      roomNumber,
      branch: branch || 'Computer Science', // Default branch
      semester: semester || 1, // Default semester
      role: 'student',
    };

    console.log('📝 Creating user with data:', {
      ...userData,
      password: '[HIDDEN]'
    });

    user = new User(userData);
    await user.save();

    console.log('✅ Student registered successfully:', {
      id: user._id,
      name: user.name,
      email: user.email,
      rollNumber: user.rollNumber
    });

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      student: {
        id: user._id,
        name: user.name,
        email: user.email,
        rollNumber: user.rollNumber,
        hostelBlock: user.hostelBlock,
        floor: user.floor,
        roomNumber: user.roomNumber,
        branch: user.branch,
        semester: user.semester
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
      details: error.name // For debugging
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Handle admin users
    if (ADMIN_CREDENTIALS[email]) {
      if (password === ADMIN_CREDENTIALS[email].password) {
        const adminData = {
          id: email,
          email,
          role: ADMIN_CREDENTIALS[email].role,
          isAdmin: true,
          assignedBlock: ADMIN_CREDENTIALS[email].assignedBlock,
          assignedFloor: ADMIN_CREDENTIALS[email].assignedFloor,
          name: ADMIN_CREDENTIALS[email].role.replace('-', ' ').toUpperCase(),
        };

        const token = jwt.sign(
          adminData,
          process.env.JWT_SECRET || 'OutingApplication@2026',
          { expiresIn: '1d' }
        );

        return res.json({
          success: true,
          user: adminData,
          token,
        });
      }
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Handle regular users
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Prepare token data with proper fallbacks
    const tokenData = {
      id: user._id,
      email: user.email,
      role: user.role,
      hostelBlock: user.hostelBlock,
      floor: user.floor,
      assignedBlock: user.hostelBlock, // Include assignedBlock for compatibility
    };

    // Add role-specific fields
    if (user.role === 'hostel-incharge') {
      tokenData.assignedBlocks = user.assignedBlocks || [user.hostelBlock].filter(Boolean);
      tokenData.isAdmin = true;
    } else if (user.role === 'floor-incharge') {
      tokenData.assignedFloor = user.assignedFloor || [user.floor].filter(Boolean);  
      tokenData.assignedBlocks = [user.hostelBlock].filter(Boolean);
      tokenData.isAdmin = true;
    } else {
      tokenData.assignedBlocks = user.assignedBlocks || [];
      tokenData.assignedFloor = user.assignedFloor || [];
    }

    console.log('🎟️ Creating JWT token for user:', {
      email: user.email,
      role: user.role,
      assignedBlocks: tokenData.assignedBlocks,
      hostelBlock: user.hostelBlock
    });

    const token = jwt.sign(
      tokenData,
      process.env.JWT_SECRET || 'OutingApplication@2026',
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber,
        phoneNumber: user.phoneNumber,
        parentPhoneNumber: user.parentPhoneNumber,
        hostelBlock: user.hostelBlock,
        floor: user.floor,
        roomNumber: user.roomNumber,
        branch: user.branch,
        semester: user.semester,
        assignedBlocks: tokenData.assignedBlocks, // Include for debugging
        assignedFloor: tokenData.assignedFloor, // Include for debugging
        isAdmin: tokenData.isAdmin // Include for debugging
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update verify endpoint
router.get('/verify', auth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      isAdmin: req.user.isAdmin || false,
      assignedBlocks: req.user.assignedBlocks || []
    }
  });
});

module.exports = router;