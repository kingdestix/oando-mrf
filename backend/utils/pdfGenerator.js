// backend/utils/pdfGenerator.js
// PDF Generator matching new-request.html exact layout

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate MRF PDF matching form layout
 * @param {Object} request - Request data with lines
 * @param {string} outputPath - Where to save PDF
 */
async function generateMRFPDF(request, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 30, // Tighter margins like the form
        info: {
          Title: `MRF ${request.mrf_number}`,
          Author: 'Oando Energy',
          Subject: 'Material Request Form'
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header matching form
      drawCompactHeader(doc, request);
      
      // Section 1: Requestor Information (compact layout)
      drawSection1Compact(doc, request);
      
      // Section 2: Work & Priority Details (4-column grid)
      drawSection2Compact(doc, request);
      
      // Section 3: Materials Table
      drawSection3Compact(doc, request);
      
      // Section 4: Remarks (if exists)
      if (request.remarks) {
        drawSection4Compact(doc, request);
      }
      
      // Footer
      drawCompactFooter(doc);

      doc.end();

      stream.on('finish', () => {
        console.log('✅ PDF generated:', outputPath);
        resolve(outputPath);
      });

      stream.on('error', (err) => {
        console.error('❌ PDF generation error:', err);
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

function drawCompactHeader(doc, request) {
  const pageWidth = doc.page.width;
  
  // White background with border
  doc.rect(30, 25, pageWidth - 60, 45)
     .lineWidth(1)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.rect(31, 26, pageWidth - 62, 5)
     .fill('#F58220'); // Orange top border
  
  // Left side - Title
  doc.fontSize(11)
     .fillColor('#00205B')
     .font('Helvetica-Bold')
     .text('MATERIAL REQUEST FORM', 40, 38);
  
  doc.fontSize(7)
     .fillColor('#6B7280')
     .font('Helvetica')
     .text('Enterprise Resource Planning System', 40, 52);
  
  // Right side - MRF Number box
  const boxX = pageWidth - 180;
  doc.rect(boxX, 32, 145, 32)
     .lineWidth(1)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.fontSize(6)
     .fillColor('#6B7280')
     .font('Helvetica')
     .text('REQUEST REFERENCE', boxX + 5, 36);
  
  doc.fontSize(11)
     .fillColor('#F58220')
     .font('Helvetica-Bold')
     .text(request.mrf_number, boxX + 5, 48);
  
  doc.moveDown(3);
}

function drawSection1Compact(doc, request) {
  const y = 85;
  const pageWidth = doc.page.width;
  
  // Section header - Navy background with orange border
  doc.rect(30, y, pageWidth - 60, 20)
     .fill('#00205B');
  
  doc.rect(30, y + 20, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('1. REQUESTOR INFORMATION', 38, y + 6);
  
  // Body - flex layout matching form
  const bodyY = y + 28;
  const fields = [
    { label: 'FIRST NAME', value: request.first_name, width: 85 },
    { label: 'LAST NAME', value: request.last_name, width: 85 },
    { label: 'USER ID', value: request.user_code, width: 65 },
    { label: 'DESIGNATION', value: request.designation, width: 100 },
    { label: 'OFFICE EXT.', value: request.office_extension || 'N/A', width: 50 },
    { label: 'LOCATION', value: request.asset || 'N/A', width: 90 }
  ];
  
  let currentX = 38;
  const gap = 8;
  
  fields.forEach((field, index) => {
    // Label
    doc.fontSize(6)
       .fillColor('#6B7280')
       .font('Helvetica-Bold')
       .text(field.label, currentX, bodyY);
    
    // Locked input box
    doc.rect(currentX, bodyY + 10, field.width, 18)
       .fillAndStroke('#F9FAFB', '#E5E7EB');
    
    // Value
    doc.fontSize(8)
       .fillColor('#00205B')
       .font('Helvetica-Bold')
       .text(field.value, currentX + 3, bodyY + 15, {
         width: field.width - 6,
         ellipsis: true
       });
    
    currentX += field.width + gap;
  });
  
  doc.y = bodyY + 35;
}

function drawSection2Compact(doc, request) {
  const y = doc.y + 12;
  const pageWidth = doc.page.width;
  
  // Section header
  doc.rect(30, y, pageWidth - 60, 20)
     .fill('#00205B');
  
  doc.rect(30, y + 20, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('2. WORK & PRIORITY DETAILS', 38, y + 6);
  
  // 4-column grid matching form
  const bodyY = y + 28;
  const colWidth = (pageWidth - 90) / 4; // 4 equal columns
  const gap = 10;
  
  const gridFields = [
    // Row 1
    [
      { label: 'AREA', value: request.area || extractAreaFromAsset(request.asset) },
      { label: 'SPECIFIC LOCATION', value: request.asset || 'N/A' },
      { label: 'UNIT TAG', value: request.unit_tag || 'N/A' },
      { label: 'PRIORITY', value: request.criticality, color: '#F58220' }
    ],
    // Row 2
    [
      { label: 'DISCIPLINE', value: request.discipline },
      { label: 'CATEGORY', value: request.material_category || 'N/A' },
      { label: 'WORK ORDER NUMBER', value: request.work_order_no || 'N/A' },
      { label: 'WORK ORDER TYPE', value: request.work_order_type || 'N/A' }
    ]
  ];
  
  let currentY = bodyY;
  
  gridFields.forEach((row, rowIndex) => {
    let currentX = 38;
    
    row.forEach(field => {
      // Label
      doc.fontSize(6)
         .fillColor('#6B7280')
         .font('Helvetica-Bold')
         .text(field.label, currentX, currentY);
      
      // Input box
      doc.rect(currentX, currentY + 10, colWidth, 16)
         .lineWidth(0.5)
         .strokeColor('#D1D5DB')
         .stroke();
      
      // Value
      doc.fontSize(7)
         .fillColor(field.color || '#000000')
         .font('Helvetica')
         .text(field.value, currentX + 3, currentY + 14, {
           width: colWidth - 6,
           ellipsis: true
         });
      
      currentX += colWidth + gap;
    });
    
    currentY += 32; // Row spacing
  });
  
  // Reason/Justification (full width)
  currentY += 6;
  doc.fontSize(6)
     .fillColor('#6B7280')
     .font('Helvetica-Bold')
     .text('REASON / JUSTIFICATION', 38, currentY);
  
  doc.rect(38, currentY + 10, pageWidth - 76, 30)
     .lineWidth(0.5)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.fontSize(7)
     .fillColor('#000000')
     .font('Helvetica')
     .text(request.reason, 41, currentY + 14, {
       width: pageWidth - 82,
       align: 'justify'
     });
  
  doc.y = currentY + 48;
}

function drawSection3Compact(doc, request) {
  const y = doc.y + 12;
  const pageWidth = doc.page.width;
  
  // Check if need new page
  if (y > 650) {
    doc.addPage();
    doc.y = 50;
  }
  
  const tableTop = doc.y;
  
  // Section header
  doc.rect(30, tableTop, pageWidth - 60, 20)
     .fill('#00205B');
  
  doc.rect(30, tableTop + 20, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('3. MATERIAL SPECIFICATIONS', 38, tableTop + 6);
  
  // Table header matching form columns
  const tableY = tableTop + 28;
  doc.rect(30, tableY, pageWidth - 60, 20)
     .fill('#F3F4F6');
  
  doc.rect(30, tableY + 20, pageWidth - 60, 2)
     .fill('#00205B'); // Navy border bottom
  
  doc.fontSize(6.5)
     .fillColor('#00205B')
     .font('Helvetica-Bold');
  
  // Column headers with exact widths from form
  const cols = {
    sn: { x: 35, width: 25, label: '#' },
    desc: { x: 65, width: 180, label: 'MATERIAL DESCRIPTION' },
    oem: { x: 250, width: 80, label: 'OEM/MODEL' },
    part: { x: 335, width: 80, label: 'PART NUMBER' },
    qty: { x: 420, width: 45, label: 'QTY' },
    unit: { x: 470, width: 45, label: 'UNIT' }
  };
  
  Object.values(cols).forEach(col => {
    doc.text(col.label, col.x, tableY + 7);
  });
  
  // Table rows
  let rowY = tableY + 22;
  
  request.lines.forEach((line, index) => {
    // Check if need new page
    if (rowY > doc.page.height - 80) {
      doc.addPage();
      rowY = 50;
    }
    
    // Alternate row colors
    if (index % 2 === 0) {
      doc.rect(30, rowY, pageWidth - 60, 22).fill('#FAFAFA');
    }
    
    // Draw borders
    doc.rect(30, rowY, pageWidth - 60, 22)
       .lineWidth(0.5)
       .strokeColor('#D1D5DB')
       .stroke();
    
    doc.fontSize(7)
       .fillColor('#000000')
       .font('Helvetica');
    
    // S/N (bold, navy)
    doc.font('Helvetica-Bold')
       .fillColor('#00205B')
       .text((index + 1).toString(), cols.sn.x, rowY + 7, { 
         width: cols.sn.width, 
         align: 'center' 
       });
    
    doc.font('Helvetica').fillColor('#000000');
    
    // Material Description
    doc.text(line.material_description, cols.desc.x + 2, rowY + 7, {
      width: cols.desc.width - 4,
      ellipsis: true
    });
    
    // OEM/Model
    doc.text(line.oem_model || '-', cols.oem.x + 2, rowY + 7, {
      width: cols.oem.width - 4,
      ellipsis: true
    });
    
    // Part Number
    doc.text(line.part_number || '-', cols.part.x + 2, rowY + 7, {
      width: cols.part.width - 4,
      ellipsis: true
    });
    
    // Quantity
    doc.text(line.quantity.toString(), cols.qty.x + 2, rowY + 7, {
      width: cols.qty.width - 4,
      align: 'right'
    });
    
    // Unit
    doc.text(line.quantity_unit, cols.unit.x + 2, rowY + 7, {
      width: cols.unit.width - 4
    });
    
    rowY += 22;
  });
  
  doc.y = rowY + 10;
}

function drawSection4Compact(doc, request) {
  const y = doc.y + 12;
  const pageWidth = doc.page.width;
  
  if (y > 700) {
    doc.addPage();
    doc.y = 50;
  }
  
  // Section header
  doc.rect(30, doc.y, pageWidth - 60, 20)
     .fill('#00205B');
  
  doc.rect(30, doc.y + 20, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('4. ADDITIONAL REMARKS', 38, doc.y + 6);
  
  doc.moveDown(1.5);
  
  const remarksY = doc.y;
  doc.rect(38, remarksY, pageWidth - 76, 30)
     .lineWidth(0.5)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.fontSize(7)
     .fillColor('#000000')
     .font('Helvetica')
     .text(request.remarks, 41, remarksY + 4, {
       width: pageWidth - 82,
       align: 'justify'
     });
  
  doc.moveDown(2);
}

function drawCompactFooter(doc) {
  const footerY = doc.page.height - 35;
  const pageWidth = doc.page.width;
  
  // Thin line above footer
  doc.moveTo(30, footerY - 5)
     .lineTo(pageWidth - 30, footerY - 5)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.fontSize(6.5)
     .fillColor('#6B7280')
     .font('Helvetica')
     .text(
       `Generated: ${new Date().toLocaleString('en-US', { 
         year: 'numeric', 
         month: 'short', 
         day: 'numeric',
         hour: '2-digit',
         minute: '2-digit'
       })} | Oando Material Request System`,
       30,
       footerY,
       { align: 'center', width: pageWidth - 60 }
     );
}

// Helper function to extract area from asset
function extractAreaFromAsset(asset) {
  if (!asset) return 'N/A';
  
  const assetUpper = asset.toUpperCase();
  
  if (assetUpper.includes('LAND') || 
      ['OBOB', 'KWALE', 'IRRI', 'OSHIE', 'EBOCHA', 'IDU', 'AKRI'].some(loc => assetUpper.includes(loc))) {
    return 'Land Area';
  }
  
  if (assetUpper.includes('SWAMP') || 
      ['OGBOINBIRI', 'BRASS', 'OBAMA', 'CLOUGH CREEK'].some(loc => assetUpper.includes(loc))) {
    return 'Swamp Area';
  }
  
  if (assetUpper.includes('PHC') || 
      ['SAMABIRI', 'TEBIDABA'].some(loc => assetUpper.includes(loc))) {
    return 'PHC POD';
  }
  
  return 'N/A';
}

module.exports = { generateMRFPDF };