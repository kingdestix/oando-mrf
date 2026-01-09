// backend/utils/mrfGenerator.js
// Generate MRF form PDF matching the official Oando MRF format

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

const LOGO_PATH = path.join(__dirname, '../../frontend/assets/images/oando-logo.png');

/**
 * Format date to DD/MM/YYYY
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date to DDTH MONTH YYYY (e.g., 16TH OCTOBER 2025)
 */
function formatDateLong(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = d.getDate();
  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
                      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const suffix = day === 1 || day === 21 || day === 31 ? 'ST' : 
                 day === 2 || day === 22 ? 'ND' : 
                 day === 3 || day === 23 ? 'RD' : 'TH';
  return `${day}${suffix} ${month} ${year}`;
}

/**
 * Generate MRF form PDF for completed request
 * @param {number} requestId - Request ID
 * @param {string} outputPath - Output file path
 * @param {object} user - User object (for role-based content)
 * @param {boolean} includeCommercial - Whether to include commercial details section (default: true)
 */
async function generateMRFPDF(requestId, outputPath, user = null, includeCommercial = true) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`📄 Starting MRF PDF generation for request ID: ${requestId} (Commercial: ${includeCommercial})`);
      
      // Get full request details with all approver names and signature paths
      const requestResult = await query(
        `SELECT r.*,
                u.first_name as requester_first_name,
                u.last_name as requester_last_name,
                u.email as requester_email,
                u.designation as requester_designation,
                u.office_extension as requester_office_ext,
                r.user_code,
                r.technical_coordinator_signature,
                r.assistant_manager_signature,
                r.area_manager_signature,
                r.pod_planner_signature,
                r.discipline_unit_signature,
                r.discipline_manager_signature,
                tc.first_name as tc_first_name,
                tc.last_name as tc_last_name,
                tc.designation as tc_designation,
                am.first_name as am_first_name,
                am.last_name as am_last_name,
                am.designation as am_designation,
                arm.first_name as arm_first_name,
                arm.last_name as arm_last_name,
                arm.designation as arm_designation,
                pod.first_name as pod_first_name,
                pod.last_name as pod_last_name,
                pod.designation as pod_designation,
                du.first_name as du_first_name,
                du.last_name as du_last_name,
                du.designation as du_designation,
                dm.first_name as dm_first_name,
                dm.last_name as dm_last_name,
                dm.designation as dm_designation
         FROM material_requests r
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN users tc ON (r.approved_by_technical_coordinator IS NOT NULL AND r.approved_by_technical_coordinator::text::integer = tc.id)
         LEFT JOIN users am ON (r.approved_by_assistant_manager IS NOT NULL AND r.approved_by_assistant_manager::text::integer = am.id)
         LEFT JOIN users arm ON (r.approved_by_area_manager IS NOT NULL AND r.approved_by_area_manager::text::integer = arm.id)
         LEFT JOIN users pod ON (r.approved_by_pod_planner IS NOT NULL AND r.approved_by_pod_planner::text::integer = pod.id)
         LEFT JOIN users du ON (r.approved_by_discipline_unit IS NOT NULL AND r.approved_by_discipline_unit::text::integer = du.id)
         LEFT JOIN users dm ON (r.approved_by_discipline_manager IS NOT NULL AND r.approved_by_discipline_manager::text::integer = dm.id)
         WHERE r.id = $1`,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      const request = requestResult.rows[0];
      console.log(`✅ Request found: ${request.mrf_number}, Stage: ${request.workflow_stage}`);

      // Get line items
      const linesResult = await query(
        `SELECT * FROM material_request_lines WHERE request_id = $1 ORDER BY line_no`,
        [requestId]
      );
      const lineItems = linesResult.rows;
      console.log(`✅ Found ${lineItems.length} line items`);

      // Create PDF
      console.log(`📝 Creating PDF document...`);
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      console.log(`📝 PDF stream created, writing to: ${outputPath}`);

      const pageWidth = doc.page.width - 40;
      const leftMargin = 20;
      let currentY = 20;

      // ========== HEADER SECTION ==========
      // Logo - make it bigger
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, leftMargin, currentY, { 
          width: 90, 
          height: 38,
          fit: [90, 38],
          align: 'left'
        });
      }
      
      // Title
      doc.fontSize(16)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('MATERIALS REQUEST FORM (MRF)', leftMargin + 70, currentY + 5, { width: pageWidth - 70 });

      currentY += 30;

      // Request Number and Date
      doc.fontSize(10)
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text(`Request No.: ${request.mrf_number}`, leftMargin, currentY)
         .text(`Date: ${formatDateLong(request.request_date)}`, pageWidth - 150, currentY, { align: 'right' });

      currentY += 25;

      // ========== REQUESTOR'S DETAILS SECTION ==========
      doc.rect(leftMargin, currentY, pageWidth, 50)
         .lineWidth(1)
         .strokeColor('#000000')
         .stroke();

      doc.fontSize(9)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('REQUESTOR\'S DETAILS', leftMargin + 5, currentY + 5);

      doc.fontSize(8)
         .fillColor('#000000')
         .font('Helvetica')
         .text(`First Name: ${request.requester_first_name || ''}`, leftMargin + 5, currentY + 18)
         .text(`Last Name: ${request.requester_last_name || ''}`, leftMargin + 5, currentY + 28)
         .text(`Designation: ${request.requester_designation || request.designation || ''}`, leftMargin + 5, currentY + 38)
         .text(`Office Ext: ${request.requester_office_ext || request.office_extension || ''}`, pageWidth / 2, currentY + 18)
         .text(`User ID: ${request.user_code || ''}`, pageWidth / 2, currentY + 28)
         .text(`Location: ${request.asset || request.workflow_location || ''}`, pageWidth / 2, currentY + 38);

      currentY += 55;

      // ========== OTHER REQUEST INFORMATION ==========
      doc.rect(leftMargin, currentY, pageWidth, 50)
         .lineWidth(1)
         .strokeColor('#000000')
         .stroke();

      doc.fontSize(9)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('OTHER REQUEST INFORMATION', leftMargin + 5, currentY + 5);

      doc.fontSize(8)
         .fillColor('#000000')
         .font('Helvetica')
         .text(`Unit Tag: ${request.unit_tag || ''}`, leftMargin + 5, currentY + 18)
         .text(`Material Group: ${request.material_group || ''}`, leftMargin + 5, currentY + 28)
         .text(`Material Category: ${request.material_category || ''}`, leftMargin + 5, currentY + 38)
         .text(`Work Order No.: ${request.work_order_no || ''}`, pageWidth / 2, currentY + 18)
         .text(`Work Order Type: ${request.work_order_type || ''}`, pageWidth / 2, currentY + 28)
         .text(`Priority: ${request.criticality || 'NORMAL'}`, pageWidth / 2, currentY + 38);

      currentY += 55;

      // ========== REASON/PURPOSE ==========
      doc.rect(leftMargin, currentY, pageWidth, 30)
         .lineWidth(1)
         .strokeColor('#000000')
         .stroke();

      doc.fontSize(9)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('REASON/PURPOSE FOR REQUEST', leftMargin + 5, currentY + 5);

      doc.fontSize(8)
         .fillColor('#000000')
         .font('Helvetica')
         .text(request.purpose || request.reason || 'N/A', leftMargin + 5, currentY + 18, { width: pageWidth - 10 });

      currentY += 35;

      // ========== MATERIALS TECHNICAL SPECIFICATION ==========
      doc.fontSize(9)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('MATERIALS TECHNICAL SPECIFICATION', leftMargin, currentY);

      currentY += 15;

      // Table header
      const tableTop = currentY;
      const colWidths = {
        sn: 30,
        desc: 180,
        oem: 120,
        partNo: 120,
        qty: 80,
        received: 60
      };
      const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);
      const tableLeft = leftMargin;

      // Header row
      doc.rect(tableLeft, currentY, tableWidth, 20)
         .fill('#00205B');

      doc.fontSize(7)
         .fillColor('#FFFFFF')
         .font('Helvetica-Bold')
         .text('S/N', tableLeft + 5, currentY + 6)
         .text('Material Description', tableLeft + colWidths.sn + 5, currentY + 6)
         .text('OEM/Model', tableLeft + colWidths.sn + colWidths.desc + 5, currentY + 6)
         .text('Part Number', tableLeft + colWidths.sn + colWidths.desc + colWidths.oem + 5, currentY + 6)
         .text('Quantity', tableLeft + colWidths.sn + colWidths.desc + colWidths.oem + colWidths.partNo + 5, currentY + 6)
         .text('Received', tableLeft + colWidths.sn + colWidths.desc + colWidths.oem + colWidths.partNo + colWidths.qty + 5, currentY + 6);

      currentY += 20;

      // Data rows
      lineItems.forEach((item, index) => {
        const rowHeight = 25;
        doc.rect(tableLeft, currentY, tableWidth, rowHeight)
           .lineWidth(0.5)
           .strokeColor('#000000')
           .stroke();

        doc.fontSize(7)
           .fillColor('#000000')
           .font('Helvetica')
           .text((index + 1).toString(), tableLeft + 5, currentY + 8)
           .text(item.material_description || 'N/A', tableLeft + colWidths.sn + 5, currentY + 8, { width: colWidths.desc - 10 })
           .text(item.oem_model || 'N/A', tableLeft + colWidths.sn + colWidths.desc + 5, currentY + 8, { width: colWidths.oem - 10 })
           .text(item.part_number || 'N/A', tableLeft + colWidths.sn + colWidths.desc + colWidths.oem + 5, currentY + 8, { width: colWidths.partNo - 10 })
           .text(`${item.quantity} ${item.quantity_unit || 'PCS'}`, tableLeft + colWidths.sn + colWidths.desc + colWidths.oem + colWidths.partNo + 5, currentY + 8, { width: colWidths.qty - 10 })
           .text('', tableLeft + colWidths.sn + colWidths.desc + colWidths.oem + colWidths.partNo + colWidths.qty + 5, currentY + 8); // Received column

        currentY += rowHeight;
      });

      currentY += 10;

      // ========== REMARKS ==========
      if (request.remarks) {
        doc.fontSize(8)
           .fillColor('#000000')
           .font('Helvetica')
           .text(`Remarks: ${request.remarks}`, leftMargin, currentY);
        currentY += 15;
      }

      // ========== MRF APPROVAL SECTION (4 Boxes: 2x2 Grid) ==========
      doc.fontSize(9)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('MRF APPROVAL', leftMargin, currentY);

      currentY += 15;

      const approvalBoxHeight = 65;
      const approvalBoxWidth = (pageWidth - 30) / 2; // 2 columns
      const boxGap = 10;

      // Row 1: Issued By and Checked By
      // Box 1: Issued By
      doc.rect(leftMargin, currentY, approvalBoxWidth, approvalBoxHeight)
         .lineWidth(1)
         .strokeColor('#000000')
         .stroke();

      doc.fontSize(8)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('Issued By:', leftMargin + 5, currentY + 5)
         .fillColor('#000000')
         .font('Helvetica')
         .text(request.requester_designation || 'TECH OFFICE', leftMargin + 5, currentY + 18)
         .text(`Name: ${request.requester_first_name || ''} ${request.requester_last_name || ''}`, leftMargin + 5, currentY + 32)
         .fontSize(7)
         .text(`Date: ${formatDate(request.request_date)}`, leftMargin + 5, currentY + 46)
         .fontSize(6)
         .fillColor('#10b981')
         .text('SUBMITTED', leftMargin + 5, currentY + 58);

      // Box 2: Checked By (Technical Coordinator)
      if (request.approved_by_technical_coordinator) {
        doc.rect(leftMargin + approvalBoxWidth + boxGap, currentY, approvalBoxWidth, approvalBoxHeight)
           .lineWidth(1)
           .strokeColor('#000000')
           .stroke();

        doc.fontSize(8)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('Checked By:', leftMargin + approvalBoxWidth + boxGap + 5, currentY + 5)
           .fillColor('#000000')
           .font('Helvetica')
           .text(request.tc_designation || 'ASST MGR MIG', leftMargin + approvalBoxWidth + boxGap + 5, currentY + 18);
        
        // Add signature image if available
        let signatureY = currentY + 30;
        if (request.technical_coordinator_signature) {
          try {
            const sigPath = path.join(__dirname, '..', '..', request.technical_coordinator_signature);
            if (fs.existsSync(sigPath)) {
              doc.image(sigPath, leftMargin + approvalBoxWidth + boxGap + 5, signatureY, { width: 50, height: 12 });
            }
          } catch (err) {
            console.warn('Could not load technical coordinator signature:', err);
          }
        }
        
        // Add approver name below signature
        doc.fontSize(7)
           .fillColor('#000000')
           .font('Helvetica')
           .text(`${request.tc_first_name || ''} ${request.tc_last_name || ''}`, leftMargin + approvalBoxWidth + boxGap + 5, currentY + 45)
           .text(`Date: ${formatDate(request.approved_date_technical_coordinator)}`, leftMargin + approvalBoxWidth + boxGap + 5, currentY + 55)
           .fontSize(6)
           .fillColor('#10b981')
           .text('APPROVED', leftMargin + approvalBoxWidth + boxGap + 5, currentY + 58);
      }

      currentY += approvalBoxHeight + boxGap;

      // Row 2: Assistant Manager and Area Manager
      // Box 3: Approved By (Assistant Manager)
      if (request.approved_by_assistant_manager) {
        doc.rect(leftMargin, currentY, approvalBoxWidth, approvalBoxHeight)
           .lineWidth(1)
           .strokeColor('#000000')
           .stroke();

        doc.fontSize(8)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('Approved By:', leftMargin + 5, currentY + 5)
           .fillColor('#000000')
           .font('Helvetica')
           .text(request.am_designation || '', leftMargin + 5, currentY + 18);
        
        // Add signature image if available
        let signatureY = currentY + 30;
        if (request.assistant_manager_signature) {
          try {
            const sigPath = path.join(__dirname, '..', '..', request.assistant_manager_signature);
            if (fs.existsSync(sigPath)) {
              doc.image(sigPath, leftMargin + 5, signatureY, { width: 50, height: 12 });
            }
          } catch (err) {
            console.warn('Could not load assistant manager signature:', err);
          }
        }
        
        // Add approver name below signature
        doc.fontSize(7)
           .fillColor('#000000')
           .font('Helvetica')
           .text(`${request.am_first_name || ''} ${request.am_last_name || ''}`, leftMargin + 5, currentY + 45)
           .text(`Date: ${formatDate(request.approved_date_assistant_manager)}`, leftMargin + 5, currentY + 55)
           .fontSize(6)
           .fillColor('#10b981')
           .text('APPROVED', leftMargin + 5, currentY + 58);
      }

      // Box 4: Approved By (Area Manager)
      if (request.approved_by_area_manager) {
        doc.rect(leftMargin + approvalBoxWidth + boxGap, currentY, approvalBoxWidth, approvalBoxHeight)
           .lineWidth(1)
           .strokeColor('#000000')
           .stroke();

        doc.fontSize(8)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('Approved By:', leftMargin + approvalBoxWidth + boxGap + 5, currentY + 5)
           .fillColor('#000000')
           .font('Helvetica')
           .text(request.arm_designation || '', leftMargin + approvalBoxWidth + boxGap + 5, currentY + 18);
        
        // Add signature image if available
        let signatureY = currentY + 30;
        if (request.area_manager_signature) {
          try {
            const sigPath = path.join(__dirname, '..', '..', request.area_manager_signature);
            if (fs.existsSync(sigPath)) {
              doc.image(sigPath, leftMargin + approvalBoxWidth + boxGap + 5, signatureY, { width: 50, height: 12 });
            }
          } catch (err) {
            console.warn('Could not load area manager signature:', err);
          }
        }
        
        // Add approver name below signature
        doc.fontSize(7)
           .fillColor('#000000')
           .font('Helvetica')
           .text(`${request.arm_first_name || ''} ${request.arm_last_name || ''}`, leftMargin + approvalBoxWidth + boxGap + 5, currentY + 45)
           .text(`Date: ${formatDate(request.approved_date_area_manager)}`, leftMargin + approvalBoxWidth + boxGap + 5, currentY + 55)
           .fontSize(6)
           .fillColor('#10b981')
           .text('APPROVED', leftMargin + approvalBoxWidth + boxGap + 5, currentY + 58);
      }

      currentY += approvalBoxHeight + 15;

      // ========== POD REVIEW CHECK SECTION ==========
      doc.fontSize(9)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('POD REVIEW CHECK', leftMargin, currentY);

      currentY += 15;

      doc.rect(leftMargin, currentY, pageWidth, 50)
         .lineWidth(1)
         .strokeColor('#000000')
         .stroke();

      doc.fontSize(8)
         .fillColor('#000000')
         .font('Helvetica')
         .text(`Contract Validity: ${request.contract_validity ? formatDate(request.contract_validity) : ''}`, leftMargin + 5, currentY + 5)
         .text(`Checked By: ${request.pod_first_name || ''} ${request.pod_last_name || ''}`, leftMargin + 5, currentY + 18)
         .text(`Contract/COFF No.: ${request.contract_number || ''}`, leftMargin + 5, currentY + 31)
         .text(`Vendor Name: ${request.vendor_name_discipline || request.vendor_name || ''}`, pageWidth / 2, currentY + 5)
         .text(`Signature: ${request.pod_planner_name ? '✓' : ''}`, pageWidth / 2, currentY + 18)
         .text(`Date: ${request.approved_date_pod_planner ? formatDate(request.approved_date_pod_planner) : ''}`, pageWidth / 2, currentY + 31);

      currentY += 55;

      // ========== POD MANAGEMENT APPROVAL ==========
      if (request.approved_by_pod_planner) {
        doc.rect(leftMargin, currentY, pageWidth, 50)
           .lineWidth(1)
           .strokeColor('#000000')
           .stroke();

        doc.fontSize(8)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('POD MANAGEMENT APPROVAL', leftMargin + 5, currentY + 5)
           .fillColor('#000000')
           .font('Helvetica')
           .text(`Approved By: ${request.pod_designation || ''}`, leftMargin + 5, currentY + 18);
        
        // Add POD signature if available
        let signatureY = currentY + 28;
        if (request.pod_planner_signature) {
          try {
            const sigPath = path.join(__dirname, '..', '..', request.pod_planner_signature);
            if (fs.existsSync(sigPath)) {
              doc.image(sigPath, leftMargin + 5, signatureY, { width: 60, height: 15 });
            }
          } catch (err) {
            console.warn('Could not load POD planner signature:', err);
          }
        }
        
        // Add approver name below signature
        doc.fontSize(7)
           .fillColor('#000000')
           .font('Helvetica')
           .text(`${request.pod_first_name || ''} ${request.pod_last_name || ''}`, leftMargin + 5, currentY + 38)
           .text(`Date: ${formatDate(request.approved_date_pod_planner)}`, pageWidth / 2, currentY + 18)
           .fontSize(6)
           .fillColor('#10b981')
           .text('APPROVED', leftMargin + 5, currentY + 40);

        currentY += 55;
      }

      // ========== QUOTATION DETAILS & APPROVAL (Only for authorized roles) ==========
      // Define roles that CANNOT see commercial details
      const fieldWorkerRoles = ['worker', 'technical_coordinator', 'assistant_manager', 'area_manager_land', 'area_manager_swamp', 'area_manager_phc'];
      const canViewCommercial = includeCommercial && user && !fieldWorkerRoles.includes(user.role);

      if (canViewCommercial) {
        doc.fontSize(9)
           .fillColor('#00205B')
           .font('Helvetica-Bold')
           .text('QUOTATION DETAILS & APPROVAL', leftMargin, currentY);

        currentY += 15;

        doc.rect(leftMargin, currentY, pageWidth, 60)
           .lineWidth(1)
           .strokeColor('#000000')
           .stroke();

      doc.fontSize(8)
         .fillColor('#000000')
         .font('Helvetica')
         .text(`Quote Amount: ${request.quotation_amount_usd ? `$${request.quotation_amount_usd.toLocaleString()}` : ''}`, leftMargin + 5, currentY + 5)
         .text(`Checked By: ${request.du_designation || ''}`, leftMargin + 5, currentY + 18)
         .text(`Reviewed By: ${request.du_designation || ''}`, leftMargin + 5, currentY + 31)
         .text(`Approved By: ${request.dm_designation || ''}`, leftMargin + 5, currentY + 44)
         .text(`Quote Date: ${request.quotation_date ? formatDate(request.quotation_date) : ''}`, pageWidth / 2, currentY + 5)
         .text(`EDD: ${request.estimated_delivery_date ? formatDate(request.estimated_delivery_date) : ''}`, pageWidth / 2, currentY + 18);
      
      // Add Discipline Unit signature if available (Reviewed By)
      let duSignatureY = currentY + 25;
      if (request.discipline_unit_signature) {
        try {
          const sigPath = path.join(__dirname, '..', '..', request.discipline_unit_signature);
          if (fs.existsSync(sigPath)) {
            doc.image(sigPath, pageWidth / 2, duSignatureY, { width: 50, height: 12 });
          }
        } catch (err) {
          console.warn('Could not load discipline unit signature:', err);
        }
      }
      
      // Add Discipline Unit name below signature
      doc.fontSize(7)
         .fillColor('#000000')
         .font('Helvetica')
         .text(`${request.du_first_name || ''} ${request.du_last_name || ''}`, pageWidth / 2, currentY + 37)
         .text(`Date: ${request.approved_date_discipline_unit ? formatDate(request.approved_date_discipline_unit) : ''}`, pageWidth / 2, currentY + 43)
         .fontSize(6)
         .fillColor('#10b981')
         .text('APPROVED', pageWidth / 2, currentY + 48);
      
      // Add Discipline Manager signature if available (Approved By)
      let dmSignatureY = currentY + 25;
      if (request.discipline_manager_signature) {
        try {
          const sigPath = path.join(__dirname, '..', '..', request.discipline_manager_signature);
          if (fs.existsSync(sigPath)) {
            // Position DM signature to the right side, below EDD
            doc.image(sigPath, pageWidth / 2 + 100, dmSignatureY, { width: 50, height: 12 });
          }
        } catch (err) {
          console.warn('Could not load discipline manager signature:', err);
        }
      }
      
      // Add Discipline Manager name below signature
      if (request.discipline_manager_signature) {
        doc.fontSize(7)
           .fillColor('#000000')
           .font('Helvetica')
           .text(`${request.dm_first_name || ''} ${request.dm_last_name || ''}`, pageWidth / 2 + 100, currentY + 37)
           .text(`Date: ${request.approved_date_discipline_manager ? formatDate(request.approved_date_discipline_manager) : ''}`, pageWidth / 2 + 100, currentY + 43)
           .fontSize(6)
           .fillColor('#10b981')
           .text('APPROVED', pageWidth / 2 + 100, currentY + 48);
      }

        currentY += 65;
      } // End of includeCommercial section

      // ========== MATERIAL RECEIPT & ACCEPTANCE ==========
      doc.fontSize(9)
         .fillColor('#00205B')
         .font('Helvetica-Bold')
         .text('MATERIAL RECEIPT & ACCEPTANCE', leftMargin, currentY);

      currentY += 15;

      doc.rect(leftMargin, currentY, pageWidth, 50)
         .lineWidth(1)
         .strokeColor('#000000')
         .stroke();

      doc.fontSize(8)
         .fillColor('#000000')
         .font('Helvetica')
         .text(`Delivery Date: ${request.delivery_date ? formatDate(request.delivery_date) : ''}`, leftMargin + 5, currentY + 5)
         .text(`Delivered By: ${request.delivered_by || ''}`, leftMargin + 5, currentY + 18)
         .text(`Checked By: ${request.checked_by || ''}`, leftMargin + 5, currentY + 31)
         .text(`Received By: ${request.received_by || ''}`, pageWidth / 2, currentY + 5)
         .text(`Received Quantity: ${request.received_quantity || ''}`, pageWidth / 2, currentY + 18)
         .text(`Signature/Date: ${request.received_date ? formatDate(request.received_date) : ''}`, pageWidth / 2, currentY + 31);

      // Footer
      const footerY = doc.page.height - 30;
      doc.fontSize(7)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text(`Generated on ${new Date().toLocaleString()} - Oando Energy MRF System`, leftMargin, footerY, { align: 'center', width: pageWidth });

      doc.end();

      stream.on('finish', () => {
        console.log(`✅ PDF stream finished for request ${requestId}`);
        // Verify file exists before resolving
        if (fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error('PDF file was not created'));
        }
      });

      stream.on('error', (error) => {
        console.error(`❌ PDF stream error for request ${requestId}:`, error);
        reject(error);
      });

    } catch (error) {
      console.error(`❌ PDF generation error for request ${requestId}:`, error);
      console.error('Error stack:', error.stack);
      reject(error);
    }
  });
}

module.exports = { generateMRFPDF };
