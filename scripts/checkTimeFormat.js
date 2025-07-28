require('dotenv').config();
const mongoose = require('mongoose');
const OutingRequest = require('../models/OutingRequest');
const User = require('../models/User');

const checkTimeFormat = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-db');
    console.log('🔗 Connected to MongoDB');

    const request = await OutingRequest.findById('68862b7f40b1ccf3ebe8a767');
    
    console.log('\n📅 Time Data Analysis:');
    console.log('   outingDate:', request.outingDate, '(Type:', typeof request.outingDate, ')');
    console.log('   outingTime:', request.outingTime, '(Type:', typeof request.outingTime, ')');
    console.log('   returnTime:', request.returnTime, '(Type:', typeof request.returnTime, ')');
    
    // Test date parsing
    console.log('\n🧪 Date Parsing Tests:');
    
    try {
      const dateStr = request.outingDate instanceof Date 
        ? request.outingDate.toISOString().split('T')[0] 
        : request.outingDate;
      console.log('   Date string:', dateStr);
      
      const fullDateTime = dateStr + ' ' + request.outingTime;
      console.log('   Full datetime string:', fullDateTime);
      
      const parsedDate = new Date(fullDateTime);
      console.log('   Parsed date:', parsedDate);
      console.log('   Is valid:', !isNaN(parsedDate.getTime()));
      
    } catch (error) {
      console.log('   Parsing error:', error.message);
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkTimeFormat();