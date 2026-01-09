// backend/utils/analyticsExporter.js
// Enhanced Export analytics as PDF or Word document with full data and charts

const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = require('docx');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

const LOGO_PATH = path.join(__dirname, '../../frontend/assets/images/oando-logo.png');

/**
 * Get comprehensive analytics data for export
 */
async function getFullAnalyticsData(dateFrom, dateTo) {
  // Get summary with proper calculations
  const summaryResult = await query(
    `SELECT 
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE status = 'Pending') as pending_requests,
      COUNT(*) FILTER (WHERE status = 'Approved') as approved_requests,
      COUNT(*) FILTER (WHERE status = 'Rejected') as rejected_requests,
      COUNT(*) FILTER (WHERE status = 'Ordered') as ordered_requests,
      COUNT(*) FILTER (WHERE status = 'Delivered') as delivered_requests,
      COUNT(*) FILTER (WHERE status = 'Completed') as completed_requests
     FROM material_requests r
     WHERE r.request_date BETWEEN $1 AND $2`,
    [dateFrom, dateTo]
  );

  // Get total values from line items (use total_price if available, otherwise calculate)
  const valueResult = await query(
    `SELECT 
      COALESCE(SUM(COALESCE(l.total_price_usd, l.quantity * COALESCE(l.unit_price_usd, 0))), 0) as total_value_usd,
      COALESCE(SUM(l.quantity * COALESCE(l.unit_price_eur, 0)), 0) as total_value_eur,
      COALESCE(SUM(COALESCE(l.total_price_ngn, l.quantity * COALESCE(l.unit_price_ngn, 0))), 0) as total_value_ngn,
      COALESCE(SUM(l.quantity), 0) as total_quantity
     FROM material_request_lines l
     JOIN material_requests r ON r.id = l.request_id
     WHERE r.request_date BETWEEN $1 AND $2`,
    [dateFrom, dateTo]
  );

  // Get top materials
  const topMaterialsResult = await query(
    `SELECT 
      l.material_description,
      l.quantity_unit,
      SUM(l.quantity) as total_quantity,
      COUNT(DISTINCT l.request_id) as request_count,
      SUM(COALESCE(l.total_price_usd, l.quantity * COALESCE(l.unit_price_usd, 0))) as total_value_usd,
      SUM(COALESCE(l.total_price_ngn, l.quantity * COALESCE(l.unit_price_ngn, 0))) as total_value_ngn
     FROM material_request_lines l
     JOIN material_requests r ON r.id = l.request_id
     WHERE r.request_date BETWEEN $1 AND $2
     GROUP BY l.material_description, l.quantity_unit
     ORDER BY total_quantity DESC
     LIMIT 10`,
    [dateFrom, dateTo]
  );

  // Get requests by location
  const byLocationResult = await query(
    `SELECT 
      r.asset as location,
      COUNT(*) as request_count,
      SUM((SELECT SUM(l.quantity) FROM material_request_lines l WHERE l.request_id = r.id)) as total_quantity
     FROM material_requests r
     WHERE r.request_date BETWEEN $1 AND $2
     GROUP BY r.asset
     ORDER BY request_count DESC
     LIMIT 15`,
    [dateFrom, dateTo]
  );

  // Get requests by discipline
  const byDisciplineResult = await query(
    `SELECT 
      r.discipline,
      COUNT(*) as request_count,
      COALESCE(SUM((SELECT SUM(COALESCE(l.total_price_usd, l.quantity * COALESCE(l.unit_price_usd, 0))) FROM material_request_lines l WHERE l.request_id = r.id)), 0) as total_value_usd
     FROM material_requests r
     WHERE r.request_date BETWEEN $1 AND $2
     GROUP BY r.discipline
     ORDER BY request_count DESC`,
    [dateFrom, dateTo]
  );

  // Get requests by status
  const byStatusResult = await query(
    `SELECT 
      r.status,
      COUNT(*) as count
     FROM material_requests r
     WHERE r.request_date BETWEEN $1 AND $2
     GROUP BY r.status
     ORDER BY count DESC`,
    [dateFrom, dateTo]
  );

  return {
    summary: {
      totalRequests: parseInt(summaryResult.rows[0].total_requests) || 0,
      pendingRequests: parseInt(summaryResult.rows[0].pending_requests) || 0,
      approvedRequests: parseInt(summaryResult.rows[0].approved_requests) || 0,
      rejectedRequests: parseInt(summaryResult.rows[0].rejected_requests) || 0,
      orderedRequests: parseInt(summaryResult.rows[0].ordered_requests) || 0,
      deliveredRequests: parseInt(summaryResult.rows[0].delivered_requests) || 0,
      completedRequests: parseInt(summaryResult.rows[0].completed_requests) || 0,
      totalValueUSD: parseFloat(valueResult.rows[0].total_value_usd) || 0,
      totalValueEUR: parseFloat(valueResult.rows[0].total_value_eur) || 0,
      totalValueNGN: parseFloat(valueResult.rows[0].total_value_ngn) || 0,
      totalQuantity: parseFloat(valueResult.rows[0].total_quantity) || 0
    },
    topMaterials: topMaterialsResult.rows,
    byLocation: byLocationResult.rows,
    byDiscipline: byDisciplineResult.rows,
    byStatus: byStatusResult.rows
  };
}

/**
 * Export analytics as PDF with full details
 */
async function exportAnalyticsPDF(analyticsData, period, dateFrom, dateTo, chartImages, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = doc.page.width - 60;
      let currentY = 30;

      // Header with logo
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, 30, currentY, { width: 80, height: 30 });
      }
      
      doc.fontSize(20)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('MATERIAL REQUEST ANALYTICS REPORT', 120, currentY + 5);

      doc.fontSize(10)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text(`${period.charAt(0).toUpperCase() + period.slice(1)} Report`, 120, currentY + 28)
         .text(`Period: ${new Date(dateFrom).toLocaleDateString()} - ${new Date(dateTo).toLocaleDateString()}`, 120, currentY + 40)
         .text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 150, currentY + 28, { align: 'right' });

      currentY += 70;

      // Executive Summary Box
      doc.rect(30, currentY, pageWidth, 80)
         .lineWidth(1.5)
         .strokeColor('#00205B')
         .fill('#F9FAFB')
         .stroke();

      doc.fontSize(12)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('EXECUTIVE SUMMARY', 40, currentY + 10);

      const summary = analyticsData.summary;
      const summaryCol1 = [
        `Total Requests: ${summary.totalRequests.toLocaleString()}`,
        `Pending: ${summary.pendingRequests.toLocaleString()}`,
        `Approved: ${summary.approvedRequests.toLocaleString()}`,
        `Rejected: ${summary.rejectedRequests.toLocaleString()}`
      ];
      const summaryCol2 = [
        `Total Value (USD): $${summary.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Total Value (NGN): ₦${summary.totalValueNGN.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Total Quantity: ${summary.totalQuantity.toLocaleString()}`,
        `Ordered: ${summary.orderedRequests.toLocaleString()} | Delivered: ${summary.deliveredRequests.toLocaleString()}`
      ];

      let summaryY = currentY + 30;
      summaryCol1.forEach((text, i) => {
        doc.fontSize(9)
           .fillColor('#000000')
           .font('Helvetica')
           .text(text, 40, summaryY + (i * 12));
      });

      summaryCol2.forEach((text, i) => {
        doc.fontSize(9)
           .fillColor('#000000')
           .font('Helvetica')
           .text(text, pageWidth / 2 + 20, summaryY + (i * 12));
      });

      currentY += 100;

      // Top Materials Section
      if (analyticsData.topMaterials && analyticsData.topMaterials.length > 0) {
        doc.fontSize(12)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('TOP 10 REQUESTED MATERIALS', 30, currentY);

        currentY += 20;

        // Table header
        doc.rect(30, currentY, pageWidth, 20)
           .fill('#00205B');

        doc.fontSize(8)
           .fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .text('Material Description', 35, currentY + 6)
           .text('Quantity', pageWidth - 100, currentY + 6, { align: 'right' })
           .text('Requests', pageWidth - 30, currentY + 6, { align: 'right' });

        currentY += 20;

        analyticsData.topMaterials.slice(0, 10).forEach((material, index) => {
          const rowHeight = 25;
          const isEven = index % 2 === 0;
          
          if (isEven) {
            doc.rect(30, currentY, pageWidth, rowHeight)
               .fill('#F9FAFB');
          }

          doc.fontSize(7)
             .fillColor('#000000')
             .font('Helvetica')
             .text((index + 1).toString(), 35, currentY + 8)
             .text(material.material_description || 'N/A', 50, currentY + 8, { width: pageWidth - 150, ellipsis: true })
             .text(`${parseFloat(material.total_quantity || 0).toLocaleString()} ${material.quantity_unit || 'pcs'}`, pageWidth - 100, currentY + 8, { align: 'right' })
             .text(material.request_count.toString(), pageWidth - 30, currentY + 8, { align: 'right' });

          currentY += rowHeight;
        });

        currentY += 15;
      }

      // Requests by Location
      if (analyticsData.byLocation && analyticsData.byLocation.length > 0) {
        doc.addPage();
        currentY = 30;

        doc.fontSize(12)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('REQUESTS BY LOCATION', 30, currentY);

        currentY += 20;

        // Table header
        doc.rect(30, currentY, pageWidth, 20)
           .fill('#00205B');

        doc.fontSize(8)
           .fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .text('Location', 35, currentY + 6)
           .text('Request Count', pageWidth / 2, currentY + 6, { align: 'center' })
           .text('Total Quantity', pageWidth - 30, currentY + 6, { align: 'right' });

        currentY += 20;

        analyticsData.byLocation.forEach((loc, index) => {
          const rowHeight = 20;
          const isEven = index % 2 === 0;
          
          if (isEven) {
            doc.rect(30, currentY, pageWidth, rowHeight)
               .fill('#F9FAFB');
          }

          doc.fontSize(8)
             .fillColor('#000000')
             .font('Helvetica')
             .text(loc.location || 'N/A', 35, currentY + 6)
             .text(loc.request_count.toString(), pageWidth / 2, currentY + 6, { align: 'center' })
             .text(parseFloat(loc.total_quantity || 0).toLocaleString(), pageWidth - 30, currentY + 6, { align: 'right' });

          currentY += rowHeight;
        });

        currentY += 15;
      }

      // Requests by Discipline
      if (analyticsData.byDiscipline && analyticsData.byDiscipline.length > 0) {
        doc.fontSize(12)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('REQUESTS BY DISCIPLINE', 30, currentY);

        currentY += 20;

        analyticsData.byDiscipline.forEach((disc, index) => {
          doc.fontSize(9)
             .fillColor('#000000')
             .font('Helvetica-Bold')
             .text(`${disc.discipline}:`, 30, currentY)
             .font('Helvetica')
             .text(`${disc.request_count} requests | $${parseFloat(disc.total_value_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 150, currentY);
          currentY += 18;
        });

        currentY += 10;
      }

      // Add chart images if provided
      if (chartImages && Object.keys(chartImages).length > 0) {
        doc.addPage();
        currentY = 30;

        doc.fontSize(12)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('CHARTS & VISUALIZATIONS', 30, currentY);

        currentY += 25;

        for (const [chartId, imageData] of Object.entries(chartImages)) {
          try {
            // Convert base64 to buffer
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // Get image dimensions
            const maxWidth = pageWidth;
            const maxHeight = 200;
            
            doc.image(imageBuffer, 30, currentY, { 
              width: maxWidth, 
              height: maxHeight,
              fit: [maxWidth, maxHeight]
            });
            
            currentY += maxHeight + 20;
            
            // Add new page if needed
            if (currentY > doc.page.height - 100) {
              doc.addPage();
              currentY = 30;
            }
          } catch (error) {
            console.warn('Failed to add chart image:', error);
          }
        }
      }

      // Footer on last page
      const footerY = doc.page.height - 50;
      doc.fontSize(7)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text(`Generated on ${new Date().toLocaleString()}`, 30, footerY, { align: 'center' })
         .text('Oando Energy - Material Request Form System', 30, footerY + 12, { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Export analytics as Word document (.docx format)
 */
async function exportAnalyticsWord(analyticsData, period, dateFrom, dateTo, outputPath) {
  const children = [];
  
  // Title
  children.push(
    new Paragraph({
      text: 'Oando Energy - Material Request Analytics Report',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );
  
  // Period info
  children.push(
    new Paragraph({
      text: `${period.charAt(0).toUpperCase() + period.slice(1)} Report`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    })
  );
  
  children.push(
    new Paragraph({
      text: `Period: ${new Date(dateFrom).toLocaleDateString()} - ${new Date(dateTo).toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 }
    })
  );
  
  children.push(
    new Paragraph({
      text: `Generated: ${new Date().toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );
  
  // Executive Summary
  children.push(
    new Paragraph({
      text: 'EXECUTIVE SUMMARY',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 }
    })
  );
  
  const summary = analyticsData.summary;
  const summaryData = [
    ['Total Requests', summary.totalRequests.toLocaleString()],
    ['Pending Requests', summary.pendingRequests.toLocaleString()],
    ['Approved Requests', summary.approvedRequests.toLocaleString()],
    ['Rejected Requests', summary.rejectedRequests.toLocaleString()],
    ['Ordered Requests', summary.orderedRequests.toLocaleString()],
    ['Delivered Requests', summary.deliveredRequests.toLocaleString()],
    ['Completed Requests', summary.completedRequests.toLocaleString()],
    ['Total Value (USD)', `$${summary.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Total Value (EUR)', `€${summary.totalValueEUR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Total Value (NGN)', `₦${summary.totalValueNGN.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Total Quantity', summary.totalQuantity.toLocaleString()]
  ];
  
  // Summary table
  const summaryRows = summaryData.map(([label, value]) => 
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph(label)],
          width: { size: 50, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph(value)],
          width: { size: 50, type: WidthType.PERCENTAGE }
        })
      ]
    })
  );
  
  children.push(
    new Table({
      rows: summaryRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    })
  );
  
  children.push(new Paragraph({ text: '', spacing: { after: 400 } }));
  
  // Top Materials
  if (analyticsData.topMaterials && analyticsData.topMaterials.length > 0) {
    children.push(
      new Paragraph({
        text: 'TOP 10 REQUESTED MATERIALS',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      })
    );
    
    const materialHeaderRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph('S/N')] }),
        new TableCell({ children: [new Paragraph('Material Description')] }),
        new TableCell({ children: [new Paragraph('Quantity')] }),
        new TableCell({ children: [new Paragraph('No. of Requests')] }),
        new TableCell({ children: [new Paragraph('Value (USD)')] }),
        new TableCell({ children: [new Paragraph('Value (NGN)')] })
      ]
    });
    
    const materialRows = analyticsData.topMaterials.slice(0, 10).map((material, index) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph((index + 1).toString())] }),
          new TableCell({ children: [new Paragraph(material.material_description || 'N/A')] }),
          new TableCell({ children: [new Paragraph(parseFloat(material.total_quantity || 0).toLocaleString())] }),
          new TableCell({ children: [new Paragraph(material.request_count.toString())] }),
          new TableCell({ children: [new Paragraph(`$${parseFloat(material.total_value_usd || 0).toLocaleString()}`)] }),
          new TableCell({ children: [new Paragraph(`₦${parseFloat(material.total_value_ngn || 0).toLocaleString()}`)] })
        ]
      })
    );
    
    children.push(
      new Table({
        rows: [materialHeaderRow, ...materialRows],
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
    
    children.push(new Paragraph({ text: '', spacing: { after: 400 } }));
  }
  
  // Requests by Location
  if (analyticsData.byLocation && analyticsData.byLocation.length > 0) {
    children.push(
      new Paragraph({
        text: 'REQUESTS BY LOCATION',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      })
    );
    
    const locationHeaderRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph('Location')] }),
        new TableCell({ children: [new Paragraph('Request Count')] }),
        new TableCell({ children: [new Paragraph('Total Quantity')] })
      ]
    });
    
    const locationRows = analyticsData.byLocation.map(loc =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(loc.location || 'N/A')] }),
          new TableCell({ children: [new Paragraph(loc.request_count.toString())] }),
          new TableCell({ children: [new Paragraph(parseFloat(loc.total_quantity || 0).toLocaleString())] })
        ]
      })
    );
    
    children.push(
      new Table({
        rows: [locationHeaderRow, ...locationRows],
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
    
    children.push(new Paragraph({ text: '', spacing: { after: 400 } }));
  }
  
  // Requests by Discipline
  if (analyticsData.byDiscipline && analyticsData.byDiscipline.length > 0) {
    children.push(
      new Paragraph({
        text: 'REQUESTS BY DISCIPLINE',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 }
      })
    );
    
    const disciplineHeaderRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph('Discipline')] }),
        new TableCell({ children: [new Paragraph('Request Count')] }),
        new TableCell({ children: [new Paragraph('Total Value (USD)')] })
      ]
    });
    
    const disciplineRows = analyticsData.byDiscipline.map(disc =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(disc.discipline || 'N/A')] }),
          new TableCell({ children: [new Paragraph(disc.request_count.toString())] }),
          new TableCell({ children: [new Paragraph(`$${parseFloat(disc.total_value_usd || 0).toLocaleString()}`)] })
        ]
      })
    );
    
    children.push(
      new Table({
        rows: [disciplineHeaderRow, ...disciplineRows],
        width: { size: 100, type: WidthType.PERCENTAGE }
      })
    );
  }
  
  // Create document
  const doc = new Document({
    sections: [{
      children: children
    }]
  });
  
  // Save as .docx
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = { 
  exportAnalyticsPDF, 
  exportAnalyticsWord,
  getFullAnalyticsData
};
