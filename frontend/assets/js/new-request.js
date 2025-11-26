// frontend/assets/js/new-request.js
// Professional MRF Form Handler

let materialRowCount = 0;
let userEmail = '';

const locationsByArea = {
  'Land Area': ['OBOB', 'KWALE', 'IRRI', 'OSHIE', 'EBOCHA', 'IDU', 'AKRI'],
  'Swamp Area': ['OGBOINBIRI', 'BRASS', 'OBAMA', 'CLOUGH CREEK', 'BRASS TERMINAL'],
  'PHC POD': ['IDU', 'PHC', 'AKRI', 'EBOCHA', 'SAMABIRI', 'TEBIDABA', 'OGBOINBIRI']
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!app.requireAuth()) return;
  
  await loadUserProfile();
  await loadLookups();
  addMaterialRow(); // Add first row
  
  document.getElementById('area').addEventListener('change', handleAreaChange);
  document.getElementById('requestForm').addEventListener('submit', handleSubmit);
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
  
  try {
    const requestData = {
      first_name: document.getElementById('first_name').value,
      last_name: document.getElementById('last_name').value,
      user_code: document.getElementById('user_code').value,
      designation: document.getElementById('designation').value,
      office_extension: document.getElementById('office_extension').value,
      area: document.getElementById('area').value,
      location: document.getElementById('location').value,
      unit_tag: document.getElementById('unit_tag').value.trim(),
      discipline: document.getElementById('discipline').value,
      material_category: document.getElementById('material_category').value,
      criticality: document.getElementById('criticality').value,
      work_order_no: document.getElementById('work_order_no').value.trim(),
      work_order_type: document.getElementById('work_order_type').value.trim(),
      reason: document.getElementById('reason').value.trim(),
      remarks: document.getElementById('remarks').value.trim(),
      service_material: lines.map(l => l.material_description).join(', '),
      lines: lines
    };
    
    console.log('📤 Submitting request:', requestData);
    
    const response = await app.api.post('/requests', requestData);
    
    if (response.success) {
      app.showAlert('✅ Request submitted successfully! Generating PDF...', 'success');
      
      // Generate and download PDF
      if (response.request && response.request.id) {
        await downloadRequestPDF(response.request.id);
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