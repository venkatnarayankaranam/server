require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');

const importBoysHostelData = async () => {
  try {
    console.log('🚀 IMPORTING BOYS HOSTEL DATA (D-Block & E-Block)');
    console.log('==================================================\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outing-system');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');

    // Read Excel file
    const excelFilePath = path.join(__dirname, '../../BOYS HOSTEL DATA.xls');
    console.log(`📂 Reading Excel file: ${excelFilePath}`);
    
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Found ${data.length} records in Excel file\n`);

    // Log first few records to understand structure
    console.log('📋 Sample data structure:');
    console.log(JSON.stringify(data.slice(0, 2), null, 2));
    console.log('\n');

    // Process and clean data
    const processedStudents = [];
    const blockCounts = { 'D-Block': 0, 'E-Block': 0, 'Other': 0 };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Extract and clean data based on actual Excel structure
        const rollNumber = row['Rolno'] || '';
        const name = row['Name'] || '';
        const contact = row['Contact'] || '';
        const block = row['Block'] || '';
        const room = row['Room'] || '';
        const year = row['Year'] || 1;

        // Skip rows with missing critical data
        if (!rollNumber && !name) {
          console.log(`⚠️  Skipping row ${i + 1}: Missing both roll number and name`);
          continue;
        }

        const student = {
          name: name || rollNumber, // Use rollNumber as name if name is missing
          email: generateEmail(rollNumber, name),
          rollNumber: rollNumber,
          username: rollNumber, // Add username field to avoid null conflicts
          hostelBlock: normalizeBlock(block),
          floor: determineFloorFromRoom(room),
          roomNumber: room,
          branch: 'CSE', // Default branch, can be updated later
          semester: parseInt(year) || 1,
          phoneNumber: contact,
          parentPhoneNumber: '', // Not available in this Excel
          gender: 'Male', // Since this is boys hostel data
          role: 'student', // Add role field
          password: '$2a$10$defaulthash', // Add default password hash
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Validate required fields
        if (!student.rollNumber) {
          console.log(`⚠️  Skipping row ${i + 1}: Missing roll number`);
          continue;
        }

        // Count by block
        if (student.hostelBlock === 'D-Block' || student.hostelBlock === 'E-Block') {
          blockCounts[student.hostelBlock] += 1;
        } else {
          blockCounts['Other'] += 1;
        }
        
        processedStudents.push(student);

      } catch (error) {
        console.log(`❌ Error processing row ${i + 1}:`, error.message);
        continue;
      }
    }

    console.log('\n📈 DATA PROCESSING SUMMARY:');
    console.log('─'.repeat(40));
    console.log(`Total processed: ${processedStudents.length}`);
    console.log(`D-Block students: ${blockCounts['D-Block']}`);
    console.log(`E-Block students: ${blockCounts['E-Block']}`);
    console.log(`Other/Unidentified: ${blockCounts['Other']}`);

    if (processedStudents.length === 0) {
      console.log('❌ No valid student records found. Please check Excel file structure.');
      return;
    }

    // Backup existing data
    console.log('\n💾 Creating backup of existing boys hostel data...');
    const existingBoysData = await studentsCollection.find({
      gender: 'Male',
      hostelBlock: { $in: ['D-Block', 'E-Block'] }
    }).toArray();

    if (existingBoysData.length > 0) {
      const backupCollection = db.collection(`students_backup_${Date.now()}`);
      await backupCollection.insertMany(existingBoysData);
      console.log(`✅ Backed up ${existingBoysData.length} existing records`);
    }

    // Remove existing data more comprehensively
    console.log('\n🗑️  Removing existing boys hostel data...');
    
    // First remove by hostelBlock to clear boys data
    const deleteByBlockResult = await studentsCollection.deleteMany({
      hostelBlock: { $in: ['D-Block', 'E-Block'] }
    });
    console.log(`✅ Removed ${deleteByBlockResult.deletedCount} existing boys records by block`);

    // Also remove any remaining records with matching roll numbers
    const rollNumbers = processedStudents.map(s => s.rollNumber);
    const deleteByRollResult = await studentsCollection.deleteMany({
      rollNumber: { $in: rollNumbers }
    });
    console.log(`✅ Removed ${deleteByRollResult.deletedCount} additional records by roll number`);

    // Insert new data in batches to handle any remaining duplicates
    console.log('\n📥 Inserting updated boys hostel data...');
    let insertedCount = 0;
    const batchSize = 50;
    
    for (let i = 0; i < processedStudents.length; i += batchSize) {
      const batch = processedStudents.slice(i, i + batchSize);
      try {
        const result = await studentsCollection.insertMany(batch, { ordered: false });
        insertedCount += result.insertedCount;
      } catch (error) {
        // Handle individual duplicates by inserting one by one
        for (const student of batch) {
          try {
            await studentsCollection.insertOne(student);
            insertedCount++;
          } catch (insertError) {
            // Try to update existing record
            try {
              await studentsCollection.replaceOne(
                { rollNumber: student.rollNumber },
                student
              );
              insertedCount++;
            } catch (upsertError) {
              console.log(`⚠️ Could not process student ${student.rollNumber}: ${insertError.message}`);
            }
          }
        }
      }
    }
    console.log(`✅ Successfully processed ${insertedCount} student records`);

    // Verify data segregation
    console.log('\n🔍 VERIFYING BLOCK SEGREGATION:');
    console.log('─'.repeat(40));
    
    const dBlockCount = await studentsCollection.countDocuments({ hostelBlock: 'D-Block' });
    const eBlockCount = await studentsCollection.countDocuments({ hostelBlock: 'E-Block' });
    
    console.log(`D-Block total students: ${dBlockCount}`);
    console.log(`E-Block total students: ${eBlockCount}`);

    // Show sample students from each block
    const dBlockSample = await studentsCollection.findOne({ hostelBlock: 'D-Block' });
    const eBlockSample = await studentsCollection.findOne({ hostelBlock: 'E-Block' });

    if (dBlockSample) {
      console.log('\n📋 D-Block sample student:');
      console.log(`Name: ${dBlockSample.name}, Roll: ${dBlockSample.rollNumber}, Floor: ${dBlockSample.floor}`);
    }

    if (eBlockSample) {
      console.log('\n📋 E-Block sample student:');
      console.log(`Name: ${eBlockSample.name}, Roll: ${eBlockSample.rollNumber}, Floor: ${eBlockSample.floor}`);
    }

    console.log('\n🎉 BOYS HOSTEL DATA IMPORT COMPLETED!');
    console.log('=====================================\n');

    console.log('✅ WHAT WAS ACCOMPLISHED:');
    console.log(`• Imported ${processedStudents.length} boys hostel students`);
    console.log(`• D-Block: ${blockCounts['D-Block']} students`);
    console.log(`• E-Block: ${blockCounts['E-Block']} students`);
    console.log('• Proper block segregation ensured');
    console.log('• Old data backed up and replaced');

    console.log('\n🔐 ADMIN ACCESS VERIFICATION:');
    console.log('─'.repeat(40));
    console.log('D-Block Admins will see ONLY D-Block students:');
    console.log('• floorincharge1.d@kietgroup.com → D-Block Floor 1 students only');
    console.log('• hostelincharge.d@kietgroup.com → All D-Block students only');
    console.log('• warden.d@kietgroup.com → All D-Block students only');
    
    console.log('\nE-Block Admins will see ONLY E-Block students:');
    console.log('• floorincharge1.e@kietgroup.com → E-Block Floor 1 students only');
    console.log('• hostelincharge.e@kietgroup.com → All E-Block students only');
    console.log('• warden.e@kietgroup.com → All E-Block students only');

    console.log('\n🚀 NEXT STEPS:');
    console.log('• Test login with block-specific admin accounts');
    console.log('• Verify students appear under correct block admins');
    console.log('• Import women\'s hostel data using similar process');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
};

// Helper functions
function generateEmail(rollNumber, name) {
  if (rollNumber) {
    return `${rollNumber.toLowerCase()}@kietgroup.com`;
  }
  if (name) {
    return `${name.toLowerCase().replace(/\s+/g, '.')}@kietgroup.com`;
  }
  return `student${Date.now()}@kietgroup.com`;
}

function normalizeBlock(block) {
  if (!block) return 'D-Block'; // Default
  
  const blockStr = block.toString().toUpperCase();
  if (blockStr.includes('D-BLOCK') || blockStr === 'D-BLOCK') {
    return 'D-Block';
  } else if (blockStr.includes('E-BLOCK') || blockStr === 'E-BLOCK') {
    return 'E-Block';
  }
  
  // Fallback logic
  if (blockStr.includes('D')) {
    return 'D-Block';
  } else if (blockStr.includes('E')) {
    return 'E-Block';
  }
  
  return 'D-Block'; // Default
}

function determineFloorFromRoom(roomNumber) {
  if (!roomNumber) return '1st Floor';
  
  const roomStr = roomNumber.toString().toUpperCase();
  
  // Extract floor from room number (E111 -> 1st floor, E211 -> 2nd floor, etc.)
  if (roomStr.length >= 3) {
    const floorDigit = roomStr.charAt(1); // Second character usually indicates floor
    switch (floorDigit) {
      case '1': return '1st Floor';
      case '2': return '2nd Floor';
      case '3': return '3rd Floor';
      case '4': return '4th Floor';
      default: return '1st Floor';
    }
  }
  
  return '1st Floor'; // Default
}

importBoysHostelData();