const PDFDocument = require('pdfkit');

const generatePDF = (res, { title, requests, role, statistics, dateRange }) => {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    layout: 'landscape'
  });

  // Pipe the PDF to the response
  doc.pipe(res);

  // Add header
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
  
  // Add date range if provided
  if (dateRange) {
    doc.text(`Report Period: ${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`, { align: 'right' });
  }
  
  doc.moveDown();

  // Add statistics section if provided
  if (statistics) {
    doc.fontSize(12).font('Helvetica-Bold').text('Summary Statistics:', 50, doc.y);
    doc.moveDown(0.5);
    
    const statsY = doc.y;
    const statsHeight = 80;
    
    // Draw statistics box
    doc.rect(50, statsY, 500, statsHeight).stroke();
    
    doc.fontSize(10).font('Helvetica');
    
    // Handle different statistics structures
    let statsText = [];
    if (statistics.totalRequests !== undefined) {
      // New statistics format
      statsText = [
        `Total Approved Requests: ${statistics.totalRequests || 0}`,
        `Block Distribution - D-Block: ${statistics.byBlock?.['D-Block'] || 0} | E-Block: ${statistics.byBlock?.['E-Block'] || 0} | Womens-Block: ${statistics.byBlock?.['Womens-Block'] || 0}`,
        `Time Period - This Week: ${statistics.byDateRange?.thisWeek || 0} | This Month: ${statistics.byDateRange?.thisMonth || 0}`,
        `Report Generated: ${new Date().toLocaleString()}`
      ];
    } else {
      // Legacy statistics format
      statsText = [
        `Total Outings: ${statistics.totalOutings || 0}`,
        `Approved: ${statistics.approvedCount || 0} | Pending: ${statistics.pendingCount || 0} | Denied: ${statistics.deniedCount || 0}`,
        `Total Returns: ${statistics.totalReturns || 0}`,
        `Report Generated: ${new Date().toLocaleString()}`
      ];
    }
    
    statsText.forEach((text, index) => {
      const x = 60 + (index % 2) * 250;
      const y = statsY + 15 + Math.floor(index / 2) * 20;
      doc.text(text, x, y);
    });
    
    doc.y = statsY + statsHeight + 20;
    doc.moveDown();
  }

  // Define table layout - add columns for approval remarks (FI/HI)
  const tableTop = doc.y + 20;
  const columnSpacing = {
    srNo: 30,
    name: 80,
    rollNo: 70,
    blockRoom: 70,
    contact: 70,
    branch: 50,
    outTime: 60,
    inTime: 60,
    purpose: 80,
    fiRemark: 120,
    hiRemark: 120,
    approvedBy: 70
  };

  let currentY = tableTop;

  // Draw table headers
  doc.font('Helvetica-Bold');
  let currentX = 50;

  const headers = [
    { width: columnSpacing.srNo, text: 'Sr.No' },
    { width: columnSpacing.name, text: 'Name' },
    { width: columnSpacing.rollNo, text: 'Roll No' },
    { width: columnSpacing.blockRoom, text: 'Block/Room' },
    { width: columnSpacing.contact, text: 'Contact' },
    { width: columnSpacing.branch, text: 'Branch' },
    { width: columnSpacing.outTime, text: 'Out Time' },
    { width: columnSpacing.inTime, text: 'In Time' },
    { width: columnSpacing.purpose, text: 'Purpose' },
    { width: columnSpacing.fiRemark, text: 'FI Remarks' },
    { width: columnSpacing.hiRemark, text: 'HI Remarks' },
    { width: columnSpacing.approvedBy, text: 'Approved By' }
  ];

  // Draw header background
  doc.fillColor('#f3f4f6')
     .rect(currentX - 5, currentY - 5, 
           headers.reduce((sum, h) => sum + h.width, 0) + 10, 25)
     .fill();

  // Draw header text
  doc.fillColor('#000000');
  headers.forEach(header => {
    doc.text(header.text, currentX, currentY, {
      width: header.width,
      align: 'left'
    });
    currentX += header.width;
  });

  currentY += 30;

  // Draw table data
  doc.font('Helvetica');
  requests.forEach((request, index) => {
    if (currentY > 500) {
      doc.addPage();
      currentY = 50;
    }

    currentX = 50;
    
    // Extract approval information and remarks
    let approvedBy = 'N/A';
    let fiRemarks = '';
    let hiRemarks = '';
    if (request.approvalFlow && request.approvalFlow.length > 0) {
      const fi = request.approvalFlow.find(flow => flow.level === 'floor-incharge' && flow.status === 'approved');
      const hi = request.approvalFlow.find(flow => flow.level === 'hostel-incharge' && flow.status === 'approved');
      if (fi) {
        fiRemarks = fi.remarks || '';
        approvedBy = fi.approvedBy || 'Floor Incharge';
      }
      if (hi) {
        hiRemarks = hi.remarks || '';
        // Prefer HI as approvedBy if warden/final not present and FI missing approver
        if (!approvedBy) approvedBy = hi.approvedBy || 'Hostel Incharge';
      }
    }
    
    const rowData = [
      { width: columnSpacing.srNo, text: (index + 1).toString() },
      { width: columnSpacing.name, text: request.studentId?.name || 'N/A' },
      { width: columnSpacing.rollNo, text: request.studentId?.rollNumber || 'N/A' },
      { width: columnSpacing.blockRoom, text: `${request.studentId?.hostelBlock || 'N/A'}/${request.studentId?.roomNumber || 'N/A'}` },
      { width: columnSpacing.contact, text: request.studentId?.phoneNumber || 'N/A' },
      { width: columnSpacing.branch, text: request.studentId?.branch || 'N/A' },
      { width: columnSpacing.outTime, text: request.outingTime || 'N/A' },
      { width: columnSpacing.inTime, text: request.returnTime || 'N/A' },
      { width: columnSpacing.purpose, text: request.purpose || 'N/A' },
      { width: columnSpacing.fiRemark, text: fiRemarks || '—' },
      { width: columnSpacing.hiRemark, text: hiRemarks || '—' },
      { width: columnSpacing.approvedBy, text: approvedBy }
    ];

    rowData.forEach(cell => {
      doc.text(cell.text, currentX, currentY, {
        width: cell.width,
        align: 'left'
      });
      currentX += cell.width;
    });

    currentY += 20;
  });

  doc.end();
};

// Generate Gate Activity PDF
const generateGateActivityPDF = async ({ activityLog, stats, startDate, endDate, currentUser }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        layout: 'landscape'
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Gate Activity Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.fontSize(12).font('Helvetica').text(`Generated by: ${currentUser}`, { align: 'right' });
      doc.fontSize(12).font('Helvetica').text(`Period: ${startDate} to ${endDate}`, { align: 'right' });
      doc.moveDown(2);

      // Statistics Section
      doc.fontSize(16).font('Helvetica-Bold').text('Summary Statistics', { underline: true });
      doc.moveDown();

      const statsY = doc.y;
      const statsHeight = 80;
      
      // Draw statistics box
      doc.rect(50, statsY, 500, statsHeight).stroke();
      
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Students Out:', 60, statsY + 10);
      doc.text('Students In:', 60, statsY + 30);
      doc.text('Currently Out:', 60, statsY + 50);
      doc.text('Pending Return:', 60, statsY + 70);
      
      doc.fontSize(12).font('Helvetica');
      doc.text(stats.studentsOut.toString(), 200, statsY + 10);
      doc.text(stats.studentsIn.toString(), 200, statsY + 30);
      doc.text(stats.currentlyOut.toString(), 200, statsY + 50);
      doc.text(stats.pendingReturn.toString(), 200, statsY + 70);
      
      doc.y = statsY + statsHeight + 20;
      doc.moveDown();

      // Activity Log Section
      if (activityLog && activityLog.length > 0) {
        doc.fontSize(16).font('Helvetica-Bold').text('Gate Activity Log', { underline: true });
        doc.moveDown();

        // Define table layout with proper spacing
        const tableStartX = 50;
        const tableStartY = doc.y;
        const rowHeight = 25;
        const headerHeight = 30;
        
        // Column definitions with proper widths
        const columns = [
          { x: tableStartX, width: 40, title: 'Sr.No', align: 'center' },
          { x: tableStartX + 40, width: 120, title: 'Student Name', align: 'left' },
          { x: tableStartX + 160, width: 80, title: 'Roll No', align: 'left' },
          { x: tableStartX + 240, width: 80, title: 'Block/Room', align: 'left' },
          { x: tableStartX + 320, width: 60, title: 'Type', align: 'center' },
          { x: tableStartX + 380, width: 90, title: 'Time', align: 'center' },
          { x: tableStartX + 470, width: 80, title: 'Location', align: 'left' },
          { x: tableStartX + 550, width: 140, title: 'Purpose', align: 'left' }
        ];

        const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

        // Draw table header
        doc.fillColor('#f3f4f6')
           .rect(tableStartX, tableStartY, totalWidth, headerHeight)
           .fill();
        
        doc.strokeColor('#000000')
           .lineWidth(1)
           .rect(tableStartX, tableStartY, totalWidth, headerHeight)
           .stroke();

        // Draw header text
        doc.fillColor('#000000');
        doc.fontSize(10).font('Helvetica-Bold');
        columns.forEach(column => {
          doc.text(column.title, column.x + 5, tableStartY + 10, {
            width: column.width - 10,
            align: column.align
          });
        });

        // Draw column separators
        columns.forEach((column, index) => {
          if (index < columns.length - 1) {
            doc.strokeColor('#d1d5db')
               .lineWidth(0.5)
               .moveTo(column.x + column.width, tableStartY)
               .lineTo(column.x + column.width, tableStartY + headerHeight)
               .stroke();
          }
        });

        let currentY = tableStartY + headerHeight;

        // Draw table data
        doc.fontSize(9).font('Helvetica');
        activityLog.forEach((activity, index) => {
          // Check if we need a new page
          if (currentY > 500) {
            doc.addPage();
            currentY = 50;
            
            // Redraw header on new page
            doc.fillColor('#f3f4f6')
               .rect(tableStartX, currentY, totalWidth, headerHeight)
               .fill();
            
            doc.strokeColor('#000000')
               .lineWidth(1)
               .rect(tableStartX, currentY, totalWidth, headerHeight)
               .stroke();

            doc.fillColor('#000000');
            doc.fontSize(10).font('Helvetica-Bold');
            columns.forEach(column => {
              doc.text(column.title, column.x + 5, currentY + 10, {
                width: column.width - 10,
                align: column.align
              });
            });

            // Draw column separators on new page
            columns.forEach((column, colIndex) => {
              if (colIndex < columns.length - 1) {
                doc.strokeColor('#d1d5db')
                   .lineWidth(0.5)
                   .moveTo(column.x + column.width, currentY)
                   .lineTo(column.x + column.width, currentY + headerHeight)
                   .stroke();
              }
            });

            currentY += headerHeight;
            doc.fontSize(9).font('Helvetica');
          }

          // Draw row background (alternate colors)
          doc.fillColor(index % 2 === 0 ? '#ffffff' : '#f9fafb')
             .rect(tableStartX, currentY, totalWidth, rowHeight)
             .fill();

          // Draw row border
          doc.strokeColor('#e5e7eb')
             .lineWidth(0.5)
             .rect(tableStartX, currentY, totalWidth, rowHeight)
             .stroke();

          // Draw row data
          doc.fillColor('#000000');
          const rowData = [
            { text: (index + 1).toString(), align: 'center' },
            { text: activity.student?.name || 'N/A', align: 'left' },
            { text: activity.student?.rollNumber || 'N/A', align: 'left' },
            { text: `${activity.student?.hostelBlock || 'N/A'}/${activity.student?.roomNumber || 'N/A'}`, align: 'left' },
            { text: activity.type || 'N/A', align: 'center' },
            { text: new Date(activity.scannedAt).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              }) || 'N/A', align: 'center' },
            { text: activity.location || 'Main Gate', align: 'left' },
            { text: activity.purpose || 'N/A', align: 'left' }
          ];

          columns.forEach((column, colIndex) => {
            doc.text(rowData[colIndex].text, column.x + 5, currentY + 8, {
              width: column.width - 10,
              align: column.align
            });
          });

          // Draw column separators for data rows
          columns.forEach((column, colIndex) => {
            if (colIndex < columns.length - 1) {
              doc.strokeColor('#e5e7eb')
                 .lineWidth(0.5)
                 .moveTo(column.x + column.width, currentY)
                 .lineTo(column.x + column.width, currentY + rowHeight)
                 .stroke();
            }
          });

          currentY += rowHeight;
        });

        // Draw final table border
        doc.strokeColor('#000000')
           .lineWidth(1)
           .rect(tableStartX, tableStartY, totalWidth, currentY - tableStartY)
           .stroke();

      } else {
        doc.fontSize(14).font('Helvetica').text('No gate activity found for the specified period.', { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate Past Outings PDF for Students
const generatePastOutingsPDF = async ({ outings, studentName, studentRollNumber, currentUser }) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('📄 Starting PDF generation with data:', {
        outingsCount: outings?.length || 0,
        studentName,
        studentRollNumber,
        currentUser
      });

      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        layout: 'landscape'
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        console.log('📄 PDF generation completed, buffer size:', Buffer.concat(chunks).length);
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', (error) => {
        console.error('📄 PDF generation error:', error);
        reject(error);
      });

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Past Outings Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.fontSize(12).font('Helvetica').text(`Generated by: ${currentUser}`, { align: 'right' });
      doc.fontSize(12).font('Helvetica').text(`Student: ${studentName} (${studentRollNumber})`, { align: 'right' });
      doc.moveDown(2);

      // Summary Section
      doc.fontSize(16).font('Helvetica-Bold').text('Summary', { underline: true });
      doc.moveDown();

      const summaryY = doc.y;
      const summaryHeight = 60;
      
      // Draw summary box
      doc.rect(50, summaryY, 500, summaryHeight).stroke();
      
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Total Completed Outings:', 60, summaryY + 10);
      doc.text('First Outing Date:', 60, summaryY + 30);
      doc.text('Last Outing Date:', 60, summaryY + 50);
      
      doc.fontSize(12).font('Helvetica');
      doc.text(outings.length.toString(), 250, summaryY + 10);
      
      if (outings.length > 0) {
        const firstDate = new Date(Math.min(...outings.map(o => new Date(o.createdAt))));
        const lastDate = new Date(Math.max(...outings.map(o => new Date(o.createdAt))));
        doc.text(firstDate.toLocaleDateString(), 250, summaryY + 30);
        doc.text(lastDate.toLocaleDateString(), 250, summaryY + 50);
      } else {
        doc.text('N/A', 250, summaryY + 30);
        doc.text('N/A', 250, summaryY + 50);
      }
      
      doc.y = summaryY + summaryHeight + 20;
      doc.moveDown();

      // Past Outings Table
      if (outings && outings.length > 0) {
        doc.fontSize(16).font('Helvetica-Bold').text('Past Outings Details', { underline: true });
        doc.moveDown();

        // Define table layout with proper spacing
        const tableStartX = 50;
        const tableStartY = doc.y;
        const rowHeight = 25;
        const headerHeight = 30;
        
        // Column definitions with proper widths
        const columns = [
          { x: tableStartX, width: 40, title: 'Sr.No', align: 'center' },
          { x: tableStartX + 40, width: 100, title: 'Date', align: 'center' },
          { x: tableStartX + 140, width: 80, title: 'Out Time', align: 'center' },
          { x: tableStartX + 220, width: 80, title: 'In Time', align: 'center' },
          { x: tableStartX + 300, width: 120, title: 'Purpose', align: 'left' },
          { x: tableStartX + 420, width: 80, title: 'Status', align: 'center' },
          { x: tableStartX + 500, width: 100, title: 'Approved On', align: 'center' }
        ];

        const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

        // Draw table header
        doc.fillColor('#f3f4f6')
           .rect(tableStartX, tableStartY, totalWidth, headerHeight)
           .fill();
        
        doc.strokeColor('#000000')
           .lineWidth(1)
           .rect(tableStartX, tableStartY, totalWidth, headerHeight)
           .stroke();

        // Draw header text
        doc.fillColor('#000000');
        doc.fontSize(10).font('Helvetica-Bold');
        columns.forEach(column => {
          doc.text(column.title, column.x + 5, tableStartY + 10, {
            width: column.width - 10,
            align: column.align
          });
        });

        // Draw column separators
        columns.forEach((column, index) => {
          if (index < columns.length - 1) {
            doc.strokeColor('#d1d5db')
               .lineWidth(0.5)
               .moveTo(column.x + column.width, tableStartY)
               .lineTo(column.x + column.width, tableStartY + headerHeight)
               .stroke();
          }
        });

        let currentY = tableStartY + headerHeight;

        // Draw table data
        doc.fontSize(9).font('Helvetica');
        outings.forEach((outing, index) => {
          // Check if we need a new page
          if (currentY > 500) {
            doc.addPage();
            currentY = 50;
            
            // Redraw header on new page
            doc.fillColor('#f3f4f6')
               .rect(tableStartX, currentY, totalWidth, headerHeight)
               .fill();
            
            doc.strokeColor('#000000')
               .lineWidth(1)
               .rect(tableStartX, currentY, totalWidth, headerHeight)
               .stroke();

            doc.fillColor('#000000');
            doc.fontSize(10).font('Helvetica-Bold');
            columns.forEach(column => {
              doc.text(column.title, column.x + 5, currentY + 10, {
                width: column.width - 10,
                align: column.align
              });
            });

            // Draw column separators on new page
            columns.forEach((column, colIndex) => {
              if (colIndex < columns.length - 1) {
                doc.strokeColor('#d1d5db')
                   .lineWidth(0.5)
                   .moveTo(column.x + column.width, currentY)
                   .lineTo(column.x + column.width, currentY + headerHeight)
                   .stroke();
              }
            });

            currentY += headerHeight;
            doc.fontSize(9).font('Helvetica');
          }

          // Draw row background (alternate colors)
          doc.fillColor(index % 2 === 0 ? '#ffffff' : '#f9fafb')
             .rect(tableStartX, currentY, totalWidth, rowHeight)
             .fill();

          // Draw row border
          doc.strokeColor('#e5e7eb')
             .lineWidth(0.5)
             .rect(tableStartX, currentY, totalWidth, rowHeight)
             .stroke();

          // Draw row data
          doc.fillColor('#000000');
          const rowData = [
            { text: (index + 1).toString(), align: 'center' },
            { text: new Date(outing.createdAt).toLocaleDateString(), align: 'center' },
            { text: outing.outingTime || 'N/A', align: 'center' },
            { text: outing.returnTime || 'N/A', align: 'center' },
            { text: outing.purpose || 'N/A', align: 'left' },
            { text: 'Completed', align: 'center' },
            { text: outing.approvals?.warden?.approvedAt ? 
                new Date(outing.approvals.warden.approvedAt).toLocaleDateString() : 'N/A', align: 'center' }
          ];

          columns.forEach((column, colIndex) => {
            doc.text(rowData[colIndex].text, column.x + 5, currentY + 8, {
              width: column.width - 10,
              align: column.align
            });
          });

          // Draw column separators for data rows
          columns.forEach((column, colIndex) => {
            if (colIndex < columns.length - 1) {
              doc.strokeColor('#e5e7eb')
                 .lineWidth(0.5)
                 .moveTo(column.x + column.width, currentY)
                 .lineTo(column.x + column.width, currentY + rowHeight)
                 .stroke();
            }
          });

          currentY += rowHeight;
        });

        // Draw final table border
        doc.strokeColor('#000000')
           .lineWidth(1)
           .rect(tableStartX, tableStartY, totalWidth, currentY - tableStartY)
           .stroke();

      } else {
        doc.fontSize(14).font('Helvetica').text('No past outings found.', { align: 'center' });
      }

      doc.end();
    } catch (error) {
      console.error('📄 PDF generation error in function:', error);
      reject(error);
    }
  });
};

module.exports = { generatePDF, generateGateActivityPDF, generatePastOutingsPDF };
