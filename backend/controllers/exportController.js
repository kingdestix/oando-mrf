// backend/controllers/exportController.js
// FIXED: Shows Service\Material in export, matches exact Excel format from import

const ExcelJS = require('exceljs');
const { query } = require('../config/database');

/**
 * EXPORT REQUESTS TO EXCEL
 * Format matches manager's existing Excel sheets EXACTLY
 * Shows Service\Material and Reason for Request
 */
async function exportRequests(req, res) {
  try {
    const { format = 'xlsx', from, to, material, status, criticality, location } = req.query;

    const params = [];
    let whereClause = [];
    let paramIndex = 1;

    // Build filters
    if (from) {
      whereClause.push(`r.request_date >= $${paramIndex}`);
      params.push(from);
      paramIndex++;
    }
    if (to) {
      whereClause.push(`r.request_date <= $${paramIndex}`);
      params.push(to);
      paramIndex++;
    }
    if (status) {
      whereClause.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (criticality) {
      whereClause.push(`r.criticality = $${paramIndex}`);
      params.push(criticality);
      paramIndex++;
    }
    if (location) {
      whereClause.push(`r.asset ILIKE $${paramIndex}`);
      params.push(`%${location}%`);
      paramIndex++;
    }
    if (material) {
      whereClause.push(`EXISTS (SELECT 1 FROM material_request_lines l WHERE l.request_id = r.id AND l.material_description ILIKE $${paramIndex})`);
      params.push(`%${material}%`);
      paramIndex++;
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    // Get all requests with their data
    const result = await query(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY r.request_date, r.mrf_number) as item,
        r.asset,
        r.mrf_number,
        r.request_date,
        EXTRACT(YEAR FROM r.request_date)::integer as year,
        r.reason,
        r.service_material,
        r.discipline,
        r.criticality,
        r.status_notes,
        r.status,
        r.internal_reference,
        r.action_pending,
        r.vendor_name,
        r.blanket_order_number,
        r.call_off_number,
        r.quotation_reference,
        r.quotation_approval_date,
        r.quotation_amount_usd,
        r.quotation_amount_eur,
        r.quotation_amount_ngn,
        r.estimated_delivery_date,
        r.actual_delivery_date,
        r.notes,
        r.other
      FROM material_requests r
      ${whereSQL}
      ORDER BY r.request_date DESC, r.mrf_number`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'No data found for export' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Material Requests');

    // ✅ EXACT COLUMN FORMAT - Matches import Excel exactly
    worksheet.columns = [
      { header: 'Item', key: 'item', width: 8 },
      { header: 'Asset', key: 'asset', width: 15 },
      { header: 'Mrf Number', key: 'mrf_number', width: 20 },
      { header: 'Request Date', key: 'request_date', width: 15 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Reason for Request', key: 'reason', width: 50 },
      { header: 'Service\\Material', key: 'service_material', width: 30 }, // CRITICAL: Backslash
      { header: 'Discipline', key: 'discipline', width: 15 },
      { header: 'Criticality', key: 'criticality', width: 12 },
      { header: 'Status Notes', key: 'status_notes', width: 30 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Internal Reference', key: 'internal_reference', width: 20 },
      { header: 'Action Pending', key: 'action_pending', width: 20 },
      { header: 'Vendor Name', key: 'vendor_name', width: 25 },
      { header: 'Blanket Order Number', key: 'blanket_order_number', width: 20 },
      { header: 'Call Off Number', key: 'call_off_number', width: 18 },
      { header: 'Quotation', key: 'quotation_reference', width: 18 },
      { header: 'Quotation Approval Date', key: 'quotation_approval_date', width: 18 },
      { header: 'Quotation Amount\nUSD', key: 'quotation_amount_usd', width: 15 },
      { header: 'Quotation Amount\nEUR', key: 'quotation_amount_eur', width: 15 },
      { header: 'Quotation Amount NGN', key: 'quotation_amount_ngn', width: 18 },
      { header: 'Estimated Delivery', key: 'estimated_delivery_date', width: 15 },
      { header: 'Date of Delivery', key: 'actual_delivery_date', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Other', key: 'other', width: 20 }
    ];

    // Style header row - Oando Navy background, white text
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { 
      type: 'pattern', 
      pattern: 'solid', 
      fgColor: { argb: 'FF00205B' }
    };
    worksheet.getRow(1).alignment = { 
      vertical: 'middle', 
      horizontal: 'center',
      wrapText: true 
    };
    worksheet.getRow(1).height = 30;

    // Add data rows
    result.rows.forEach(row => {
      worksheet.addRow({
        item: row.item,
        asset: row.asset,
        mrf_number: row.mrf_number,
        request_date: row.request_date ? new Date(row.request_date) : null,
        year: row.year,
        reason: row.reason,
        service_material: row.service_material,
        discipline: row.discipline,
        criticality: row.criticality,
        status_notes: row.status_notes,
        status: row.status,
        internal_reference: row.internal_reference,
        action_pending: row.action_pending,
        vendor_name: row.vendor_name,
        blanket_order_number: row.blanket_order_number,
        call_off_number: row.call_off_number,
        quotation_reference: row.quotation_reference,
        quotation_approval_date: row.quotation_approval_date ? new Date(row.quotation_approval_date) : null,
        quotation_amount_usd: row.quotation_amount_usd,
        quotation_amount_eur: row.quotation_amount_eur,
        quotation_amount_ngn: row.quotation_amount_ngn,
        estimated_delivery_date: row.estimated_delivery_date ? new Date(row.estimated_delivery_date) : null,
        actual_delivery_date: row.actual_delivery_date ? new Date(row.actual_delivery_date) : null,
        notes: row.notes,
        other: row.other
      });
    });

    // Format date columns
    worksheet.getColumn('request_date').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('quotation_approval_date').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('estimated_delivery_date').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('actual_delivery_date').numFmt = 'yyyy-mm-dd';

    // Format number columns
    worksheet.getColumn('quotation_amount_usd').numFmt = '#,##0.00';
    worksheet.getColumn('quotation_amount_eur').numFmt = '#,##0.00';
    worksheet.getColumn('quotation_amount_ngn').numFmt = '#,##0.00';

    // Add autofilter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length }
    };

    // Freeze header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'DATA_EXPORTED', `Exported ${result.rows.length} rows`]
    );

    // Generate filename with area prefix if filtered
    let areaPrefix = '';
    if (location) {
      if (location.includes('LAND')) areaPrefix = 'LAR_';
      else if (location.includes('SWAMP')) areaPrefix = 'SAR_';
      else if (location.includes('PHC')) areaPrefix = 'PHC_';
    }

    const fileName = `${areaPrefix}Oando_MRF_Export_${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    if (format === 'csv') {
      await workbook.csv.write(res);
    } else {
      await workbook.xlsx.write(res);
    }
    
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: true, message: 'Failed to export data: ' + error.message });
    }
  }
}

/**
 * DOWNLOAD IMPORT TEMPLATE
 */
async function downloadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('MRF Import Template');

    worksheet.columns = [
      { header: 'Item', key: 'item', width: 8 },
      { header: 'Asset', key: 'asset', width: 15 },
      { header: 'Mrf Number', key: 'mrf_number', width: 20 },
      { header: 'Request Date', key: 'request_date', width: 15 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Reason for Request', key: 'reason', width: 50 },
      { header: 'Service\\Material', key: 'service_material', width: 30 },
      { header: 'Discipline', key: 'discipline', width: 15 },
      { header: 'Criticality', key: 'criticality', width: 12 },
      { header: 'Status Notes', key: 'status_notes', width: 30 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Internal Reference', key: 'internal_reference', width: 20 },
      { header: 'Action Pending', key: 'action_pending', width: 20 },
      { header: 'Vendor Name', key: 'vendor_name', width: 25 },
      { header: 'Blanket Order Number', key: 'blanket_order_number', width: 20 },
      { header: 'Call Off Number', key: 'call_off_number', width: 18 },
      { header: 'Quotation', key: 'quotation_reference', width: 18 },
      { header: 'Quotation Approval Date', key: 'quotation_approval_date', width: 18 },
      { header: 'Quotation Amount\nUSD', key: 'quotation_amount_usd', width: 15 },
      { header: 'Quotation Amount\nEUR', key: 'quotation_amount_eur', width: 15 },
      { header: 'Quotation Amount NGN', key: 'quotation_amount_ngn', width: 18 },
      { header: 'Estimated Delivery', key: 'estimated_delivery_date', width: 15 },
      { header: 'Date of Delivery', key: 'actual_delivery_date', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Other', key: 'other', width: 20 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { 
      type: 'pattern', 
      pattern: 'solid', 
      fgColor: { argb: 'FF00205B' }
    };
    worksheet.getRow(1).alignment = { 
      vertical: 'middle', 
      horizontal: 'center',
      wrapText: true
    };
    worksheet.getRow(1).height = 30;

    worksheet.addRow({
      item: 1,
      asset: 'LAND AREA',
      mrf_number: 'LAR-MTCE-001-2025',
      request_date: new Date('2025-01-15'),
      year: 2025,
      reason: 'TO CARRY OUT 500 HOURS ROUTINE PREVENTIVE MAINTENANCE SERVICE',
      service_material: 'OIL FILTER, FUEL FILTER, WATER SEPARATOR',
      discipline: 'MECHANICAL',
      criticality: 'Medium',
      status_notes: '',
      status: 'Pending',
      internal_reference: '',
      action_pending: '',
      vendor_name: '',
      blanket_order_number: '',
      call_off_number: '',
      quotation_reference: '',
      quotation_approval_date: null,
      quotation_amount_usd: null,
      quotation_amount_eur: null,
      quotation_amount_ngn: null,
      estimated_delivery_date: null,
      actual_delivery_date: null,
      notes: '',
      other: ''
    });

    const fileName = 'Oando_MRF_Import_Template.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Template error:', error);
    res.status(500).json({ error: true, message: 'Failed to generate template' });
  }
}

module.exports = { exportRequests, downloadTemplate };