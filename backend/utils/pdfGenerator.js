// backend/utils/pdfGenerator.js
// ✅ OPTIMIZED FOR ONE PAGE - Professional PDF with Status Badge

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../../frontend/assets/images/oando-logo.png');

/**
 * Get status badge information based on workflow stage or status
 */
function getStatusBadgeInfo(request) {
  const workflowStage = request.workflow_stage || request.status || 'MRF_CREATED';
  const status = request.status || '';
  
  // Map workflow stages to badge info
  const statusMap = {
    'MRF_CREATED': { text: 'PENDING', bgColor: '#FEF3C7', textColor: '#92400E', borderColor: '#FCD34D' },
    'MRF_APPROVED': { text: 'APPROVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'BLANKET_CHECK': { text: 'IN REVIEW', bgColor: '#DBEAFE', textColor: '#1E40AF', borderColor: '#3B82F6' },
    'QUOTATION_REQUESTED': { text: 'QUOTATION REQUESTED', bgColor: '#E0E7FF', textColor: '#3730A3', borderColor: '#6366F1' },
    'QUOTATION_SUBMITTED': { text: 'QUOTATION SUBMITTED', bgColor: '#E0E7FF', textColor: '#3730A3', borderColor: '#6366F1' },
    'QUOTATION_APPROVED': { text: 'QUOTATION APPROVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'QUOTATION_ACCEPTED': { text: 'QUOTATION ACCEPTED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'PROFORMA_SUBMITTED': { text: 'PROFORMA SUBMITTED', bgColor: '#E0F2FE', textColor: '#0C4A6E', borderColor: '#0EA5E9' },
    'PROFORMA_APPROVED': { text: 'PROFORMA APPROVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'SHIPPED': { text: 'SHIPPED', bgColor: '#FCE7F3', textColor: '#831843', borderColor: '#EC4899' },
    'COMPLIANCE_CHECK': { text: 'COMPLIANCE CHECK', bgColor: '#F3E8FF', textColor: '#6B21A8', borderColor: '#A855F7' },
    'RECEIVED': { text: 'RECEIVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'CLOSED': { text: 'CLOSED', bgColor: '#F3F4F6', textColor: '#374151', borderColor: '#9CA3AF' },
    'REJECTED': { text: 'REJECTED', bgColor: '#FEE2E2', textColor: '#991B1B', borderColor: '#EF4444' },
    'RESCHEDULED': { text: 'RESCHEDULED', bgColor: '#FEF3C7', textColor: '#92400E', borderColor: '#FCD34D' }
  };
  
  // Try workflow stage first, then fallback to status
  let badgeInfo = statusMap[workflowStage];
  
  if (!badgeInfo) {
    // Fallback to status field
    const statusUpper = status.toUpperCase();
    if (statusUpper.includes('PENDING')) {
      badgeInfo = statusMap['MRF_CREATED'];
    } else if (statusUpper.includes('APPROVED')) {
      badgeInfo = statusMap['MRF_APPROVED'];
    } else if (statusUpper.includes('REJECTED')) {
      badgeInfo = statusMap['REJECTED'];
    } else if (statusUpper.includes('ORDERED') || statusUpper.includes('SHIPPED')) {
      badgeInfo = statusMap['SHIPPED'];
    } else if (statusUpper.includes('DELIVERED') || statusUpper.includes('RECEIVED')) {
      badgeInfo = statusMap['RECEIVED'];
    } else if (statusUpper.includes('COMPLETED') || statusUpper.includes('CLOSED')) {
      badgeInfo = statusMap['CLOSED'];
    } else {
      badgeInfo = statusMap['MRF_CREATED'];
    }
  }
  
  return badgeInfo;
}

/**
 * Generate MRF PDF optimized for one page
 */
async function generateMRFPDF(request, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 30,
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: `MRF ${request.mrf_number}`,
          Author: 'Oando Energy',
          Subject: 'Material Request Form'
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Draw sections with minimal spacing for one page
      drawHeader(doc, request);
      doc.y += 2;
      
      drawRequestorInfo(doc, request);
      doc.y += 2;
      
      drawWorkDetails(doc, request);
      doc.y += 2;
      
      drawMaterialsTable(doc, request);
      
      if (request.remarks && request.remarks.trim()) {
        doc.y += 2;
        drawRemarks(doc, request);
      }
      
      drawFooter(doc);

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

// ===================================
// HEADER with Professional Status Badge
// ===================================
function drawHeader(doc, request) {
  const pageWidth = doc.page.width;
  const startY = 30;
  
  doc.rect(30, startY, pageWidth - 60, 48)
     .lineWidth(1)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.rect(31, startY + 1, pageWidth - 62, 3)
     .fill('#F58220');
  
  // Logo - more breathing room
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, 40, startY + 8, { width: 80, height: 30 });
    } else {
      doc.fontSize(14)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('OANDO', 40, startY + 15);
    }
  } catch (error) {
    doc.fontSize(14)
       .fillColor('#00205B')
       .font('Helvetica-Bold')
       .text('OANDO', 40, startY + 15);
  }
  
  // Title
  const centerX = pageWidth / 2;
  doc.fontSize(11)
     .fillColor('#00205B')
     .font('Helvetica-Bold')
     .text('MATERIAL REQUEST FORM', centerX - 80, startY + 12, { width: 160, align: 'center' });
  
  doc.fontSize(7)
     .fillColor('#6B7280')
     .font('Helvetica')
     .text('Enterprise Resource Planning System', centerX - 80, startY + 26, { width: 160, align: 'center' });
  
  // MRF Number Box
  const boxX = pageWidth - 170;
  doc.rect(boxX, startY + 8, 130, 32)
     .lineWidth(1)
     .strokeColor('#E5E7EB')
     .stroke();
  
  doc.fontSize(6)
     .fillColor('#6B7280')
     .font('Helvetica')
     .text('REQUEST REFERENCE', boxX + 4, startY + 12);
  
  doc.fontSize(9)
     .fillColor('#F58220')
     .font('Helvetica-Bold')
     .text(request.mrf_number, boxX + 4, startY + 22);
  
  // Professional Status Badge - moved to top-right corner next to MRF number
  const badgeInfo = getStatusBadgeInfo(request);
  const badgeX = boxX - 140; // Position to the left of the MRF box
  const badgeY = startY + 8;
  const badgeWidth = 130;
  const badgeHeight = 18;
  
  // Badge background
  doc.rect(badgeX, badgeY, badgeWidth, badgeHeight)
     .fill(badgeInfo.bgColor);
  
  // Badge border
  doc.rect(badgeX, badgeY, badgeWidth, badgeHeight)
     .lineWidth(1.5)
     .strokeColor(badgeInfo.borderColor)
     .stroke();
  
  // Badge text
  doc.fontSize(7)
     .fillColor(badgeInfo.textColor)
     .font('Helvetica-Bold')
     .text(badgeInfo.text, badgeX + 4, badgeY + 5, {
       width: badgeWidth - 8,
       align: 'center'
     });
  
  doc.y = startY + 65;
}

// ===================================
// SECTION 1: REQUESTOR INFORMATION
// ===================================
function drawRequestorInfo(doc, request) {
  const startY = doc.y;
  const pageWidth = doc.page.width;
  
  // Section header
  doc.rect(30, startY, pageWidth - 60, 15)
     .fill('#00205B');
  
  doc.rect(30, startY + 15, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('1. REQUESTOR INFORMATION', 36, startY + 4);
  
  // Fields
  const bodyY = startY + 22;
  const fields = [
    { label: 'FIRST NAME', value: request.first_name, width: 75 },
    { label: 'LAST NAME', value: request.last_name, width: 75 },
    { label: 'USER ID', value: request.user_code, width: 55 },
    { label: 'DESIGNATION', value: request.designation || 'N/A', width: 90 },
    { label: 'EXT.', value: request.office_extension || 'N/A', width: 38 },
    { label: 'LOCATION', value: request.asset || 'N/A', width: 80 }
  ];
  
  let currentX = 36;
  const gap = 5;
  
  fields.forEach(field => {
    doc.fontSize(6)
       .fillColor('#6B7280')
       .font('Helvetica-Bold')
       .text(field.label, currentX, bodyY);
    
    doc.rect(currentX, bodyY + 8, field.width, 14)
       .fillAndStroke('#F9FAFB', '#E5E7EB');
    
    doc.fontSize(7)
       .fillColor('#00205B')
       .font('Helvetica-Bold')
       .text(field.value, currentX + 2, bodyY + 10, {
         width: field.width - 4,
         ellipsis: true
       });
    
    currentX += field.width + gap;
  });
  
  doc.y = bodyY + 26;
}

// ===================================
// SECTION 2: WORK DETAILS
// ===================================
function drawWorkDetails(doc, request) {
  const startY = doc.y;
  const pageWidth = doc.page.width;
  
  doc.rect(30, startY, pageWidth - 60, 15)
     .fill('#00205B');
  
  doc.rect(30, startY + 15, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('2. WORK & PRIORITY DETAILS', 36, startY + 4);
  
  const bodyY = startY + 22;
  const colWidth = (pageWidth - 100) / 4;
  const gap = 6;
  
  const gridRows = [
    [
      { label: 'AREA', value: extractAreaFromAsset(request.asset) },
      { label: 'LOCATION', value: request.asset || 'N/A' },
      { label: 'UNIT TAG', value: request.unit_tag || 'N/A' },
      { label: 'PRIORITY', value: request.criticality, bold: true, color: '#F58220' }
    ],
    [
      { label: 'DISCIPLINE', value: request.discipline },
      { label: 'CATEGORY', value: request.material_category || 'N/A' },
      { label: 'WORK ORDER', value: request.work_order_no || 'N/A' },
      { label: 'WO TYPE', value: request.work_order_type || 'N/A' }
    ]
  ];
  
  let currentY = bodyY;
  
  gridRows.forEach(row => {
    let currentX = 36;
    
    row.forEach(field => {
      doc.fontSize(6)
         .fillColor('#6B7280')
         .font('Helvetica-Bold')
         .text(field.label, currentX, currentY);
      
      doc.rect(currentX, currentY + 8, colWidth, 12)
         .lineWidth(0.5)
         .strokeColor('#D1D5DB')
         .stroke();
      
      doc.fontSize(7)
         .fillColor(field.color || '#000000')
         .font(field.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(field.value, currentX + 2, currentY + 10, {
           width: colWidth - 4,
           ellipsis: true
         });
      
      currentX += colWidth + gap;
    });
    
    currentY += 24;
  });
  
  // Reason
  currentY += 4;
  doc.fontSize(6)
     .fillColor('#6B7280')
     .font('Helvetica-Bold')
     .text('REASON / JUSTIFICATION', 36, currentY);
  
  const reasonHeight = 22;
  doc.rect(36, currentY + 8, pageWidth - 72, reasonHeight)
     .lineWidth(0.5)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.fontSize(7)
     .fillColor('#000000')
     .font('Helvetica')
     .text(request.reason, 38, currentY + 10, {
       width: pageWidth - 76,
       height: reasonHeight - 4,
       ellipsis: true
     });
  
  doc.y = currentY + reasonHeight + 8;
}

// ===================================
// SECTION 3: MATERIALS TABLE
// ===================================
function drawMaterialsTable(doc, request) {
  const pageWidth = doc.page.width;
  
  const tableTop = doc.y;
  
  doc.rect(30, tableTop, pageWidth - 60, 15)
     .fill('#00205B');
  
  doc.rect(30, tableTop + 15, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('3. MATERIALS SPECIFICATION', 36, tableTop + 4);
  
  // Table header
  const headerY = tableTop + 22;
  doc.rect(30, headerY, pageWidth - 60, 15)
     .fill('#F3F4F6');
  
  doc.rect(30, headerY + 15, pageWidth - 60, 1.5)
     .fill('#00205B');
  
  doc.fontSize(6.5)
     .fillColor('#00205B')
     .font('Helvetica-Bold');
  
  const cols = {
    sn: { x: 35, width: 20, label: '#' },
    desc: { x: 60, width: 175, label: 'MATERIAL DESCRIPTION' },
    oem: { x: 240, width: 70, label: 'OEM/MODEL' },
    part: { x: 315, width: 70, label: 'PART NUMBER' },
    qty: { x: 390, width: 35, label: 'QTY' },
    unit: { x: 430, width: 40, label: 'UNIT' }
  };
  
  Object.values(cols).forEach(col => {
    doc.text(col.label, col.x, headerY + 4);
  });
  
  // Rows - limit to fit on one page
  let rowY = headerY + 17;
  const rowHeight = 16;
  const maxRows = Math.floor((doc.page.height - rowY - 45) / rowHeight);
  const linesToShow = request.lines.slice(0, maxRows);
  
  linesToShow.forEach((line, index) => {
    if (index % 2 === 0) {
      doc.rect(30, rowY, pageWidth - 60, rowHeight).fill('#FAFAFA');
    }
    
    doc.rect(30, rowY, pageWidth - 60, rowHeight)
       .lineWidth(0.5)
       .strokeColor('#E5E7EB')
       .stroke();
    
    doc.fontSize(7)
       .fillColor('#000000')
       .font('Helvetica');
    
    doc.font('Helvetica-Bold')
       .fillColor('#00205B')
       .text((index + 1).toString(), cols.sn.x, rowY + 5, { 
         width: cols.sn.width, 
         align: 'center' 
       });
    
    doc.font('Helvetica').fillColor('#000000');
    
    doc.text(line.material_description, cols.desc.x + 2, rowY + 5, {
      width: cols.desc.width - 4,
      ellipsis: true
    });
    
    doc.text(line.oem_model || '-', cols.oem.x + 2, rowY + 5, {
      width: cols.oem.width - 4,
      ellipsis: true
    });
    
    doc.text(line.part_number || '-', cols.part.x + 2, rowY + 5, {
      width: cols.part.width - 4,
      ellipsis: true
    });
    
    doc.text(line.quantity.toString(), cols.qty.x + 2, rowY + 5, {
      width: cols.qty.width - 4,
      align: 'right'
    });
    
    doc.text(line.quantity_unit, cols.unit.x + 2, rowY + 5, {
      width: cols.unit.width - 4
    });
    
    rowY += rowHeight;
  });
  
  // Show note if items were truncated
  if (request.lines.length > maxRows) {
    doc.fontSize(6)
       .fillColor('#6B7280')
       .font('Helvetica-Italic')
       .text(`Note: Showing ${maxRows} of ${request.lines.length} items`, 36, rowY + 2);
    rowY += 8;
  }
  
  doc.y = rowY + 5;
}

// ===================================
// SECTION 4: REMARKS
// ===================================
function drawRemarks(doc, request) {
  const pageWidth = doc.page.width;
  
  // Only show if there's space
  if (doc.y > doc.page.height - 60) {
    return;
  }
  
  doc.rect(30, doc.y, pageWidth - 60, 15)
     .fill('#00205B');
  
  doc.rect(30, doc.y + 15, pageWidth - 60, 2)
     .fill('#F58220');
  
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .text('4. ADDITIONAL REMARKS', 36, doc.y + 4);
  
  doc.y += 22;
  
  const availableHeight = doc.page.height - doc.y - 35;
  const remarksHeight = Math.min(18, availableHeight);
  
  doc.rect(36, doc.y, pageWidth - 72, remarksHeight)
     .lineWidth(0.5)
     .strokeColor('#D1D5DB')
     .stroke();
  
  doc.fontSize(7)
     .fillColor('#000000')
     .font('Helvetica')
     .text(request.remarks, 38, doc.y + 2, {
       width: pageWidth - 76,
       height: remarksHeight - 4,
       ellipsis: true
     });
  
  doc.y += remarksHeight + 5;
}

// ===================================
// FOOTER
// ===================================
function drawFooter(doc) {
  const footerY = doc.page.height - 25;
  const pageWidth = doc.page.width;
  
  doc.moveTo(30, footerY - 6)
     .lineTo(pageWidth - 30, footerY - 6)
     .strokeColor('#E5E7EB')
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
       footerY - 2,
       { align: 'center', width: pageWidth - 60 }
     );
}

// ===================================
// HELPER
// ===================================
function extractAreaFromAsset(asset) {
  if (!asset) return 'N/A';
  
  const assetUpper = asset.toUpperCase();
  
  const landLocations = ['OBOB', 'KWALE', 'IRRI', 'OSHIE', 'EBOCHA', 'IDU', 'AKRI'];
  const swampLocations = ['OGBOINBIRI', 'BRASS', 'OBAMA', 'CLOUGH CREEK'];
  const phcLocations = ['PHC', 'SAMABRI', 'TEBIDABA'];
  
  if (assetUpper.includes('LAND') || landLocations.some(loc => assetUpper.includes(loc))) {
    return 'Land Area';
  }
  
  if (assetUpper.includes('SWAMP') || swampLocations.some(loc => assetUpper.includes(loc))) {
    return 'Swamp Area';
  }
  
  if (phcLocations.some(loc => assetUpper.includes(loc))) {
    return 'PHC POD';
  }
  
  return 'N/A';
}

module.exports = { generateMRFPDF };