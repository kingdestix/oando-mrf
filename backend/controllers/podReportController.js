// POD Report Controller
// Generates weekly/monthly reports with total amounts spent

const { query } = require('../config/database');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = require('docx');
const fs = require('fs');
const path = require('path');

/**
 * Generate POD Report (Word Document)
 * GET /api/pod/report?period=weekly|monthly&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
async function generatePODReport(req, res) {
  try {
    const user = req.user;
    
    if (user.role !== 'pod_planner') {
      return res.status(403).json({ error: true, message: 'Only POD Planner can generate reports' });
    }

    const { period = 'monthly', startDate, endDate } = req.query;
    
    // Calculate date range
    let dateFrom, dateTo;
    if (startDate && endDate) {
      dateFrom = new Date(startDate);
      dateTo = new Date(endDate);
    } else if (period === 'weekly') {
      dateTo = new Date();
      dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 7);
    } else {
      // Monthly (default)
      dateTo = new Date();
      dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 1);
    }

    // Get approved requests with commercial details
    const result = await query(
      `SELECT 
        r.mrf_number,
        r.request_date,
        r.discipline,
        r.asset,
        r.quotation_reference,
        r.quotation_amount_usd,
        r.quotation_amount_eur,
        r.quotation_amount_ngn,
        r.contractor_name,
        r.commercial_approved_date,
        u.first_name || ' ' || u.last_name as requester_name,
        dodm.first_name || ' ' || dodm.last_name as dodm_name
      FROM material_requests r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users dodm ON r.commercial_approved_by = dodm.id
      WHERE r.workflow_stage = 'COMMERCIAL_APPROVED'
        AND r.commercial_approved_date >= $1
        AND r.commercial_approved_date <= $2
        AND r.quotation_amount_usd IS NOT NULL
      ORDER BY r.commercial_approved_date DESC, r.request_date DESC`,
      [dateFrom, dateTo]
    );

    const requests = result.rows;

    // Calculate totals
    const totals = requests.reduce((acc, req) => {
      acc.total_usd += parseFloat(req.quotation_amount_usd || 0);
      acc.total_eur += parseFloat(req.quotation_amount_eur || 0);
      acc.total_ngn += parseFloat(req.quotation_amount_ngn || 0);
      acc.count += 1;
      return acc;
    }, { total_usd: 0, total_eur: 0, total_ngn: 0, count: 0 });

    // Create Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header
          new Paragraph({
            text: "OANDO ENERGY LIMITED",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "OANDO ENERGY LIMITED",
                bold: true,
                size: 32,
                color: "00205B"
              })
            ]
          }),
          new Paragraph({
            text: "Material Request Form (MRF) - Financial Report",
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `Report Period: ${period.toUpperCase()} (${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()})`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // Summary Section
          new Paragraph({
            text: "EXECUTIVE SUMMARY",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Total Approved Requests: ", bold: true }),
              new TextRun({ text: totals.count.toString() })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Total Amount (USD): ", bold: true }),
              new TextRun({ text: `$${totals.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Total Amount (EUR): ", bold: true }),
              new TextRun({ text: `€${totals.total_eur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Total Amount (NGN): ", bold: true }),
              new TextRun({ text: `₦${totals.total_ngn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` })
            ],
            spacing: { after: 400 }
          }),

          // Detailed Table
          new Paragraph({
            text: "DETAILED BREAKDOWN",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          // Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Header row
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "MRF Number", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "Date", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "Discipline", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "Contractor", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "Amount (USD)", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "Amount (EUR)", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "Amount (NGN)", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "Approved Date", bold: true })] })
                ]
              }),
              // Data rows
              ...requests.map(req => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: req.mrf_number || '-' })] }),
                  new TableCell({ children: [new Paragraph({ text: new Date(req.request_date).toLocaleDateString() })] }),
                  new TableCell({ children: [new Paragraph({ text: req.discipline || '-' })] }),
                  new TableCell({ children: [new Paragraph({ text: req.contractor_name || '-' })] }),
                  new TableCell({ children: [new Paragraph({ text: req.quotation_amount_usd ? `$${parseFloat(req.quotation_amount_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-' })] }),
                  new TableCell({ children: [new Paragraph({ text: req.quotation_amount_eur ? `€${parseFloat(req.quotation_amount_eur).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-' })] }),
                  new TableCell({ children: [new Paragraph({ text: req.quotation_amount_ngn ? `₦${parseFloat(req.quotation_amount_ngn).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-' })] }),
                  new TableCell({ children: [new Paragraph({ text: req.commercial_approved_date ? new Date(req.commercial_approved_date).toLocaleDateString() : '-' })] })
                ]
              })),
              // Total row
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "TOTAL", bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "" })] }),
                  new TableCell({ children: [new Paragraph({ text: "" })] }),
                  new TableCell({ children: [new Paragraph({ text: "" })] }),
                  new TableCell({ children: [new Paragraph({ text: `$${totals.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: `€${totals.total_eur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: `₦${totals.total_ngn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: "" })] })
                ]
              })
            ]
          }),

          // Footer
          new Paragraph({
            text: `Report Generated: ${new Date().toLocaleString()}`,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 }
          }),
          new Paragraph({
            text: `Generated by: ${user.first_name} ${user.last_name} (${user.role})`,
            alignment: AlignmentType.CENTER
          })
        ]
      }]
    });

    // Generate file
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `POD_Report_${period}_${timestamp}.docx`;
    const filePath = path.join(reportsDir, fileName);

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);

    // Clean up after download
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);

  } catch (error) {
    console.error('Generate POD report error:', error);
    res.status(500).json({ error: true, message: 'Failed to generate report: ' + error.message });
  }
}

module.exports = {
  generatePODReport
};

