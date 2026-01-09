// frontend/assets/js/import.js
let previewData = null;
let suggestedMapping = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;
  const user = app.getUser();
  if (user.role !== 'admin' && user.role !== 'manager') {
    app.showAlert('Access denied. Admin/Manager role required.', 'error');
    setTimeout(() => window.location.href = '/worker-dashboard.html', 2000);
  }
});

async function downloadTemplate() {
  try {
    app.showAlert('Downloading template...', 'info');
    const blob = await app.api.download('/exports/template');
    app.downloadFile(blob, 'Oando_MRF_Import_Template.xlsx');
    app.showAlert('Template downloaded! Fill it out and upload here.', 'success');
  } catch (error) {
    app.showAlert('Failed to download template: ' + error.message, 'error');
  }
}

async function previewFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  
  if (!file) {
    app.showAlert('Please select an Excel or CSV file first', 'error');
    return;
  }
  
  // Validate file type
  const validTypes = ['.xlsx', '.xls', '.csv'];
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!validTypes.includes(fileExt)) {
    app.showAlert('Invalid file type. Please upload .xlsx, .xls, or .csv file', 'error');
    return;
  }
  
  app.showLoading(true);
  app.showAlert('Reading file...', 'info');
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await app.api.upload('/imports/preview', formData);
    
    previewData = response;
    suggestedMapping = response.suggestedMapping;
    
    app.showAlert(`✓ File loaded successfully! Found ${response.totalRows} rows with ${response.headers.length} columns`, 'success');
    
    renderMappingUI();
    renderPreviewTable();
    
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('mappingSection').classList.remove('hidden');
    
    // Scroll to mapping section
    document.getElementById('mappingSection').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    app.showAlert('Failed to read file: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderMappingUI() {
  const container = document.getElementById('mappingContainer');
  
  // CRITICAL: Clear instructions
  const instructions = `
    <div class="alert alert-info" style="grid-column: 1/-1; margin-bottom: 1rem;">
      <strong>📌 How Column Mapping Works:</strong><br>
      1. Each field below shows what data we need (e.g., "MRF Number")<br>
      2. Use the dropdown to select which column from YOUR Excel file contains that data<br>
      3. We've auto-detected most mappings - verify they're correct<br>
      4. Fields marked with * are REQUIRED<br>
      5. If a column isn't in your Excel, leave it as "-- Not Mapped --"
    </div>
  `;
  
  const fieldGroups = [
    {
      title: 'Request Identification (Required)',
      fields: [
        { key: 'mrf_number', label: 'MRF Number', required: true, help: 'e.g., LAR-MICE-001-2025' },
        { key: 'request_date', label: 'Request Date', required: true, help: 'Format: YYYY-MM-DD or DD/MM/YYYY' }
      ]
    },
    {
      title: 'Requestor Details (Required)',
      fields: [
        { key: 'first_name', label: 'First Name', required: true },
        { key: 'last_name', label: 'Last Name', required: true },
        { key: 'user_code', label: 'User ID/Employee ID', required: true },
        { key: 'designation', label: 'Designation/Position', required: true },
        { key: 'asset', label: 'Location/Asset', required: true, help: 'e.g., LAND AREA, OBOS' },
        { key: 'office_extension', label: 'Office Extension', required: false }
      ]
    },
    {
      title: 'Request Information (Required)',
      fields: [
        { key: 'discipline', label: 'Discipline/Material Group', required: true, help: 'e.g., Mechanical, Electrical' },
        { key: 'material_category', label: 'Material Category', required: false },
        { key: 'criticality', label: 'Criticality/Priority', required: true, help: 'Low, Medium, High, or Critical' },
        { key: 'reason', label: 'Reason for Request', required: true },
        { key: 'unit_tag', label: 'Unit Tag', required: false },
        { key: 'work_order_no', label: 'Work Order Number', required: false }
      ]
    },
    {
      title: 'Materials (Required)',
      fields: [
        { key: 'material_description', label: 'Material Description', required: true },
        { key: 'quantity', label: 'Quantity', required: true, help: 'Must be a number' },
        { key: 'quantity_unit', label: 'Quantity Unit', required: false, help: 'e.g., pcs, pairs, kg' },
        { key: 'oem_model', label: 'OEM/Model', required: false },
        { key: 'part_number', label: 'Part Number', required: false }
      ]
    },
    {
      title: 'Tracking & Procurement (Optional)',
      fields: [
        { key: 'vendor_name', label: 'Vendor/Contractor Name', required: false, help: 'Who submitted quotation' },
        { key: 'internal_reference', label: 'Internal Reference', required: false, help: 'Staff following up' },
        { key: 'approved_by', label: 'Approved By', required: false, help: 'Manager name' },
        { key: 'status', label: 'Status', required: false, help: 'Pending, Approved, etc.' },
        { key: 'quotation_amount_usd', label: 'Quotation Amount (USD)', required: false },
        { key: 'quotation_amount_ngn', label: 'Quotation Amount (NGN)', required: false },
        { key: 'blanket_order_number', label: 'Blanket Order Number', required: false },
        { key: 'notes', label: 'Notes', required: false }
      ]
    }
  ];
  
  let html = instructions;
  
  fieldGroups.forEach(group => {
    html += `
      <div class="card" style="grid-column: 1/-1; margin-bottom: 1.5rem;">
        <div class="card-header" style="background: var(--oando-navy); color: white;">
          <h4 style="margin: 0; color: white;">${group.title}</h4>
        </div>
        <div class="card-body">
          <div class="form-row form-row-3">
    `;
    
    group.fields.forEach(field => {
      const mapped = suggestedMapping[field.key];
      const isMapped = mapped ? 'style="border: 2px solid var(--success);"' : '';
      
      html += `
        <div class="form-group">
          <label class="form-label ${field.required ? 'required' : ''}">
            ${field.label}
            ${mapped ? '<span style="color: var(--success); margin-left: 0.5rem;">✓ Auto-mapped</span>' : ''}
          </label>
          <select id="map_${field.key}" class="form-select" ${isMapped}>
            <option value="">-- Not Mapped --</option>
            ${previewData.headers.map(h => `
              <option value="${h}" ${suggestedMapping[field.key] === h ? 'selected' : ''}>${h}</option>
            `).join('')}
          </select>
          ${field.help ? `<p class="form-help">${field.help}</p>` : ''}
        </div>
      `;
    });
    
    html += `
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderPreviewTable() {
  const table = document.getElementById('previewTable');
  const headers = previewData.headers;
  const rows = previewData.preview;
  
  let html = `
    <caption style="text-align: left; font-weight: bold; padding: 1rem; background: var(--grey-100);">
      Preview of Your Data (First 10 rows of ${previewData.totalRows} total)
    </caption>
    <thead><tr>`;
  
  headers.forEach(h => {
    html += `<th style="min-width: 150px;">${h}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  rows.forEach(row => {
    html += '<tr>';
    headers.forEach(h => {
      const value = row[h] || '';
      html += `<td>${value.toString().substring(0, 100)}${value.toString().length > 100 ? '...' : ''}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody>';
  table.innerHTML = html;
}

async function processImport() {
  // Build mapping from form
  const mapping = {};
  const requiredFields = ['mrf_number', 'first_name', 'last_name', 'user_code', 'designation', 'asset', 'discipline', 'criticality', 'reason', 'material_description', 'quantity'];
  
  document.querySelectorAll('[id^="map_"]').forEach(select => {
    const field = select.id.replace('map_', '');
    const value = select.value;
    if (value) {
      mapping[field] = value;
    }
  });
  
  // Validate required mappings
  const missing = requiredFields.filter(f => !mapping[f]);
  if (missing.length > 0) {
    app.showAlert(`❌ Missing Required Mappings: ${missing.join(', ')}. Please map all required fields marked with *.`, 'error');
    // Scroll to first missing field
    document.getElementById(`map_${missing[0]}`).scrollIntoView({ behavior: 'smooth' });
    document.getElementById(`map_${missing[0]}`).focus();
    return;
  }
  
  const duplicateStrategy = document.getElementById('duplicateStrategy').value;
  
  if (!confirm(`Ready to import ${previewData.totalRows} rows?\n\nDuplicate Strategy: ${duplicateStrategy}\n\nThis may take a few moments. Continue?`)) {
    return;
  }
  
  app.showLoading(true);
  app.showAlert('⏳ Processing import... Please wait, do not close this page.', 'info');
  
  try {
    const fileInput = document.getElementById('fileInput');
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('mapping', JSON.stringify(mapping));
    formData.append('duplicateStrategy', duplicateStrategy);
    
    const response = await app.api.upload('/imports/process', formData);
    
    document.getElementById('mappingSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    
    document.getElementById('totalRows').textContent = response.summary.totalRows;
    document.getElementById('successRows').textContent = response.summary.successful;
    document.getElementById('failedRows').textContent = response.summary.failed;
    
    if (response.summary.errors && response.summary.errors.length > 0) {
      const errorsList = document.getElementById('errorsList');
      errorsList.innerHTML = `
        <div class="card">
          <div class="card-header" style="background: var(--error); color: white;">
            <h4 style="margin: 0; color: white;">Import Errors (${response.summary.errors.length})</h4>
          </div>
          <div class="card-body">
            <ul style="max-height: 400px; overflow-y: auto;">
              ${response.summary.errors.slice(0, 50).map(e => `
                <li style="margin-bottom: 0.5rem;">
                  <strong>${e.mrf_number || 'Row ' + (e.row || '?')}:</strong> ${e.error}
                </li>
              `).join('')}
              ${response.summary.errors.length > 50 ? `<li><em>... and ${response.summary.errors.length - 50} more errors</em></li>` : ''}
            </ul>
          </div>
        </div>
      `;
    }
    
    app.showAlert(`✅ Import completed! ${response.summary.successful} requests imported successfully.${response.summary.failed > 0 ? ` ${response.summary.failed} rows failed (see errors below).` : ''}`, 'success');
    
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    app.showAlert('❌ Import failed: ' + error.message, 'error');
    console.error('Import error:', error);
  } finally {
    app.showLoading(false);
  }
}

function resetImport() {
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadSection').classList.remove('hidden');
  document.getElementById('mappingSection').classList.add('hidden');
  document.getElementById('resultsSection').classList.add('hidden');
  previewData = null;
  suggestedMapping = null;
  document.getElementById('uploadSection').scrollIntoView({ behavior: 'smooth' });
}