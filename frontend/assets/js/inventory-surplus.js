// frontend/assets/js/inventory-surplus.js
// Surplus Materials Management

let warehouses = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth() || !app.requireRole('admin')) return;
  
  loadWarehouses();
  loadSurplus();
  setupSurplusForm();
  setupEditSurplusForm();
  
  // Set default date to today
  document.getElementById('reported_date').valueAsDate = new Date();
});

async function loadWarehouses() {
  try {
    const response = await app.api.get('/inventory/warehouses');
    warehouses = response.warehouses;
    
    const warehouseSelect = document.getElementById('warehouse_id');
    const filterWarehouseSelect = document.getElementById('filterWarehouse');
    
    warehouses.forEach(wh => {
      const option1 = document.createElement('option');
      option1.value = wh.id;
      option1.textContent = `${wh.warehouse_code} - ${wh.warehouse_name}`;
      warehouseSelect.appendChild(option1);
      
      const option2 = document.createElement('option');
      option2.value = wh.id;
      option2.textContent = `${wh.warehouse_code} - ${wh.warehouse_name}`;
      filterWarehouseSelect.appendChild(option2);
    });
  } catch (error) {
    console.error('Load warehouses error:', error);
  }
}

function showNewSurplusForm() {
  document.getElementById('newSurplusForm').style.display = 'block';
  document.getElementById('newSurplusForm').scrollIntoView({ behavior: 'smooth' });
}

function cancelSurplusForm() {
  document.getElementById('newSurplusForm').style.display = 'none';
  document.getElementById('surplusForm').reset();
  document.getElementById('reported_date').valueAsDate = new Date();
}

function setupSurplusForm() {
  document.getElementById('surplusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      warehouse_id: parseInt(document.getElementById('warehouse_id').value),
      material_description: document.getElementById('material_description').value,
      oem_model: document.getElementById('oem_model').value || null,
      part_number: document.getElementById('part_number').value || null,
      quantity_surplus: parseFloat(document.getElementById('quantity_surplus').value),
      quantity_unit: document.getElementById('quantity_unit').value || 'pcs',
      reason: document.getElementById('reason').value || null,
      reported_by: document.getElementById('reported_by').value,
      reported_date: document.getElementById('reported_date').value || new Date().toISOString().split('T')[0],
      disposition: document.getElementById('disposition').value,
      remarks: document.getElementById('remarks').value || null
    };
    
    try {
      app.showLoading(true);
      const response = await app.api.post('/inventory/surplus', formData);
      
      if (response.success) {
        app.showAlert('✅ Surplus material reported successfully!', 'success');
        cancelSurplusForm();
        loadSurplus();
      }
    } catch (error) {
      app.showAlert('Failed to report surplus: ' + error.message, 'error');
    } finally {
      app.showLoading(false);
    }
  });
}

async function loadSurplus() {
  try {
    app.showLoading(true);
    
    const params = {};
    
    const warehouseId = document.getElementById('filterWarehouse').value;
    if (warehouseId) params.warehouse_id = warehouseId;
    
    const disposition = document.getElementById('filterDisposition').value;
    if (disposition) params.disposition = disposition;
    
    const search = document.getElementById('searchMaterial').value;
    if (search) params.search = search;
    
    const response = await app.api.get('/inventory/surplus', params);
    
    if (response.success) {
      renderSurplus(response.surplus);
    }
  } catch (error) {
    console.error('Load surplus error:', error);
    app.showAlert('Failed to load surplus materials', 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderSurplus(surplus) {
  const tbody = document.getElementById('surplusTableBody');
  
  if (surplus.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No surplus materials found</td></tr>';
    return;
  }
  
  tbody.innerHTML = surplus.map(item => `
    <tr>
      <td>${new Date(item.reported_date).toLocaleDateString()}</td>
      <td>${item.warehouse_code}</td>
      <td style="font-weight: 600; color: #00205B;">${item.material_description}</td>
      <td>${item.oem_model || '-'}</td>
      <td>${item.part_number || '-'}</td>
      <td style="font-weight: 700; color: #F58220;">${app.formatNumber(item.quantity_surplus)}</td>
      <td>${item.quantity_unit}</td>
      <td>${item.reported_by}</td>
      <td><span class="badge badge-${getDispositionBadgeClass(item.disposition)}">${item.disposition}</span></td>
      <td>
        <button onclick="editSurplusItem(${item.id}, '${item.material_description.replace(/'/g, "\\'")}', '${item.disposition}', '${(item.remarks || '').replace(/'/g, "\\'")}')" class="btn btn-sm btn-secondary">Edit</button>
      </td>
    </tr>
  `).join('');
}

function getDispositionBadgeClass(disposition) {
  const classes = {
    'Available': 'info',
    'Disposed': 'error',
    'Returned': 'warning',
    'Sold': 'success'
  };
  return classes[disposition] || 'secondary';
}

function editSurplusItem(id, materialDesc, disposition, remarks) {
  document.getElementById('editSurplusId').value = id;
  document.getElementById('editMaterialDesc').value = materialDesc;
  document.getElementById('editDisposition').value = disposition;
  document.getElementById('editRemarks').value = remarks || '';
  
  document.getElementById('editSurplusModal').style.display = 'flex';
}

function closeEditSurplusModal() {
  document.getElementById('editSurplusModal').style.display = 'none';
  document.getElementById('editSurplusForm').reset();
}

function setupEditSurplusForm() {
  document.getElementById('editSurplusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editSurplusId').value;
    const data = {
      disposition: document.getElementById('editDisposition').value,
      remarks: document.getElementById('editRemarks').value || null
    };
    
    try {
      app.showLoading(true);
      const response = await app.api.put(`/inventory/surplus/${id}`, data);
      
      if (response.success) {
        app.showAlert('✅ Surplus material updated successfully!', 'success');
        closeEditSurplusModal();
        loadSurplus();
      }
    } catch (error) {
      app.showAlert('Failed to update surplus: ' + error.message, 'error');
    } finally {
      app.showLoading(false);
    }
  });
  
  // Close modal on background click
  document.getElementById('editSurplusModal').addEventListener('click', (e) => {
    if (e.target.id === 'editSurplusModal') {
      closeEditSurplusModal();
    }
  });
}

// Make functions globally accessible
window.showNewSurplusForm = showNewSurplusForm;
window.cancelSurplusForm = cancelSurplusForm;
window.loadSurplus = loadSurplus;
window.editSurplusItem = editSurplusItem;
window.closeEditSurplusModal = closeEditSurplusModal;

