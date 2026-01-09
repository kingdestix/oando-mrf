// backend/controllers/exportController.js
const ExcelJS = require('exceljs');
const { query } = require('../config/database');

async function exportRequests(req, res) {
  try {
    const { format = 'xlsx', from, to, material, status, criticality, location, area } = req.query;

    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (area && area !== 'all') {
      if (area === 'LAR') conditions.push(`r.mrf_number LIKE 'LAR-%'`);
      else if (area === 'SAR') conditions.push(`r.mrf_number LIKE 'SAR-%'`);
      else if (area === 'PHC') conditions.push(`r.mrf_number LIKE 'PHC-%'`);
    }

    if (from) {
      conditions.push(`r.request_date >= $${paramIndex}`);
      params.push(from);
      paramIndex++;
    }
    if (to) {
      conditions.push(`r.request_date <= $${paramIndex}`);
      params.push(to);
      paramIndex++;
    }
    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (criticality) {
      conditions.push(`r.criticality = $${paramIndex}`);
      params.push(criticality);
      paramIndex++;
    }
    if (location) {
      conditions.push(`r.asset ILIKE $${paramIndex}`);
      params.push(`%${location}%`);
      paramIndex++;
    }
    if (material) {
      conditions.push(`EXISTS (SELECT 1 FROM material_request_lines l WHERE l.request_id = r.id AND l.material_description ILIKE $${paramIndex})`);
      params.push(`%${material}%`);
      paramIndex++;
    }

    const whereSQL = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY r.request_date, r.mrf_number) as item,
        r.asset, r.mrf_number, r.request_date,
        EXTRACT(YEAR FROM r.request_date)::integer as year,
        r.reason, r.service_material, r.discipline, r.criticality,
        r.status_notes, r.status, r.internal_reference, r.action_pending,
        r.vendor_name, r.blanket_order_number, r.call_off_number,
        r.quotation_reference, r.quotation_approval_date,
        r.quotation_amount_usd, r.quotation_amount_eur, r.quotation_amount_ngn,
        r.estimated_delivery_date, r.actual_delivery_date, r.notes, r.other
      FROM material_requests r ${whereSQL}
      ORDER BY r.request_date DESC, r.mrf_number`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'No data found' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Material Requests');

    // Define columns with headers
    worksheet.columns = [
      { header: 'Item', key: 'item', width: 6 },
      { header: 'Asset', key: 'asset', width: 12 },
      { header: 'Mrf Number', key: 'mrf_number', width: 18 },
      { header: 'Request Date', key: 'request_date', width: 12 },
      { header: 'Year', key: 'year', width: 6 },
      { header: 'Reason for Request', key: 'reason', width: 50 },
      { header: 'Service\\Material', key: 'service_material', width: 35 },
      { header: 'Discipline', key: 'discipline', width: 13 },
      { header: 'Criticality', key: 'criticality', width: 10 },
      { header: 'Status Notes', key: 'status_notes', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Internal Reference', key: 'internal_reference', width: 18 },
      { header: 'Action Pending', key: 'action_pending', width: 18 },
      { header: 'Vendor Name', key: 'vendor_name', width: 22 },
      { header: 'Blanket Order Number', key: 'blanket_order_number', width: 18 },
      { header: 'Call Off Number', key: 'call_off_number', width: 15 },
      { header: 'Quotation', key: 'quotation_reference', width: 15 },
      { header: 'Quotation Approval Date', key: 'quotation_approval_date', width: 12 },
      { header: 'Quotation Amount\nUSD', key: 'quotation_amount_usd', width: 12 },
      { header: 'Quotation Amount\nEUR', key: 'quotation_amount_eur', width: 12 },
      { header: 'Quotation Amount NGN', key: 'quotation_amount_ngn', width: 14 },
      { header: 'Estimated Delivery', key: 'estimated_delivery_date', width: 12 },
      { header: 'Date of Delivery', key: 'actual_delivery_date', width: 12 },
      { header: 'Notes', key: 'notes', width: 28 },
      { header: 'Other', key: 'other', width: 18 }
    ];

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00205B' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // Add data
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

    // ✅ Style + wrap all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.alignment = { wrapText: true, vertical: 'top' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
        };
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        }
      });
      if (rowNumber > 1) row.height = undefined; // Auto-height
    });

    // Format dates/numbers
    worksheet.getColumn('request_date').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('quotation_approval_date').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('estimated_delivery_date').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('actual_delivery_date').numFmt = 'yyyy-mm-dd';
    worksheet.getColumn('quotation_amount_usd').numFmt = '#,##0.00';
    worksheet.getColumn('quotation_amount_eur').numFmt = '#,##0.00';
    worksheet.getColumn('quotation_amount_ngn').numFmt = '#,##0.00';

    // Freeze + filter
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 25 } };

    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'DATA_EXPORTED', `Exported ${result.rows.length} rows`]
    );

    let areaPrefix = '';
    if (area === 'LAR') areaPrefix = 'Land_Area_';
    else if (area === 'SAR') areaPrefix = 'Swamp_Area_';
    else if (area === 'PHC') areaPrefix = 'PHC_POD_';

    const fileName = `Oando_MRF_${areaPrefix}${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: true, message: 'Export failed: ' + error.message });
    }
  }
}

async function downloadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');
    
    worksheet.columns = [
      { header: 'Item', width: 6 },
      { header: 'Asset', width: 12 },
      { header: 'Mrf Number', width: 18 },
      { header: 'Request Date', width: 12 },
      { header: 'Year', width: 6 },
      { header: 'Reason for Request', width: 50 },
      { header: 'Service\\Material', width: 35 },
      { header: 'Discipline', width: 13 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00205B' } };
    
    const fileName = 'Oando_MRF_Template.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: true, message: 'Template failed' });
  }
}

module.exports = { exportRequests, downloadTemplate };