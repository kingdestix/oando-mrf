// frontend/assets/js/new-request.js
// Professional MRF Form Handler

let materialRowCount = 0;
let userEmail = '';

const locationsByArea = {
  'Land Area': ['OBOB', 'KWALE', 'IRRI', 'OSHIE', 'EBOCHA', 'IDU', 'AKRI'],
  'Swamp Area': ['OGBOINBIRI', 'BRASS', 'OBAMA', 'CLOUGH CREEK', 'BRASS TERMINAL', 'SAMABRI'],
  'PHC POD': ['OBOB', 'KWALE', 'IRRI', 'OSHIE', 'EBOCHA', 'IDU', 'AKRI', 'OGBOINBIRI', 'BRASS', 'OBAMA', 'CLOUGH CREEK', 'BRASS TERMINAL', 'SAMABRI', 'TEBIDABA', 'PHC']
};

let selectedAttachments = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!app.requireAuth()) return;
  
  await loadUserProfile();
  await loadLookups();
  addMaterialRow(); // Add first row
  
  document.getElementById('area').addEventListener('change', handleAreaChange);
  document.getElementById('requestForm').addEventListener('submit', handleSubmit);
  
  // Handle attachment selection
  const attachmentInput = document.getElementById('attachments');
  if (attachmentInput) {
    attachmentInput.addEventListener('change', handleAttachmentChange);
  }
});

async function loadUserProfile() {
  try {
    const response = await app.api.get('/auth/profile');
    const user = response.user;
    userEmail = user.email;
    
    document.getElementById('first_name').value = user.first_name;
    document.getElementById('last_name').value = user.last_name;
    document.getElementById('user_code').value = user.user_id;
    document.getElementById('designation').value = user.designation || '';
    document.getElementById('office_extension').value = user.office_extension || '';
    document.getElementById('user_location').value = user.location || '';
  } catch (error) {
    console.error('Load profile error:', error);
    app.showAlert('Failed to load user profile', 'error');
  }
}

async function loadLookups() {
  try {
    const response = await app.api.get('/requests/lookups');
    
    const categorySelect = document.getElementById('material_category');
    response.lookups.materialCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.category_name;
      option.textContent = cat.category_name;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('Load lookups error:', error);
  }
}

function handleAreaChange(e) {
  const area = e.target.value;
  const locationSelect = document.getElementById('location');
  
  locationSelect.innerHTML = '<option value="">Select Location</option>';
  
  if (area && locationsByArea[area]) {
    locationSelect.disabled = false;
    locationsByArea[area].forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      locationSelect.appendChild(option);
    });
  } else {
    locationSelect.disabled = true;
  }
}

function addMaterialRow() {
  materialRowCount++;
  const tbody = document.getElementById('materialTableBody');
  
  const row = tbody.insertRow();
  row.id = `material-row-${materialRowCount}`;
  
  row.innerHTML = `
    <td style="text-align: center; font-weight: 600; color: #00205B;">${materialRowCount}</td>
    <td>
      <input type="text" class="material-description" required placeholder="Enter detailed material description">
    </td>
    <td>
      <input type="text" class="oem-model" placeholder="OEM/Model">
    </td>
    <td>
      <input type="text" class="part-number" placeholder="Part Number">
    </td>
    <td>
      <input type="number" class="quantity" min="0.01" step="0.01" value="1" required>
    </td>
    <td>
      <select class="quantity-unit">
        <option value="pcs">pcs</option>
        <option value="kg">kg</option>
        <option value="m">m</option>
        <option value="L">L</option>
        <option value="set">set</option>
      </select>
    </td>
    <td style="text-align: center;">
      <button type="button" class="remove-row-btn" onclick="removeMaterialRow(${materialRowCount})" ${materialRowCount === 1 ? 'disabled' : ''}>
        Remove
      </button>
    </td>
  `;
}

function removeMaterialRow(rowNumber) {
  const row = document.getElementById(`material-row-${rowNumber}`);
  if (row) {
    row.remove();
    // Renumber remaining rows
    const rows = document.querySelectorAll('#materialTableBody tr');
    rows.forEach((r, index) => {
      r.cells[0].textContent = index + 1;
    });
  }
}

function handleAttachmentChange(e) {
  const files = Array.from(e.target.files);
  selectedAttachments = files;
  
  const preview = document.getElementById('attachmentPreview');
  const list = document.getElementById('attachmentList');
  
  if (files.length === 0) {
    preview.style.display = 'none';
    return;
  }
  
  preview.style.display = 'block';
  list.innerHTML = '';
  
  files.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #F3F4F6; border-radius: 4px; font-size: 0.8rem;';
    
    const fileName = document.createElement('span');
    fileName.textContent = file.name;
    fileName.style.cssText = 'flex: 1; color: var(--text-main);';
    
    const fileSize = document.createElement('span');
    fileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    fileSize.style.cssText = 'color: var(--text-muted); font-size: 0.75rem;';
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.type = 'button';
    removeBtn.style.cssText = 'background: #DC2626; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 0.9rem; line-height: 1;';
    removeBtn.onclick = () => {
      selectedAttachments = selectedAttachments.filter((_, i) => i !== index);
      updateAttachmentInput();
      handleAttachmentChange({ target: { files: createFileList(selectedAttachments) } });
    };
    
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileSize);
    fileItem.appendChild(removeBtn);
    list.appendChild(fileItem);
  });
}

function createFileList(files) {
  const dt = new DataTransfer();
  files.forEach(file => dt.items.add(file));
  return dt.files;
}

function updateAttachmentInput() {
  const input = document.getElementById('attachments');
  const dt = new DataTransfer();
  selectedAttachments.forEach(file => dt.items.add(file));
  input.files = dt.files;
}

async function handleSubmit(e) {
  e.preventDefault();
  
  // Collect material lines
  const lines = [];
  const rows = document.querySelectorAll('#materialTableBody tr');
  
  rows.forEach(row => {
    const description = row.querySelector('.material-description').value.trim();
    if (description) {
      lines.push({
        material_description: description,
        oem_model: row.querySelector('.oem-model').value.trim() || '',
        part_number: row.querySelector('.part-number').value.trim() || '',
        quantity: parseFloat(row.querySelector('.quantity').value) || 1,
        quantity_unit: row.querySelector('.quantity-unit').value || 'pcs'
      });
    }
  });
  
  if (lines.length === 0) {
    app.showAlert('Please add at least one material', 'error');
    return;
  }
  
  // Show loading
  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitText');
  const submitSpinner = document.getElementById('submitSpinner');
  
  submitBtn.disabled = true;
  submitText.classList.add('hidden');
  submitSpinner.classList.remove('hidden');
  
  // Validate mandatory fields
  const unitTag = document.getElementById('unit_tag').value.trim();
  const workOrderNo = document.getElementById('work_order_no').value.trim();
  const workOrderType = document.getElementById('work_order_type').value.trim();
  
  if (!unitTag) {
    app.showAlert('Unit Tag is required', 'error');
    document.getElementById('unit_tag').focus();
    return;
  }
  
  if (!workOrderNo) {
    app.showAlert('Work Order Number is required', 'error');
    document.getElementById('work_order_no').focus();
    return;
  }
  
  if (!workOrderType) {
    app.showAlert('Work Order Type is required', 'error');
    document.getElementById('work_order_type').focus();
    return;
  }

  try {
    const requestData = {
      first_name: document.getElementById('first_name').value,
      last_name: document.getElementById('last_name').value,
      user_code: document.getElementById('user_code').value,
      designation: document.getElementById('designation').value,
      office_extension: document.getElementById('office_extension').value,
      area: document.getElementById('area').value,
      location: document.getElementById('location').value,
      unit_tag: unitTag,
      discipline: document.getElementById('discipline').value,
      material_class: document.getElementById('material_class').value,
      material_category: document.getElementById('material_category').value,
      criticality: document.getElementById('criticality').value,
      work_order_no: workOrderNo,
      work_order_type: workOrderType,
      reason: document.getElementById('reason').value.trim(),
      remarks: document.getElementById('remarks').value.trim(),
      service_material: lines.map(l => l.material_description).join(', '),
      lines: lines
    };
    
    console.log('📤 Submitting request:', requestData);
    
    const response = await app.api.post('/requests', requestData);
    
    if (response.success) {
      const requestId = response.request?.id;
      
      // Upload attachments if any
      if (selectedAttachments.length > 0 && requestId) {
        app.showAlert('✅ Request submitted! Uploading attachments...', 'success');
        
        try {
          for (const file of selectedAttachments) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('category', 'general');
            
            await app.api.upload(`/requests/${requestId}/attachments`, formData);
          }
          app.showAlert('✅ Request and attachments submitted successfully!', 'success');
        } catch (attachError) {
          console.error('Attachment upload error:', attachError);
          app.showAlert('Request submitted, but some attachments failed to upload', 'warning');
        }
      } else {
        app.showAlert('✅ Request submitted successfully!', 'success');
      }
      
      setTimeout(() => {
        window.location.href = '/worker-dashboard.html';
      }, 2000);
    }
  } catch (error) {
    console.error('❌ Submit error:', error);
    app.showAlert('Failed to submit request: ' + error.message, 'error');
    submitBtn.disabled = false;
    submitText.classList.remove('hidden');
    submitSpinner.classList.add('hidden');
  }
}

async function downloadRequestPDF(requestId) {
  try {
    const blob = await app.api.download(`/requests/${requestId}/pdf`);
    const fileName = `MRF_Request_${requestId}_${new Date().toISOString().split('T')[0]}.pdf`;
    app.downloadFile(blob, fileName);
  } catch (error) {
    console.error('PDF download error:', error);
    app.showAlert('PDF generation failed, but request was submitted successfully', 'warning');
  }
}