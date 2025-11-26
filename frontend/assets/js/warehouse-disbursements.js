// frontend/assets/js/warehouse-disbursements.js
// Warehouse Disbursements Management

let currentPage = 1;
let warehouses = [];
let disbursementLineItems = [];
let stockData = {};

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth() || !app.requireRole('admin')) return;
  
  loadWarehouses();
  loadDisbursements();
  setupDisbursementForm();
  
  // Set default date to today
  document.getElementById('disbursed_date').valueAsDate = new Date();
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
    app.showAlert('Failed to load warehouses', 'error');
  }
}

async function loadStock(warehouseId) {
  if (!warehouseId) return;
  
  try {
    const response = await app.api.get('/inventory/stock', { warehouse_id: warehouseId });
    stockData = {};
    response.stock.forEach(item => {
      const key = `${item.material_description}|${item.oem_model || ''}|${item.part_number || ''}`;
      stockData[key] = item;
    });
    checkStockAvailability();
  } catch (error) {
    console.error('Load stock error:', error);
  }
}

function showNewDisbursementForm() {
  document.getElementById('newDisbursementForm').style.display = 'block';
  document.getElementById('newDisbursementForm').scrollIntoView({ behavior: 'smooth' });
  addDisbursementLineItem();
}

function cancelDisbursementForm() {
  document.getElementById('newDisbursementForm').style.display = 'none';
  document.getElementById('disbursementForm').reset();
  disbursementLineItems = [];
  document.getElementById('disbursementItemsContainer').innerHTML = '';
}

function addDisbursementLineItem() {
  const itemId = Date.now();
  disbursementLineItems.push({
    id: itemId,
    material_description: '',
    oem_model: '',
    part_number: '',
    quantity_disbursed: '',
    quantity_unit: 'pcs',
    condition: 'Good',
    remarks: ''
  });
  
  renderDisbursementLineItems();
}

function removeDisbursementLineItem(itemId) {
  disbursementLineItems = disbursementLineItems.filter(item => item.id !== itemId);
  renderDisbursementLineItems();
}

function renderDisbursementLineItems() {
  const container = document.getElementById('disbursementItemsContainer');
  container.innerHTML = '';
  
  disbursementLineItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center;">
        <span style="font-weight: 600; color: #00205B;">${index + 1}</span>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label required">Material Description</label>
        <input type="text" class="form-input" data-field="material_description" data-id="${item.id}" value="${item.material_description}" required onchange="checkItemStock(${item.id})">
        <div class="stock-check" id="stock-check-${item.id}"></div>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label">OEM/Model</label>
        <input type="text" class="form-input" data-field="oem_model" data-id="${item.id}" value="${item.oem_model}" onchange="checkItemStock(${item.id})">
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label">Part Number</label>
        <input type="text" class="form-input" data-field="part_number" data-id="${item.id}" value="${item.part_number}" onchange="checkItemStock(${item.id})">
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label required">Quantity</label>
        <input type="number" step="0.01" class="form-input" data-field="quantity_disbursed" data-id="${item.id}" value="${item.quantity_disbursed}" required onchange="checkItemStock(${item.id})">
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label">Unit</label>
        <input type="text" class="form-input" data-field="quantity_unit" data-id="${item.id}" value="${item.quantity_unit}">
      </div>
      <button type="button" onclick="removeDisbursementLineItem(${item.id})" class="remove-line-btn" title="Remove Item">×</button>
    `;
    container.appendChild(row);
  });
  
  // Add event listeners
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      const itemId = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field;
      const item = disbursementLineItems.find(i => i.id === itemId);
      if (item) {
        item[field] = e.target.value;
      }
    });
  });
  
  checkStockAvailability();
}

async function checkStockAvailability() {
  const warehouseId = document.getElementById('warehouse_id').value;
  if (!warehouseId) return;
  
  await loadStock(warehouseId);
  
  disbursementLineItems.forEach(item => {
    checkItemStock(item.id);
  });
}

function checkItemStock(itemId) {
  const warehouseId = document.getElementById('warehouse_id').value;
  if (!warehouseId) return;
  
  const item = disbursementLineItems.find(i => i.id === itemId);
  if (!item || !item.material_description) {
    document.getElementById(`stock-check-${itemId}`).innerHTML = '';
    return;
  }
  
  const key = `${item.material_description}|${item.oem_model || ''}|${item.part_number || ''}`;
  const stock = stockData[key];
  const checkEl = document.getElementById(`stock-check-${itemId}`);
  
  if (!stock) {
    checkEl.innerHTML = '<span class="unavailable">❌ Not in stock</span>';
    checkEl.className = 'stock-check unavailable';
    return;
  }
  
  const available = parseFloat(stock.quantity_available);
  const requested = parseFloat(item.quantity_disbursed) || 0;
  
  if (available >= requested) {
    checkEl.innerHTML = `<span class="available">✓ Available: ${available} ${stock.quantity_unit}</span>`;
    checkEl.className = 'stock-check available';
  } else {
    checkEl.innerHTML = `<span class="unavailable">❌ Insufficient: ${available} ${stock.quantity_unit} available</span>`;
    checkEl.className = 'stock-check unavailable';
  }
}

function setupDisbursementForm() {
  document.getElementById('disbursementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (disbursementLineItems.length === 0) {
      app.showAlert('Please add at least one material item', 'warning');
      return;
    }
    
    // Update line items from form
    disbursementLineItems.forEach(item => {
      const row = document.querySelector(`[data-id="${item.id}"]`).closest('.line-item-row');
      if (row) {
        item.material_description = row.querySelector('[data-field="material_description"]').value;
        item.oem_model = row.querySelector('[data-field="oem_model"]').value;
        item.part_number = row.querySelector('[data-field="part_number"]').value;
        item.quantity_disbursed = parseFloat(row.querySelector('[data-field="quantity_disbursed"]').value);
        item.quantity_unit = row.querySelector('[data-field="quantity_unit"]').value || 'pcs';
      }
    });
    
    const formData = {
      warehouse_id: parseInt(document.getElementById('warehouse_id').value),
      request_id: document.getElementById('request_id').value ? parseInt(document.getElementById('request_id').value) : null,
      disbursed_date: document.getElementById('disbursed_date').value,
      disbursed_by: document.getElementById('disbursed_by').value,
      received_by: document.getElementById('received_by').value,
      department: document.getElementById('department').value || null,
      work_order_no: document.getElementById('work_order_no').value || null,
      purpose: document.getElementById('purpose').value || null,
      remarks: document.getElementById('remarks').value || null,
      items: disbursementLineItems
    };
    
    try {
      app.showLoading(true);
      const response = await app.api.post('/inventory/disbursements', formData);
      
      if (response.success) {
        app.showAlert('✅ Disbursement created successfully!', 'success');
        cancelDisbursementForm();
        loadDisbursements();
      }
    } catch (error) {
      app.showAlert('Failed to create disbursement: ' + error.message, 'error');
    } finally {
      app.showLoading(false);
    }
  });
}

async function loadDisbursements(page = 1) {
  try {
    app.showLoading(true);
    currentPage = page;
    
    const params = {
      page,
      limit: 25
    };
    
    const warehouseId = document.getElementById('filterWarehouse').value;
    if (warehouseId) params.warehouse_id = warehouseId;
    
    const fromDate = document.getElementById('filterFromDate').value;
    if (fromDate) params.from_date = fromDate;
    
    const toDate = document.getElementById('filterToDate').value;
    if (toDate) params.to_date = toDate;
    
    const response = await app.api.get('/inventory/disbursements', params);
    
    if (response.success) {
      renderDisbursements(response.disbursements);
      renderDisbursementsPagination(response.pagination);
    }
  } catch (error) {
    console.error('Load disbursements error:', error);
    app.showAlert('Failed to load disbursements', 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderDisbursements(disbursements) {
  const tbody = document.getElementById('disbursementsTableBody');
  
  if (disbursements.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No disbursements found</td></tr>';
    return;
  }
  
  tbody.innerHTML = disbursements.map(disbursement => `
    <tr>
      <td style="font-weight: 600; color: #00205B;">${disbursement.disbursement_number}</td>
      <td>${new Date(disbursement.disbursed_date).toLocaleDateString()}</td>
      <td>${disbursement.warehouse_code}</td>
      <td>${disbursement.disbursed_by}</td>
      <td>${disbursement.received_by}</td>
      <td>${disbursement.item_count || 0} items</td>
      <td>
        <button onclick="viewDisbursement(${disbursement.id})" class="btn btn-sm btn-secondary">View</button>
      </td>
    </tr>
  `).join('');
}

function renderDisbursementsPagination(pagination) {
  const container = document.getElementById('disbursementsPagination');
  
  if (pagination.pages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '<div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center; margin-top: 1rem;">';
  
  if (pagination.page > 1) {
    html += `<button onclick="loadDisbursements(${pagination.page - 1})" class="btn btn-sm btn-secondary">Previous</button>`;
  }
  
  html += `<span style="padding: 0 1rem;">Page ${pagination.page} of ${pagination.pages}</span>`;
  
  if (pagination.page < pagination.pages) {
    html += `<button onclick="loadDisbursements(${pagination.page + 1})" class="btn btn-sm btn-secondary">Next</button>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

async function viewDisbursement(id) {
  try {
    const response = await app.api.get(`/inventory/disbursements/${id}`);
    
    if (response.success) {
      const disbursement = response.disbursement;
      let html = `
        <div style="padding: 2rem;">
          <h2 style="color: #00205B; margin-bottom: 1.5rem;">Disbursement: ${disbursement.disbursement_number}</h2>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div><strong>Warehouse:</strong> ${disbursement.warehouse_name}</div>
            <div><strong>Date:</strong> ${new Date(disbursement.disbursed_date).toLocaleDateString()}</div>
            <div><strong>Disbursed By:</strong> ${disbursement.disbursed_by}</div>
            <div><strong>Received By:</strong> ${disbursement.received_by}</div>
            <div><strong>Department:</strong> ${disbursement.department || '-'}</div>
            <div><strong>Work Order:</strong> ${disbursement.work_order_no || '-'}</div>
            <div><strong>Items:</strong> ${disbursement.items.length}</div>
          </div>
          
          <h3 style="color: #00205B; margin-bottom: 1rem;">Items</h3>
          <table class="disbursements-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Material Description</th>
                <th>OEM/Model</th>
                <th>Part Number</th>
                <th>Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              ${disbursement.items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.material_description}</td>
                  <td>${item.oem_model || '-'}</td>
                  <td>${item.part_number || '-'}</td>
                  <td>${item.quantity_disbursed}</td>
                  <td>${item.quantity_unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      
      app.showModal('Disbursement Details', html);
    }
  } catch (error) {
    app.showAlert('Failed to load disbursement details', 'error');
  }
}

// Make functions globally accessible
window.addDisbursementLineItem = addDisbursementLineItem;
window.removeDisbursementLineItem = removeDisbursementLineItem;
window.showNewDisbursementForm = showNewDisbursementForm;
window.cancelDisbursementForm = cancelDisbursementForm;
window.loadDisbursements = loadDisbursements;
window.viewDisbursement = viewDisbursement;
window.checkStockAvailability = checkStockAvailability;
window.checkItemStock = checkItemStock;





