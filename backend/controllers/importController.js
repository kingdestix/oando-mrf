// backend/controllers/importController.js
// FIXED: Handles new Excel format with S/N, LOCATION, CALL OFF NUMBER, REMARKS

const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');

async function processImport(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }

    const { duplicateStrategy = 'skip' } = req.body;

    const jobId = uuidv4();
    await query(
      'INSERT INTO import_jobs (job_id, file_name, imported_by, status) VALUES ($1, $2, $3, $4)',
      [jobId, req.file.originalname, req.user.id, 'processing']
    );

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    let data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    if (data.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = Object.keys(data[0]);
    const mapping = autoDetectColumns(headers);
    
    console.log('📋 Auto-detected columns:', mapping);

    await query(
      'UPDATE import_jobs SET mapping_used = $1 WHERE job_id = $2',
      [JSON.stringify(mapping), jobId]
    );

    const requestsMap = new Map();
    const errors = [];

    data.forEach((row, index) => {
      try {
        const mrf_number = cleanValue(row[mapping.mrf_number]);
        
        if (!mrf_number) {
          errors.push({ row: index + 2, error: 'Missing MRF number' });
          return;
        }

        if (!requestsMap.has(mrf_number)) {
          // Extract location/asset
          const location = cleanValue(row[mapping.location]) || cleanValue(row[mapping.asset]) || 'Not Specified';
          
          // Normalize discipline
          let discipline = cleanValue(row[mapping.discipline]) || 'General';
          discipline = normalizeDiscipline(discipline);
          
          const reason = cleanValue(row[mapping.reason]) || 'No reason provided';
          
          // Parse request date
          let requestDate = new Date();
          if (mapping.request_date && row[mapping.request_date]) {
            const dateValue = row[mapping.request_date];
            if (typeof dateValue === 'number') {
              requestDate = excelDateToJSDate(dateValue);
            } else {
              requestDate = new Date(dateValue);
              if (isNaN(requestDate.getTime())) {
                requestDate = new Date();
              }
            }
          }

          requestsMap.set(mrf_number, {
            mrf_number,
            request_date: requestDate.toISOString(),
            first_name: 'Import',
            last_name: 'User',
            user_code: mrf_number,
            designation: 'Imported',
            office_extension: '',
            asset: location, // NEW: LOCATION column from Excel
            department: '',
            unit_tag: '',
            discipline: discipline,
            material_category: '',
            criticality: 'Medium',
            work_order_no: '',
            work_order_type: '',
            reason: reason,
            service_material: cleanValue(row[mapping.service_material]) || 'Material',
            
            // Manager tracking fields
            internal_reference: '',
            follow_up_by: '',
            status_notes: cleanValue(row[mapping.status_notes]) || '',
            status: 'Pending', // Default status
            action_pending: '',
            vendor_name: '',
            contractor_name: '',
            blanket_order_number: '',
            call_off_number: cleanValue(row[mapping.call_off_number]) || '', // NEW: CALL OFF NUMBER
            purchase_order_no: '',
            quotation_reference: '',
            quotation_approval_date: null,
            quotation_amount_usd: null,
            quotation_amount_eur: null,
            quotation_amount_ngn: null,
            estimated_delivery_date: null,
            actual_delivery_date: null,
            approved_by: '',
            manager_name: '',
            issued_by: '',
            checked_by: '',
            notes: '',
            remarks: cleanValue(row[mapping.remarks]) || '', // NEW: REMARKS column
            other: '',
            lines: []
          });
        }

        // Add material line (from SERVICE\MATERIAL column)
        const materialDesc = cleanValue(row[mapping.service_material]);
        if (materialDesc) {
          const request = requestsMap.get(mrf_number);
          request.lines.push({
            material_description: materialDesc,
            oem_model: '',
            part_number: '',
            quantity: 1,
            quantity_unit: 'pcs',
            received_quantity: 0,
            unit_price_usd: null,
            unit_price_eur: null,
            unit_price_ngn: null
          });
        }
      } catch (err) {
        errors.push({ row: index + 2, error: err.message });
      }
    });

    let successCount = 0;
    let failCount = 0;
    const importErrors = [];

    for (const [mrf_number, requestData] of requestsMap) {
      try {
        const existing = await query(
          'SELECT id FROM material_requests WHERE mrf_number = $1', 
          [mrf_number]
        );

        if (existing.rows.length > 0) {
          if (duplicateStrategy === 'skip') {
            importErrors.push({ mrf_number, error: 'Duplicate (skipped)' });
            failCount++;
            continue;
          } else if (duplicateStrategy === 'overwrite') {
            await query('DELETE FROM material_requests WHERE mrf_number = $1', [mrf_number]);
          }
        }

        if (requestData.lines.length === 0) {
          requestData.lines.push({
            material_description: requestData.service_material || 'Material request',
            quantity: 1,
            quantity_unit: 'pcs'
          });
        }

        await transaction(async (client) => {
          const result = await client.query(
            `INSERT INTO material_requests (
              mrf_number, request_date, user_id, first_name, last_name, user_code, designation,
              office_extension, asset, department, unit_tag, discipline, material_category, criticality,
              work_order_no, work_order_type, reason, service_material, internal_reference, follow_up_by,
              status, status_notes, action_pending, vendor_name, contractor_name, blanket_order_number,
              call_off_number, purchase_order_no, quotation_reference, quotation_approval_date, 
              quotation_amount_usd, quotation_amount_eur, quotation_amount_ngn, 
              estimated_delivery_date, actual_delivery_date, approved_by, manager_name,
              issued_by, checked_by, notes, remarks, other, import_batch_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                      $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33,
                      $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44)
            RETURNING id`,
            [
              requestData.mrf_number, requestData.request_date, req.user.id, requestData.first_name,
              requestData.last_name, requestData.user_code, requestData.designation, 
              requestData.office_extension, requestData.asset, requestData.department, 
              requestData.unit_tag, requestData.discipline, requestData.material_category, 
              requestData.criticality, requestData.work_order_no, requestData.work_order_type, 
              requestData.reason, requestData.service_material, requestData.internal_reference, 
              requestData.follow_up_by, requestData.status, requestData.status_notes, 
              requestData.action_pending, requestData.vendor_name, requestData.contractor_name, 
              requestData.blanket_order_number, requestData.call_off_number, 
              requestData.purchase_order_no, requestData.quotation_reference, 
              requestData.quotation_approval_date, requestData.quotation_amount_usd, 
              requestData.quotation_amount_eur, requestData.quotation_amount_ngn, 
              requestData.estimated_delivery_date, requestData.actual_delivery_date, 
              requestData.approved_by, requestData.manager_name, requestData.issued_by,
              requestData.checked_by, requestData.notes, requestData.remarks, 
              requestData.other, jobId, req.user.id
            ]
          );

          const requestId = result.rows[0].id;

          for (let i = 0; i < requestData.lines.length; i++) {
            const line = requestData.lines[i];
            await client.query(
              `INSERT INTO material_request_lines (
                request_id, line_no, material_description, oem_model, part_number,
                quantity, quantity_unit, received_quantity, unit_price_usd, unit_price_eur, unit_price_ngn
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                requestId, i + 1, line.material_description, line.oem_model, line.part_number,
                line.quantity, line.quantity_unit, line.received_quantity, 
                line.unit_price_usd, line.unit_price_eur, line.unit_price_ngn
              ]
            );
          }
        });

        successCount++;
      } catch (err) {
        console.error(`❌ Import error for ${mrf_number}:`, err);
        importErrors.push({ mrf_number, error: err.message });
        failCount++;
      }
    }

    await query(
      `UPDATE import_jobs SET status = $1, total_rows = $2, successful_rows = $3, failed_rows = $4,
       error_log = $5, completed_at = CURRENT_TIMESTAMP WHERE job_id = $6`,
      ['completed', data.length, successCount, failCount, JSON.stringify(importErrors), jobId]
    );

    await query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'DATA_IMPORTED', `Imported ${successCount} requests from ${req.file.originalname}`]
    );

    res.json({
      success: true,
      jobId,
      summary: { 
        totalRows: data.length, 
        successful: successCount, 
        failed: failCount, 
        errors: importErrors 
      }
    });
  } catch (error) {
    console.error('❌ Process import error:', error);
    res.status(500).json({ error: true, message: 'Failed to process import: ' + error.message });
  }
}

async function getImportStatus(req, res) {
  try {
    const { jobId } = req.params;
    const result = await query(
      `SELECT ij.*, u.first_name, u.last_name FROM import_jobs ij
       LEFT JOIN users u ON ij.imported_by = u.id WHERE ij.job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Import job not found' });
    }

    const job = result.rows[0];
    if (job.error_log) {
      try {
        job.error_log = JSON.parse(job.error_log);
      } catch (e) {
        job.error_log = [];
      }
    }

    res.json({ success: true, job });
  } catch (error) {
    console.error('Get import status error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch import status' });
  }
}

async function getImportHistory(req, res) {
  try {
    const result = await query(
      `SELECT ij.*, u.first_name, u.last_name FROM import_jobs ij
       LEFT JOIN users u ON ij.imported_by = u.id
       ORDER BY ij.created_at DESC LIMIT 50`
    );

    res.json({ success: true, imports: result.rows });
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch import history' });
  }
}

// Normalize discipline names
function normalizeDiscipline(discipline) {
  if (!discipline) return 'General';
  
  const disciplineLower = discipline.toLowerCase().trim();
  
  const disciplineMap = {
    'rot': 'ROT EQUIPMENT',
    'rot equip': 'ROT EQUIPMENT',
    'rot equipment': 'ROT EQUIPMENT',
    'inst air compressor': 'ROT EQUIPMENT', // NEW: Handle "INST AIR COMPRESSOR"
    'mechanical': 'MECHANICAL',
    'electrical': 'ELECTRICAL',
    'instrument': 'INSTRUMENT',
    'gmc': 'GMC',
    'asset integrity': 'ASSET INTEGRITY',
    'service': 'SERVICE',
    'others': 'others',
    'other': 'others'
  };
  
  return disciplineMap[disciplineLower] || discipline.toUpperCase();
}

function cleanValue(value) {
  if (value === null || value === undefined || value === 'NaN' || 
      (typeof value === 'number' && isNaN(value))) {
    return '';
  }
  return String(value).trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '' || value === 'NaN' || 
      (typeof value === 'number' && isNaN(value))) {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseDate(value) {
  if (!value || value === 'NaN' || (typeof value === 'number' && isNaN(value))) {
    return null;
  }
  
  if (typeof value === 'number') {
    return excelDateToJSDate(value).toISOString().split('T')[0];
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split('T')[0];
}

function excelDateToJSDate(excelDate) {
  return new Date((excelDate - 25569) * 86400 * 1000);
}

function autoDetectColumns(headers) {
  const mapping = {};
  
  const rules = {
    sn: ['s/n', 'sn', 'serial', 'item'],
    location: ['location', 'asset', 'site'],
    mrf_number: ['mrf number', 'mrf_number', 'mrfnumber', 'mrf numb'],
    request_date: ['request date', 'date', 'request_date'],
    year: ['year'],
    reason: ['reason', 'reason for request', 'purpose'],
    service_material: ['service/material', 'service\\material', 'service_material'],
    discipline: ['discipline', 'material group'],
    status_notes: ['status notes', 'status_notes'],
    call_off_number: ['call off', 'call off number', 'calloff'],
    remarks: ['remarks', 'comment', 'remark'],
    asset: ['asset', 'location']
  };

  headers.forEach(header => {
    const lower = header.toLowerCase().trim();
    
    for (const [field, patterns] of Object.entries(rules)) {
      if (patterns.some(p => lower.includes(p))) {
        if (!mapping[field]) {
          mapping[field] = header;
        }
      }
    }
  });

  return mapping;
}

module.exports = { 
  processImport, 
  getImportStatus, 
  getImportHistory 
};