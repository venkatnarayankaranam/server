const XLSX = require('xlsx');
const path = require('path');

console.log('🔍 INSPECTING BOYS HOSTEL DATA EXCEL STRUCTURE');
console.log('===============================================\n');

try {
  const excelFilePath = path.join(__dirname, '../../BOYS HOSTEL DATA.xls');
  console.log(`📂 Reading: ${excelFilePath}\n`);
  
  const workbook = XLSX.readFile(excelFilePath);
  
  console.log('📊 Available Sheets:');
  workbook.SheetNames.forEach((name, index) => {
    console.log(`  ${index + 1}. ${name}`);
  });
  
  // Read first sheet
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet);
  
  console.log(`\n📈 Total Records: ${data.length}`);
  
  if (data.length > 0) {
    console.log('\n📋 Column Names:');
    const columns = Object.keys(data[0]);
    columns.forEach((col, index) => {
      console.log(`  ${index + 1}. "${col}"`);
    });
    
    console.log('\n📝 First 3 Records:');
    console.log('='.repeat(50));
    data.slice(0, 3).forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      Object.entries(record).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
  }
  
} catch (error) {
  console.error('❌ Error reading Excel file:', error.message);
  console.log('\n💡 Possible issues:');
  console.log('• File path might be incorrect');
  console.log('• File might be corrupted');
  console.log('• File might be password protected');
  console.log('• File format might not be supported');
}